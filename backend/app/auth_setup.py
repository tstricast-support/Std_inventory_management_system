"""Startup helpers for the login system: seed the preset roles and create the first Owner.

Same spirit as the seed_*() functions in main.py: safe to run on every start, only adds what is missing.
"""
from sqlalchemy.exc import IntegrityError

from app.auth import (
    AUTH_REQUIRED, hash_password, normalize_username, validate_new_password,
)
from app.audit import log_audit_company
from app.database import public_session
from app.models import Company, Role, RolePermission, RoleRight, User, UserCompanyAccess
from app.permissions import ADMIN_ROLE, AREA_KEYS, RIGHT_KEYS, SUPER_ADMIN_ROLE, SYSTEM_ROLES


def seed_system_roles():
    """Create the preset roles that do not exist yet. Existing roles are never overwritten,
    so changes you make to a preset in the Roles screen survive a restart.
    The one exception: Admin always gets every area/right, so a new area added in future code
    can never lock the Admin out."""
    db = public_session()
    try:
        for preset in SYSTEM_ROLES:
            role = db.query(Role).filter(Role.name == preset["name"]).first()
            if role is None:
                role = Role(name=preset["name"], description=preset["description"], is_system=True)
                db.add(role)
                db.flush()
                for area in AREA_KEYS:
                    db.add(RolePermission(role_id=role.id, area=area, level=preset["areas"].get(area, "none")))
                for right in preset["rights"]:
                    db.add(RoleRight(role_id=role.id, right_name=right))
            elif preset["name"] in (ADMIN_ROLE, SUPER_ADMIN_ROLE):
                have_areas = {p.area: p for p in role.permissions}
                for area in AREA_KEYS:
                    if area not in have_areas:
                        db.add(RolePermission(role_id=role.id, area=area, level="full"))
                    elif have_areas[area].level != "full":
                        have_areas[area].level = "full"
                have_rights = {r.right_name for r in role.rights}
                for right in RIGHT_KEYS:
                    if right not in have_rights:
                        db.add(RoleRight(role_id=role.id, right_name=right))
                role.is_system = True
        db.commit()
    finally:
        db.close()


def bootstrap_owner():
    """First start only: if there are no users, create the Owner from OWNER_USERNAME / OWNER_PASSWORD.
    There is no default password. If the variables are missing we print a clear error; the app still
    starts while AUTH_REQUIRED=false (so you can deploy first), but refuses to start when AUTH_REQUIRED=true."""
    db = public_session()
    try:
        if db.query(User.id).first() is not None:
            return

        import os
        username = normalize_username(os.getenv("OWNER_USERNAME", ""))
        password = os.getenv("OWNER_PASSWORD", "")
        full_name = os.getenv("OWNER_FULL_NAME", "").strip() or "Owner"

        problem = None
        if not username or not password:
            problem = "OWNER_USERNAME and OWNER_PASSWORD are not set."
        else:
            problem = validate_new_password(password, username)

        if problem:
            banner = (
                "\n" + "=" * 70 +
                "\nSTARTUP ERROR: there are no users yet and the first Owner cannot be created."
                f"\n  {problem}"
                "\n  Set OWNER_USERNAME and OWNER_PASSWORD (min 10 chars) in your environment and restart."
                "\n  No default password is ever created."
                "\n" + "=" * 70 + "\n"
            )
            if AUTH_REQUIRED:
                raise RuntimeError(banner)
            print(banner)
            return

        admin_role = (db.query(Role).filter(Role.name == SUPER_ADMIN_ROLE).first()
                      or db.query(Role).filter(Role.name == ADMIN_ROLE).first())
        if admin_role is None:
            raise RuntimeError("Super Admin role missing - seed_system_roles() must run before bootstrap_owner().")

        owner = User(
            username=username,
            full_name=full_name,
            password_hash=hash_password(password),
            role_id=admin_role.id,
            is_active=True,
            must_change_password=True,
        )
        db.add(owner)
        try:
            db.flush()
        except IntegrityError:          # another worker created it a moment ago
            db.rollback()
            return
        # the owner may enter every company that exists (the first Owner is also the one who can create more)
        companies = db.query(Company).filter(Company.is_active == True).order_by(Company.id).all()  # noqa: E712
        for c in companies:
            db.add(UserCompanyAccess(user_id=owner.id, company_id=c.id))
        db.commit()
        if companies:   # audit_logs lives inside the company schema, so it is written there
            log_audit_company(companies[0].id, owner, "owner_created", "user", owner.id,
                              "First Owner account created from environment variables")
        print(f"AUTH: first Owner '{username}' created (must change password at first login). "
              "You can now remove OWNER_PASSWORD from your environment.")
    finally:
        db.close()


def promote_multi_company_admins():
    """Runs on every start. Rule: a user who can enter 2 or more companies must be a Super Admin.
    Existing users with the Admin role (the owners) are moved up to Super Admin automatically.
    Users with any OTHER role are NOT promoted (that would silently hand out full access);
    they are only reported in the log so the owner can decide."""
    from sqlalchemy import func
    db = public_session()
    try:
        sa = db.query(Role).filter(Role.name == SUPER_ADMIN_ROLE).first()
        if sa is None:
            return
        rows = (db.query(UserCompanyAccess.user_id)
                .join(Company, Company.id == UserCompanyAccess.company_id)
                .filter(Company.is_active == True)  # noqa: E712
                .group_by(UserCompanyAccess.user_id)
                .having(func.count(UserCompanyAccess.company_id) >= 2).all())
        for (uid,) in rows:
            u = db.query(User).filter(User.id == uid).first()
            if u is None or u.role_id == sa.id:
                continue
            if u.role and u.role.name == ADMIN_ROLE:
                u.role_id = sa.id
                print(f"AUTH: '{u.username}' has 2+ companies -> role changed from Admin to Super Admin.")
            else:
                print(f"AUTH WARNING: '{u.username}' can enter 2+ companies but is not a Super Admin "
                      f"(role: {u.role.name if u.role else '?'}). Change the role or remove a company.")
        db.commit()
    finally:
        db.close()