import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..audit import get_client_ip, log_audit_company
from ..auth import (
    ACCESS_TOKEN_MINUTES,AUTH_REQUIRED, JWT_SECRET, LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS, REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH, REFRESH_COOKIE_SECURE, REFRESH_TOKEN_HOURS, burn_password_time,
    accessible_companies, create_access_token, default_company_id, get_current_user,get_user_for_switch, has_company_access,
    hash_password, hash_refresh_token, new_refresh_token, normalize_username, oldest_active_company_id,
    password_needs_rehash, refresh_expiry, user_permissions, user_rights, utcnow, validate_new_password, verify_password,
)
from ..database import get_public_db
from ..ratelimit import login_wait_seconds
from ..models import RefreshToken, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

GENERIC_LOGIN_ERROR = "Invalid username or password."


def log_audit(db: Session, user, action, record_type=None, record_id=None, summary=None, request=None,
              username=None, company_id=None):
    """Same call as before, but audit_logs now lives inside a company schema. Login events happen before
    (or outside of) a company session, so the row is written - and committed - in the company this event
    belongs to: the one given, else the user's default company, else (unknown user) the oldest company."""
    if company_id is None:
        company_id = default_company_id(db, user) if user is not None else None
    if company_id is None:
        company_id = oldest_active_company_id(db)
    log_audit_company(company_id, user, action, record_type, record_id, summary, request, username)


# ---------- schemas ----------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)

class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)


class SwitchCompanyRequest(BaseModel):
    company_id: int

# ---------- helpers ----------
def _error(status_code: int, detail: str, clear_cookie: bool = False) -> JSONResponse:
    resp = JSONResponse(status_code=status_code, content={"detail": detail})
    if clear_cookie:
        _clear_cookie(resp)
    return resp


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME, value=token, max_age=REFRESH_TOKEN_HOURS * 3600,
        httponly=True, secure=REFRESH_COOKIE_SECURE, samesite="strict", path=REFRESH_COOKIE_PATH,
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH,
        httponly=True, secure=REFRESH_COOKIE_SECURE, samesite="strict",
    )


def _user_json(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": {"id": user.role.id, "name": user.role.name},
        "must_change_password": bool(user.must_change_password),
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def _companies_json(db: Session, user: User) -> list:
    return [{"id": c.id, "name": c.name} for c in accessible_companies(db, user)]


def _session_json(db: Session, user: User, access_token: str, company_id: int) -> dict:
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
        "must_change_password": bool(user.must_change_password),
        "user": _user_json(user),
        "company_id": company_id,                 # the company this token works in
        "companies": _companies_json(db, user),   # every company the user may enter (for the picker, Phase 3)
    }


def _start_session(db: Session, user: User, request: Request, response: Response, company_id: int,
                   family_id: str | None = None) -> str:
    """Creates a refresh-token row (remembering the company), sets the cookie, returns a new access token."""
    raw = new_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        company_id=company_id,
        token_hash=hash_refresh_token(raw),
        family_id=family_id or str(uuid.uuid4()),
        expires_at=refresh_expiry(),
        revoked=False,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
    ))
    _set_cookie(response, raw)
    return create_access_token(user.id, company_id)


def _revoke_all(db: Session, user_id: int) -> None:
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id, RefreshToken.revoked == False).update(  # noqa: E712
        {"revoked": True}, synchronize_session=False
    )


def _register_failure(db: Session, user: User, request: Request, what: str) -> bool:
    """Counts a wrong password. Returns True if this attempt locked the account."""
    user.failed_attempts = (user.failed_attempts or 0) + 1
    locked = False
    if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        user.failed_attempts = 0
        locked = True
        log_audit(db, user, "account_locked", "user", user.id,
                  f"Locked for {LOCKOUT_MINUTES} minutes after {MAX_FAILED_ATTEMPTS} wrong passwords ({what})", request)
    return locked


# ---------- endpoints ----------

@router.get("/config")
def auth_config():
    """Public. Lets the React app know whether it must show the login page (AUTH_REQUIRED) or run in open mode."""
    return {"auth_required": AUTH_REQUIRED}

@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_public_db)):
    if len(JWT_SECRET) < 32:
        return _error(503, "Login is not configured on the server (JWT_SECRET).")

    username = normalize_username(payload.username)

    # too many tries from this address / for this name: refuse BEFORE the slow password check
    wait = login_wait_seconds(get_client_ip(request) or "unknown", username)
    if wait:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Too many login attempts. Please wait {wait} seconds and try again."},
            headers={"Retry-After": str(wait)},
        )

    user = db.query(User).filter(User.username == username).first()

    if user is None:
        burn_password_time(payload.password)
        log_audit(db, None, "login_failed", "user", None, "Unknown username", request, username=username)
        db.commit()
        return _error(401, GENERIC_LOGIN_ERROR)

    now = utcnow()
    if user.locked_until and user.locked_until > now:
        burn_password_time(payload.password)   # never check the password while locked
        minutes = int((user.locked_until - now).total_seconds() // 60) + 1
        log_audit(db, user, "login_blocked_locked", "user", user.id, "Login attempt while account is locked", request)
        db.commit()
        return _error(423, f"Account is locked. Try again in about {minutes} minute(s).")

    if not verify_password(payload.password, user.password_hash):
        locked = _register_failure(db, user, request, "login")
        log_audit(db, user, "login_failed", "user", user.id, "Wrong password", request)
        db.commit()
        return _error(401, GENERIC_LOGIN_ERROR)

    if not user.is_active:
        log_audit(db, user, "login_blocked_inactive", "user", user.id, "Correct password but account is deactivated", request)
        db.commit()
        return _error(401, GENERIC_LOGIN_ERROR)

    # success
    user.failed_attempts = 0
    user.locked_until = None
    user.last_login = now
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    company_id = default_company_id(db, user)
    if company_id is None:
        log_audit(db, user, "login_blocked_no_company", "user", user.id, "Correct password but no company access", request)
        db.commit()
        return _error(403, "You have not been given access to any company. Ask an administrator.")
    user.last_company_id = company_id
    token = _start_session(db, user, request, response, company_id)
    db.commit()
    log_audit(db, user, "login", "user", user.id, "Logged in", request, company_id=company_id)
    return _session_json(db, user, token, company_id)


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_public_db)):
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw:
        return _error(401, "No session")
    if len(JWT_SECRET) < 32:
        return _error(503, "Login is not configured on the server (JWT_SECRET).")

    row = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_refresh_token(raw)).first()
    if row is None:
        return _error(401, "Session expired", clear_cookie=True)

    user = db.query(User).filter(User.id == row.user_id).first()

    if row.revoked:
        # a rotated/revoked token came back: someone may have copied it -> kill the whole login chain
        db.query(RefreshToken).filter(RefreshToken.family_id == row.family_id).update(
            {"revoked": True}, synchronize_session=False)
        log_audit(db, user, "refresh_reuse_detected", "user", row.user_id,
                  "A used refresh token was presented again; session revoked", request)
        db.commit()
        return _error(401, "Session expired", clear_cookie=True)

    if row.expires_at <= utcnow() or user is None or not user.is_active:
        row.revoked = True
        db.commit()
        return _error(401, "Session expired", clear_cookie=True)

    # rotate: the UPDATE only succeeds for the first request that uses this token
    won = db.query(RefreshToken).filter(RefreshToken.id == row.id, RefreshToken.revoked == False).update(  # noqa: E712
        {"revoked": True}, synchronize_session=False)
    if won != 1:
        db.rollback()
        return _error(401, "Session expired", clear_cookie=True)

    # keep the company through rotation, unless the user lost access to it meanwhile
    company_id = row.company_id if row.company_id and has_company_access(db, user.id, row.company_id) else default_company_id(db, user)
    if company_id is None:
        db.commit()   # the old token stays revoked
        return _error(403, "You have not been given access to any company. Ask an administrator.", clear_cookie=True)
    token = _start_session(db, user, request, response, company_id, family_id=row.family_id)
    db.commit()
    return _session_json(db, user, token, company_id)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_public_db)):
    """Ends this device's session. Needs no access token, so it still works after the token expired."""
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw:
        row = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_refresh_token(raw)).first()
        if row is not None:
            row.revoked = True
            user = db.query(User).filter(User.id == row.user_id).first()
            log_audit(db, user, "logout", "user", row.user_id, "Logged out", request)
            db.commit()
    _clear_cookie(response)
    return {"ok": True}


@router.post("/logout-all")
def logout_all(request: Request, response: Response, db: Session = Depends(get_public_db), user: User = Depends(get_current_user)):
    _revoke_all(db, user.id)
    log_audit(db, user, "logout_all", "user", user.id, "Signed out of all devices", request)
    db.commit()
    _clear_cookie(response)
    return {"ok": True}

@router.post("/switch-company")
def switch_company(payload: SwitchCompanyRequest, request: Request, db: Session = Depends(get_public_db),
                   ctx=Depends(get_user_for_switch)):
    """Enter another company: checks access, remembers it as the user's last-used company, keeps it on this
    device's refresh token (so it survives rotation) and returns a NEW access token for that company."""
    user, old_company_id = ctx
    if user.must_change_password:
        return _error(403, "PASSWORD_CHANGE_REQUIRED")
    old_ok = has_company_access(db, user.id, old_company_id)      # False if the old company was just taken away
    new_company_id = payload.company_id
    if not has_company_access(db, user.id, new_company_id):
        log_audit(db, user, "switch_company_denied", "company", new_company_id,
                  f"Tried to enter company #{new_company_id} without access", request,
                  company_id=old_company_id if old_ok else None)
        return _error(403, "NO_COMPANY_ACCESS")

    user.last_company_id = new_company_id
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw:
        row = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_refresh_token(raw),
                                            RefreshToken.user_id == user.id, RefreshToken.revoked == False).first()  # noqa: E712
        if row is not None:
            row.company_id = new_company_id
    token = create_access_token(user.id, new_company_id)
    db.commit()
    if old_ok and new_company_id != old_company_id:
        log_audit(db, user, "company_left", "company", old_company_id,
                  f"Switched to company #{new_company_id}", request, company_id=old_company_id)
    log_audit(db, user, "company_entered", "company", new_company_id,
              f"Entered this company (from company #{old_company_id})", request, company_id=new_company_id)
    return _session_json(db, user, token, new_company_id)


@router.get("/me")
def me(request: Request, db: Session = Depends(get_public_db), user: User = Depends(get_current_user)):
    data = _user_json(user)
    data["permissions"] = user_permissions(user)
    data["rights"] = user_rights(user)
    data["company_id"] = request.state.company_id
    data["companies"] = _companies_json(db, user)
    return data


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, request: Request, response: Response,
                    db: Session = Depends(get_public_db), user: User = Depends(get_current_user)):
    now = utcnow()
    if user.locked_until and user.locked_until > now:
        return _error(423, "Account is locked. Try again later.")

    if not verify_password(payload.current_password, user.password_hash):
        _register_failure(db, user, request, "change-password")
        log_audit(db, user, "password_change_failed", "user", user.id, "Wrong current password", request)
        db.commit()
        return _error(400, "Current password is incorrect.")

    problem = validate_new_password(payload.new_password, user.username)
    if problem:
        return _error(400, problem)
    if payload.new_password == payload.current_password:
        return _error(400, "New password must be different from the current password.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.failed_attempts = 0
    _revoke_all(db, user.id)                         # every other device is signed out
    company_id = request.state.company_id
    token = _start_session(db, user, request, response, company_id)   # this device gets a fresh session
    log_audit(db, user, "password_changed", "user", user.id, "Password changed", request, company_id=company_id)
    db.commit()
    return _session_json(db, user, token, company_id)



@router.put("/profile")
def update_profile(payload: ProfileUpdate, request: Request, db: Session = Depends(get_public_db),
                   user: User = Depends(get_current_user)):
    """A user can change only their own display name here (role/username/active are Admin-only)."""
    name = payload.full_name.strip()
    if not name:
        return _error(400, "Name cannot be empty.")
    if name != user.full_name:
        log_audit(db, user, "profile_updated", "user", user.id, f"Name '{user.full_name}' -> '{name}'", request)
        user.full_name = name
        db.commit()
    data = _user_json(user)
    data["permissions"] = user_permissions(user)
    data["rights"] = user_rights(user)
    return data