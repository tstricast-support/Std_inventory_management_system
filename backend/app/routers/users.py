import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..audit import log_audit
from ..auth import (
    MIN_PASSWORD_LENGTH, accessible_companies, get_current_user, hash_password, normalize_username, user_permissions,
    user_rights, utcnow, validate_new_password,
)
from ..database import get_db
from ..models import Company, Role, RolePermission, RoleRight, User, UserCompanyAccess
from ..permissions import AREAS, AREA_KEYS, LEVELS, RIGHTS, RIGHT_KEYS
from .auth import _revoke_all

# Both routers are guarded by require_area("users") in main.py (and need the manage_users right).
router = APIRouter(prefix="/api/users", tags=["users"])
roles_router = APIRouter(prefix="/api/roles", tags=["roles"])

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,49}$")


# ---------- helpers ----------
def _generate_password() -> str:
    alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no look-alike characters
    return "".join(secrets.choice(alphabet) for _ in range(14))


def _is_admin_capable(user: User) -> bool:
    """An 'admin' = an active user whose role has full access to Users AND the manage_users right."""
    if not user.is_active:
        return False
    has_full = any(p.area == "users" and p.level == "full" for p in user.role.permissions)
    return has_full and any(r.right_name == "manage_users" for r in user.role.rights)


def _require_an_admin_left(db: Session, message: str) -> None:
    """Call after flush(). If no active admin is left, undo everything and refuse."""
    db.expire_all()
    users = db.query(User).options(joinedload(User.role).joinedload(Role.permissions),
                                   joinedload(User.role).joinedload(Role.rights)).filter(User.is_active == True).all()  # noqa: E712
    if not any(_is_admin_capable(u) for u in users):
        db.rollback()
        raise HTTPException(400, message)


def _companies_of(db: Session, user_ids: list) -> dict:
    """{user_id: [{"id", "name"}]} - the ACTIVE companies each user may enter (one query for all users)."""
    if not user_ids:
        return {}
    rows = (
        db.query(UserCompanyAccess.user_id, Company.id, Company.name)
        .join(Company, Company.id == UserCompanyAccess.company_id)
        .filter(UserCompanyAccess.user_id.in_(user_ids), Company.is_active == True)  # noqa: E712
        .order_by(Company.id)
        .all()
    )
    out: dict = {}
    for uid, cid, cname in rows:
        out.setdefault(uid, []).append({"id": cid, "name": cname})
    return out


def _row(db: Session, u: User) -> dict:
    return _user_row(u, _companies_of(db, [u.id]).get(u.id, []))


def _validated_company_ids(db: Session, actor: User, ids) -> tuple:
    """Returns (wanted ids, {company_id: name} the actor may hand out). Roles stay global; only the company
    list is per user. You can only give access to companies you can enter yourself. (Per-company roles could be
    added later by moving the role onto user_company_access.)"""
    wanted = {int(i) for i in (ids or [])}
    if not wanted:
        raise HTTPException(400, "Choose at least one company for this user.")
    scope = {c.id: c.name for c in accessible_companies(db, actor)}
    if wanted - set(scope):
        raise HTTPException(400, "You can only give access to companies that you can enter yourself.")
    return wanted, scope


def _user_row(u: User, companies: list | None = None) -> dict:
    now = utcnow()
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "role": {"id": u.role.id, "name": u.role.name},
        "is_active": bool(u.is_active),
        "must_change_password": bool(u.must_change_password),
        "locked": bool(u.locked_until and u.locked_until > now),
        "locked_until": u.locked_until.isoformat() if u.locked_until else None,
        "failed_attempts": u.failed_attempts or 0,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "companies": companies or [],
    }


def _get_user(db: Session, user_id: int) -> User:
    user = db.query(User).options(joinedload(User.role)).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(404, "User not found")
    return user


def _get_role(db: Session, role_id: int) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if role is None:
        raise HTTPException(404, "Role not found")
    return role


def _role_row(role: Role, user_count: int) -> dict:
    have = {p.area: p.level for p in role.permissions}
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_system": bool(role.is_system),
        "user_count": user_count,
        "permissions": {a: have.get(a, "none") for a in AREA_KEYS},
        "rights": sorted(r.right_name for r in role.rights),
    }


def _user_counts(db: Session) -> dict:
    return dict(db.query(User.role_id, func.count(User.id)).group_by(User.role_id).all())


# ---------- schemas ----------
class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    full_name: str = Field(min_length=1, max_length=150)
    role_id: int
    temp_password: str | None = Field(default=None, max_length=128)   # leave empty to generate one
    company_ids: list[int] = []                                       # companies this user may enter (at least one)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    role_id: int | None = None
    company_ids: list[int] | None = None      # None = leave the companies alone


class PasswordReset(BaseModel):
    temp_password: str | None = Field(default=None, max_length=128)


class RoleIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    permissions: dict[str, str] = {}
    rights: list[str] = []


def _validate_grid(permissions: dict, rights: list) -> None:
    for area, level in permissions.items():
        if area not in AREA_KEYS:
            raise HTTPException(400, f"Unknown area '{area}'")
        if level not in LEVELS:
            raise HTTPException(400, f"Unknown level '{level}' for {area}")
    for right in rights:
        if right not in RIGHT_KEYS:
            raise HTTPException(400, f"Unknown right '{right}'")


# =====================================================================
# USERS
# =====================================================================
@router.get("/")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).options(joinedload(User.role)).order_by(User.username).all()
    companies = _companies_of(db, [u.id for u in users])
    return [_user_row(u, companies.get(u.id, [])) for u in users]


@router.post("/")
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(get_current_user)):
    username = normalize_username(payload.username)
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Username must be 3-50 characters: letters, numbers, dot, dash or underscore.")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "That username is already taken.")
    role = _get_role(db, payload.role_id)
    wanted, scope = _validated_company_ids(db, actor, payload.company_ids)

    generated = not payload.temp_password
    password = payload.temp_password or _generate_password()
    problem = validate_new_password(password, username)
    if problem:
        raise HTTPException(400, problem)

    user = User(username=username, full_name=payload.full_name.strip(), password_hash=hash_password(password),
                role_id=role.id, is_active=True, must_change_password=True)
    db.add(user)
    db.flush()
    for cid in sorted(wanted):
        db.add(UserCompanyAccess(user_id=user.id, company_id=cid))
    log_audit(db, actor, "user_created", "user", user.id,
              f"Created user '{username}' with role {role.name}; companies: " + ", ".join(scope[c] for c in sorted(wanted)),
              request)
    db.commit()
    db.refresh(user)
    row = _row(db, user)
    row["temporary_password"] = password if generated else None   # shown ONCE; never stored in plain text
    return row


@router.put("/{user_id}")
def update_user(user_id: int, payload: UserUpdate, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(get_current_user)):
    user = _get_user(db, user_id)
    changes = []
    if payload.full_name is not None and payload.full_name.strip() != user.full_name:
        changes.append(f"name '{user.full_name}' -> '{payload.full_name.strip()}'")
        user.full_name = payload.full_name.strip()
    if payload.role_id is not None and payload.role_id != user.role_id:
        new_role = _get_role(db, payload.role_id)
        changes.append(f"role {user.role.name} -> {new_role.name}")
        user.role_id = new_role.id
        db.flush()
        _require_an_admin_left(db, "You cannot change this role: there must always be at least one active Admin.")
        user = _get_user(db, user_id)
    if payload.company_ids is not None:
        wanted, scope = _validated_company_ids(db, actor, payload.company_ids)
        current = {cid for (cid,) in db.query(UserCompanyAccess.company_id).filter(UserCompanyAccess.user_id == user.id)}
        # companies this admin cannot see (e.g. a deactivated one, or one the admin has no access to) stay as they are
        new_set = wanted | (current - set(scope))
        if user.id == actor.id and request.state.company_id not in new_set:
            raise HTTPException(400, "You cannot remove your own access to the company you are working in.")
        added, removed = new_set - current, current - new_set
        for cid in sorted(added):
            db.add(UserCompanyAccess(user_id=user.id, company_id=cid))
        if removed:
            db.query(UserCompanyAccess).filter(
                UserCompanyAccess.user_id == user.id, UserCompanyAccess.company_id.in_(removed)
            ).delete(synchronize_session=False)
            if user.last_company_id in removed:
                user.last_company_id = None
        # nothing else to do for removal: access is re-checked on EVERY request, so it is blocked at once
        if added:
            changes.append("companies +" + ", ".join(scope[c] for c in sorted(added)))
        if removed:
            changes.append("companies -" + ", ".join(scope[c] for c in sorted(removed)))
    if changes:
        log_audit(db, actor, "user_updated", "user", user.id, f"Updated '{user.username}': " + "; ".join(changes), request)
        db.commit()
    return _row(db, _get_user(db, user_id))


@router.put("/{user_id}/reset-password")
def reset_password(user_id: int, payload: PasswordReset, request: Request, db: Session = Depends(get_db),
                   actor: User = Depends(get_current_user)):
    user = _get_user(db, user_id)
    generated = not payload.temp_password
    password = payload.temp_password or _generate_password()
    problem = validate_new_password(password, user.username)
    if problem:
        raise HTTPException(400, problem)
    user.password_hash = hash_password(password)
    user.must_change_password = True
    user.failed_attempts = 0
    user.locked_until = None
    _revoke_all(db, user.id)
    log_audit(db, actor, "password_reset", "user", user.id, f"Password reset for '{user.username}'", request)
    db.commit()
    row = _row(db, _get_user(db, user_id))
    row["temporary_password"] = password if generated else None
    return row


@router.put("/{user_id}/deactivate")
def deactivate_user(user_id: int, request: Request, db: Session = Depends(get_db),
                    actor: User = Depends(get_current_user)):
    user = _get_user(db, user_id)
    if user.id == actor.id:
        raise HTTPException(400, "You cannot deactivate your own account.")
    user.is_active = False
    _revoke_all(db, user.id)
    db.flush()
    _require_an_admin_left(db, "You cannot deactivate the last active Admin.")
    log_audit(db, actor, "user_deactivated", "user", user_id, f"Deactivated '{user.username}'", request)
    db.commit()
    return _row(db, _get_user(db, user_id))


@router.put("/{user_id}/activate")
def activate_user(user_id: int, request: Request, db: Session = Depends(get_db),
                  actor: User = Depends(get_current_user)):
    user = _get_user(db, user_id)
    user.is_active = True
    log_audit(db, actor, "user_activated", "user", user.id, f"Activated '{user.username}'", request)
    db.commit()
    return _row(db, _get_user(db, user_id))


@router.put("/{user_id}/unlock")
def unlock_user(user_id: int, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(get_current_user)):
    user = _get_user(db, user_id)
    user.locked_until = None
    user.failed_attempts = 0
    log_audit(db, actor, "user_unlocked", "user", user.id, f"Unlocked '{user.username}'", request)
    db.commit()
    return _row(db, _get_user(db, user_id))


@router.put("/{user_id}/sign-out-all")
def sign_out_all_devices(user_id: int, request: Request, db: Session = Depends(get_db),
                         actor: User = Depends(get_current_user)):
    """Revokes every refresh token. The person's current access token still works until it expires
    (max 30 minutes); to cut them off immediately, deactivate the user instead."""
    user = _get_user(db, user_id)
    _revoke_all(db, user.id)
    log_audit(db, actor, "user_signed_out", "user", user.id, f"Signed '{user.username}' out of all devices", request)
    db.commit()
    return {"ok": True}


# =====================================================================
# ROLES
# =====================================================================
@roles_router.get("/meta")
def roles_meta():
    """Everything the permission grid needs to draw itself."""
    return {
        "areas": [{"key": k, "label": label} for k, label in AREAS],
        "rights": [{"key": k, "label": label} for k, label in RIGHTS],
        "levels": LEVELS,
    }


@roles_router.get("/")
def list_roles(db: Session = Depends(get_db)):
    counts = _user_counts(db)
    roles = db.query(Role).options(joinedload(Role.permissions), joinedload(Role.rights)).order_by(Role.id).all()
    return [_role_row(r, counts.get(r.id, 0)) for r in roles]


@roles_router.get("/{role_id}")
def get_role(role_id: int, db: Session = Depends(get_db)):
    role = _get_role(db, role_id)
    return _role_row(role, _user_counts(db).get(role.id, 0))


@roles_router.post("/")
def create_role(payload: RoleIn, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(get_current_user)):
    name = payload.name.strip()
    if db.query(Role).filter(func.lower(Role.name) == name.lower()).first():
        raise HTTPException(400, "A role with that name already exists.")
    _validate_grid(payload.permissions, payload.rights)
    role = Role(name=name, description=(payload.description or "").strip() or None, is_system=False)
    db.add(role)
    db.flush()
    for area in AREA_KEYS:
        db.add(RolePermission(role_id=role.id, area=area, level=payload.permissions.get(area, "none")))
    for right in sorted(set(payload.rights)):
        db.add(RoleRight(role_id=role.id, right_name=right))
    log_audit(db, actor, "role_created", "role", role.id, f"Created role '{name}'", request)
    db.commit()
    db.refresh(role)
    return _role_row(role, 0)


@roles_router.put("/{role_id}")
def update_role(role_id: int, payload: RoleIn, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(get_current_user)):
    role = _get_role(db, role_id)
    if role.is_system and role.name == "Admin":
        raise HTTPException(400, "The Admin role always has full access and cannot be changed.")
    _validate_grid(payload.permissions, payload.rights)

    name = payload.name.strip()
    if role.is_system and name != role.name:
        raise HTTPException(400, "Preset roles cannot be renamed.")
    if db.query(Role).filter(func.lower(Role.name) == name.lower(), Role.id != role.id).first():
        raise HTTPException(400, "A role with that name already exists.")

    changes = []
    if name != role.name:
        changes.append(f"name {role.name} -> {name}")
        role.name = name
    role.description = (payload.description or "").strip() or None

    have = {p.area: p for p in role.permissions}
    for area in AREA_KEYS:
        new_level = payload.permissions.get(area, have[area].level if area in have else "none")
        if area in have:
            if have[area].level != new_level:
                changes.append(f"{area}: {have[area].level} -> {new_level}")
                have[area].level = new_level
        else:
            db.add(RolePermission(role_id=role.id, area=area, level=new_level))
            if new_level != "none":
                changes.append(f"{area}: none -> {new_level}")

    new_rights = set(payload.rights)
    old_rights = {r.right_name for r in role.rights}
    for right in sorted(new_rights - old_rights):
        db.add(RoleRight(role_id=role.id, right_name=right))
        changes.append(f"+{right}")
    for r in list(role.rights):
        if r.right_name not in new_rights:
            db.delete(r)
            changes.append(f"-{r.right_name}")

    db.flush()
    _require_an_admin_left(db, "That change would leave no active Admin. There must always be at least one.")
    log_audit(db, actor, "role_updated", "role", role_id,
              f"Updated role '{name}': " + ("; ".join(changes) if changes else "no permission changes"), request)
    db.commit()
    role = _get_role(db, role_id)
    return _role_row(role, _user_counts(db).get(role.id, 0))


@roles_router.delete("/{role_id}")
def delete_role(role_id: int, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(get_current_user)):
    role = _get_role(db, role_id)
    if role.is_system:
        raise HTTPException(400, "Preset roles cannot be deleted.")
    in_use = db.query(func.count(User.id)).filter(User.role_id == role.id).scalar()
    if in_use:
        raise HTTPException(400, f"{in_use} user(s) still have this role. Move them to another role first.")
    name = role.name
    db.delete(role)
    log_audit(db, actor, "role_deleted", "role", role_id, f"Deleted role '{name}'", request)
    db.commit()
    return {"ok": True}