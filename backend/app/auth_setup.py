"""Startup helpers for the login system: seed the preset roles and create the first Owner.

Same spirit as the seed_*() functions in main.py: safe to run on every start, only adds what is missing.
"""
from sqlalchemy.exc import IntegrityError

from app.auth import (
    AUTH_REQUIRED, hash_password, normalize_username, validate_new_password,
)
from app.database import SessionLocal
from app.models import AuditLog, Role, RolePermission, RoleRight, User
from app.permissions import AREA_KEYS, RIGHT_KEYS, SYSTEM_ROLES


def seed_system_roles():
    """Create the preset roles that do not exist yet. Existing roles are never overwritten,
    so changes you make to a preset in the Roles screen survive a restart.
    The one exception: Admin always gets every area/right, so a new area added in future code
    can never lock the Admin out."""
    db = SessionLocal()
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
            elif preset["name"] == "Admin":
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
    db = SessionLocal()
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

        admin_role = db.query(Role).filter(Role.name == "Admin").first()
        if admin_role is None:
            raise RuntimeError("Admin role missing - seed_system_roles() must run before bootstrap_owner().")

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
        db.add(AuditLog(user_id=owner.id, username=owner.username, action="owner_created",
                        record_type="user", record_id=owner.id,
                        summary="First Owner account created from environment variables"))
        db.commit()
        print(f"AUTH: first Owner '{username}' created (must change password at first login). "
              "You can now remove OWNER_PASSWORD from your environment.")
    finally:
        db.close()