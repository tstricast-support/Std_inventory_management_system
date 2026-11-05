"""Core auth helpers: settings, password hashing (argon2id), JWT access tokens, refresh-token helpers.

Phase 1 only has the building blocks. get_current_user / require_area are added in Phase 3.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt  # PyJWT
from fastapi import Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from dotenv import load_dotenv

from app.audit import get_client_ip, request_ctx
from app.database import SessionLocal, get_db

load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# ---- settings (all from environment) ------------------------------------------------------
ENV = os.getenv("ENV", "development").strip().lower()          # "production" turns the strict settings on
IS_PRODUCTION = ENV == "production"

# False = checks are skipped (code deployed but not enforced). Flip to true when you are ready.
AUTH_REQUIRED = _env_bool("AUTH_REQUIRED", False)

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 30
REFRESH_TOKEN_HOURS = 12

# Secure cookie flag. Defaults to ON in production and OFF otherwise, so local http://localhost still works.
REFRESH_COOKIE_SECURE = _env_bool("REFRESH_COOKIE_SECURE", IS_PRODUCTION)
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 128


def utcnow() -> datetime:
    """Naive UTC 'now' (matches the TIMESTAMP columns, which carry no timezone)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_username(username: str) -> str:
    """Usernames are stored lower-case, so 'Ali' and 'ali' are the same person."""
    return (username or "").strip().lower()


def validate_auth_settings() -> None:
    """Called once at startup. Stops the app if enforcement is on but JWT is not configured safely."""
    problems = []
    if AUTH_REQUIRED and len(JWT_SECRET) < 32:
        problems.append("JWT_SECRET must be set to a random string of at least 32 characters when AUTH_REQUIRED=true.")
    if IS_PRODUCTION and not REFRESH_COOKIE_SECURE:
        print("WARNING: ENV=production but REFRESH_COOKIE_SECURE is off. The refresh cookie will be sent over plain http.")
    if problems:
        raise RuntimeError("AUTH CONFIG ERROR: " + " ".join(problems))
    if not AUTH_REQUIRED:
        print("AUTH: AUTH_REQUIRED=false - login is not enforced. All routes stay open until you set AUTH_REQUIRED=true.")
        if len(JWT_SECRET) < 32:
            print("AUTH: JWT_SECRET is missing or shorter than 32 chars - the login endpoint will refuse to issue tokens until you set it.")


# ---- passwords (argon2id) -----------------------------------------------------------------
_ph = PasswordHasher(type=Type.ID)   # argon2id with the library's current recommended cost settings
_DUMMY_HASH = _ph.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def burn_password_time(password: str) -> None:
    """Call when the username does not exist, so 'no such user' takes as long as 'wrong password'."""
    verify_password(password, _DUMMY_HASH)


def password_needs_rehash(password_hash: str) -> bool:
    return _ph.check_needs_rehash(password_hash)


def validate_new_password(password: str, username: str) -> str | None:
    """Returns an error message, or None if the password is acceptable."""
    if password is None or len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    if len(password) > MAX_PASSWORD_LENGTH:
        return f"Password must be at most {MAX_PASSWORD_LENGTH} characters."
    if password.strip().lower() == normalize_username(username):
        return "Password must not be the same as the username."
    return None


# ---- access tokens (JWT, 30 min) ----------------------------------------------------------
class TokenError(Exception):
    pass


def create_access_token(user_id: int) -> str:
    if len(JWT_SECRET) < 32:
        raise RuntimeError("JWT_SECRET is not set (min 32 characters). Cannot issue tokens.")
    now = utcnow().replace(tzinfo=timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Returns the user id, or raises TokenError. Only HS256 is accepted."""
    if len(JWT_SECRET) < 32:
        raise TokenError("server not configured")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"require": ["exp", "sub"]})
        if data.get("typ") != "access":
            raise TokenError("wrong token type")
        return int(data["sub"])
    except (jwt.PyJWTError, ValueError) as exc:
        raise TokenError(str(exc)) from exc


# ---- refresh tokens (opaque, stored hashed) -----------------------------------------------
def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    # The token is 384 random bits, so a plain SHA-256 is enough (no salt / slow hash needed).
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_expiry() -> datetime:
    return utcnow() + timedelta(hours=REFRESH_TOKEN_HOURS)


# ---- who is calling? ----------------------------------------------------------------------
_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail,
                         headers={"WWW-Authenticate": "Bearer"})


def _resolve_user(db: Session, creds: HTTPAuthorizationCredentials | None):
    """Returns the active user behind a bearer token, or None (never raises)."""
    from app.models import Role, User  # local import: models must not depend on auth

    if creds is None or creds.scheme.lower() != "bearer":
        return None
    try:
        user_id = decode_access_token(creds.credentials)
    except TokenError:
        return None
    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions), joinedload(User.role).joinedload(Role.rights))
        .filter(User.id == user_id)
        .first()
    )
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """Identity check used by the /api/auth endpoints (always enforced).
    Re-reads the user from the DB on EVERY request, so deactivating a user blocks them at once."""
    if creds is None:
        raise _unauthorized()
    user = _resolve_user(db, creds)
    if user is None:
        raise _unauthorized("Invalid or expired token")
    return user


def user_permissions(user) -> dict:
    """{area: level} for every area (missing = 'none')."""
    from app.permissions import AREA_KEYS

    have = {p.area: p.level for p in user.role.permissions}
    return {a: have.get(a, "none") for a in AREA_KEYS}


def user_rights(user) -> list:
    return sorted(r.right_name for r in user.role.rights)


# ---- permission check for every business route -------------------------------------------
def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _authorize(area: str, method: str, route_path: str, creds):
    """Runs in a worker thread. Returns (user_id, username) or (None, None) when auth is off and nobody is logged in."""
    from app.permissions import (
        AREA_ALL_RIGHT, AREA_READ_RIGHT, ALWAYS_ENFORCED_AREAS, LOOKUP_READS, METHOD_LEVEL, ROUTE_OVERRIDES, level_allows,
    )

    db = SessionLocal()
    try:
        user = _resolve_user(db, creds)

        if not AUTH_REQUIRED and area not in ALWAYS_ENFORCED_AREAS:   # switch is off: nothing is blocked, but remember who it was
            return (user.id, user.username) if user else (None, None)

        if user is None:
            raise _unauthorized()
        if user.must_change_password:
            raise _forbidden("PASSWORD_CHANGE_REQUIRED")

        perms = user_permissions(user)
        rights = set(user_rights(user))

        method = method.upper()
        if method not in METHOD_LEVEL:
            raise _forbidden("Method not allowed for your role")
        need_level = METHOD_LEVEL[method]
        need_right = None

        if (method, route_path) in ROUTE_OVERRIDES:
            need_level, need_right = ROUTE_OVERRIDES[(method, route_path)]
        elif route_path.endswith("/void"):
            need_level, need_right = "full", "void_transactions"
        elif method == "DELETE":
            need_level, need_right = "full", "delete_records"
        elif method in ("GET", "HEAD") and area in AREA_READ_RIGHT:
            need_right = AREA_READ_RIGHT[area]
        if need_right is None and area in AREA_ALL_RIGHT:
            need_right = AREA_ALL_RIGHT[area]

        if not level_allows(perms.get(area, "none"), need_level):
            lookup_ok = method in ("GET", "HEAD") and any(
                level_allows(perms.get(a, "none"), "view") for a in LOOKUP_READS.get(route_path, [])
            )
            if not lookup_ok:
                raise _forbidden("You do not have permission to do this")
        if need_right and need_right not in rights:
            raise _forbidden(f"This needs the special right '{need_right}'")
        return user.id, user.username
    finally:
        db.close()


def require_area(area: str):
    """Dependency for a whole router: maps GET/POST/PUT/DELETE (and /void) to the level or right needed.
    With AUTH_REQUIRED=false it lets everything through. Missing/bad token = 401, not allowed = 403."""
    async def dependency(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(_bearer)):
        route = request.scope.get("route")
        route_path = getattr(route, "path", request.url.path)
        user_id, username = await run_in_threadpool(_authorize, area, request.method, route_path, creds)

        method = request.method.upper()
        if route_path.endswith("/void"):
            action = "void"
        elif method == "DELETE":
            action = "delete"
        elif method == "POST":
            action = "create"
        else:
            action = "update"
        # set here (in the request's own task) so the endpoint's worker thread and the DB hooks can see it
        request_ctx.set({
            "user_id": user_id, "username": username, "ip": get_client_ip(request),
            "method": method, "route": route_path, "action": action,
        })
    return dependency