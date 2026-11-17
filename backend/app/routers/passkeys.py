"""Face unlock / fingerprint sign-in (passkeys, WebAuthn).

File location: app/routers/passkeys.py   (NEW FILE)

How it works
  - The phone keeps a private key behind Face ID / fingerprint. The server stores only the PUBLIC key.
  - Registering a device needs a signed-in user AND their current password.
  - Signing in with a passkey gives exactly the same session as the password login
    (same company rules, same refresh cookie, same audit log).
  - The "challenge" is kept in a short-lived signed token that the browser sends back, so the server
    needs no extra table or memory for it.

Environment variables (set them on Railway):
  WEBAUTHN_ORIGINS  e.g.  https://stdinventorymanagementsystem-production.up.railway.app   (comma separated)
  WEBAUTHN_RP_ID    e.g.  stdinventorymanagementsystem-production.up.railway.app            (domain only)
  WEBAUTHN_RP_NAME  e.g.  ACCOUNTING SYSTEM                                                (optional)
"""
import os
from datetime import timedelta
from urllib.parse import urlparse

import jwt  # PyJWT
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from ..audit import get_client_ip
from ..auth import (
    IS_PRODUCTION, JWT_ALGORITHM, JWT_SECRET, default_company_id, get_current_user, utcnow, verify_password,
)
from ..database import get_public_db
from ..models import PasskeyCredential, User
from ..ratelimit import login_wait_seconds
# the password login and the passkey login must behave the same, so we reuse its helpers
from .auth import GENERIC_LOGIN_ERROR, _error, _register_failure, _session_json, _start_session, log_audit

# NOTE: the prefix MUST stay under /api/auth: the refresh cookie only travels on that path.
router = APIRouter(prefix="/api/auth/passkey", tags=["passkey"])

MAX_PASSKEYS_PER_USER = 10
STATE_MINUTES = 5

# ---------- settings ----------
_LIVE_ORIGIN = "https://stdinventorymanagementsystem-production.up.railway.app"


def _load_origins() -> list[str]:
    raw = os.getenv("WEBAUTHN_ORIGINS", "")
    items = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    if items:
        return items
    if IS_PRODUCTION:
        return [_LIVE_ORIGIN]
    return ["http://localhost:8000", "http://localhost:5173"]


ORIGINS = _load_origins()
RP_ID = os.getenv("WEBAUTHN_RP_ID", "").strip() or (urlparse(ORIGINS[0]).hostname or "localhost")
RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "").strip() or "ACCOUNTING SYSTEM"


# ---------- schemas ----------
class RegisterOptionsRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class RegisterVerifyRequest(BaseModel):
    state: str = Field(min_length=10, max_length=4000)
    credential: dict
    device_name: str | None = Field(default=None, max_length=100)


class LoginVerifyRequest(BaseModel):
    state: str = Field(min_length=10, max_length=4000)
    credential: dict


# ---------- stateless challenge token ----------
def _make_state(kind: str, challenge: bytes, user_id: int | None = None) -> str:
    payload = {
        "typ": kind,
        "ch": bytes_to_base64url(challenge),
        "exp": utcnow() + timedelta(minutes=STATE_MINUTES),
    }
    if user_id is not None:
        payload["uid"] = int(user_id)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _read_state(token: str, kind: str, user_id: int | None = None) -> bytes:
    """Returns the challenge, or raises ValueError (expired / forged / wrong purpose / wrong user)."""
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"require": ["exp"]})
    except jwt.PyJWTError as exc:
        raise ValueError("bad state") from exc
    if data.get("typ") != kind:
        raise ValueError("wrong purpose")
    if user_id is not None and data.get("uid") != int(user_id):
        raise ValueError("wrong user")
    return base64url_to_bytes(data["ch"])


def _not_configured():
    return _error(503, "Login is not configured on the server (JWT_SECRET).")


# ======================================================================================
# register a device (user is signed in)
# ======================================================================================
@router.post("/register/options")
def register_options(payload: RegisterOptionsRequest, request: Request, db: Session = Depends(get_public_db),
                     user: User = Depends(get_current_user)):
    if len(JWT_SECRET) < 32:
        return _not_configured()
    now = utcnow()
    if user.locked_until and user.locked_until > now:
        return _error(423, "Account is locked. Try again later.")

    # extra safety: a stolen / left-open session cannot add a new Face unlock without the password
    if not verify_password(payload.password, user.password_hash):
        _register_failure(db, user, request, "passkey-register")
        log_audit(db, user, "passkey_register_failed", "user", user.id, "Wrong password while adding Face unlock",
                  request, company_id=getattr(request.state, "company_id", None))
        db.commit()
        return _error(400, "Password is incorrect.")

    existing = db.query(PasskeyCredential).filter(PasskeyCredential.user_id == user.id).all()
    if len(existing) >= MAX_PASSKEYS_PER_USER:
        return _error(400, f"You can register at most {MAX_PASSKEYS_PER_USER} devices. Remove one first.")

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(user.id).encode(),
        user_name=user.username,
        user_display_name=user.full_name,
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id)) for c in existing],
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,       # the phone's own Face ID / fingerprint
            resident_key=ResidentKeyRequirement.REQUIRED,                    # lets the login page work without typing a username
            user_verification=UserVerificationRequirement.REQUIRED,          # Face / fingerprint / device PIN must succeed
        ),
    )
    import json
    return {"options": json.loads(options_to_json(options)), "state": _make_state("pk-reg", options.challenge, user.id)}


@router.post("/register/verify")
def register_verify(payload: RegisterVerifyRequest, request: Request, db: Session = Depends(get_public_db),
                    user: User = Depends(get_current_user)):
    if len(JWT_SECRET) < 32:
        return _not_configured()
    try:
        challenge = _read_state(payload.state, "pk-reg", user.id)
    except ValueError:
        return _error(400, "This request expired. Please try again.")

    try:
        verified = verify_registration_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGINS,
            require_user_verification=True,
        )
    except Exception:
        return _error(400, "Could not verify this device. Please try again.")

    credential_id = bytes_to_base64url(verified.credential_id)
    if db.query(PasskeyCredential).filter(PasskeyCredential.credential_id == credential_id).first():
        return _error(400, "This device is already registered.")

    name = (payload.device_name or "").strip()[:100] or "My device"
    transports = (payload.credential.get("response") or {}).get("transports") or []
    db.add(PasskeyCredential(
        user_id=user.id,
        credential_id=credential_id,
        public_key=bytes_to_base64url(verified.credential_public_key),
        sign_count=int(verified.sign_count or 0),
        device_name=name,
        transports=",".join(str(t) for t in transports)[:100] or None,
    ))
    log_audit(db, user, "passkey_added", "user", user.id, f"Face unlock enabled on '{name}'", request,
              company_id=getattr(request.state, "company_id", None))
    db.commit()
    return {"ok": True}


@router.get("/list")
def list_passkeys(db: Session = Depends(get_public_db), user: User = Depends(get_current_user)):
    rows = (db.query(PasskeyCredential).filter(PasskeyCredential.user_id == user.id)
            .order_by(PasskeyCredential.id).all())
    return [{
        "id": r.id,
        "device_name": r.device_name,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
    } for r in rows]


@router.delete("/{passkey_id}")
def delete_passkey(passkey_id: int, request: Request, db: Session = Depends(get_public_db),
                   user: User = Depends(get_current_user)):
    row = db.query(PasskeyCredential).filter(PasskeyCredential.id == passkey_id,
                                             PasskeyCredential.user_id == user.id).first()
    if row is None:
        return _error(404, "Not found.")
    name = row.device_name
    db.delete(row)
    log_audit(db, user, "passkey_removed", "user", user.id, f"Face unlock removed from '{name}'", request,
              company_id=getattr(request.state, "company_id", None))
    db.commit()
    return {"ok": True}


# ======================================================================================
# sign in (nobody is signed in yet)
# ======================================================================================
@router.post("/login/options")
def login_options():
    """Public. No username needed: the phone shows the passkeys it holds for this site."""
    if len(JWT_SECRET) < 32:
        return _not_configured()
    import json
    options = generate_authentication_options(
        rp_id=RP_ID,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    return {"options": json.loads(options_to_json(options)), "state": _make_state("pk-auth", options.challenge)}


@router.post("/login/verify")
def login_verify(payload: LoginVerifyRequest, request: Request, response: Response,
                 db: Session = Depends(get_public_db)):
    if len(JWT_SECRET) < 32:
        return _not_configured()

    wait = login_wait_seconds(get_client_ip(request) or "unknown", "passkey")
    if wait:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Too many login attempts. Please wait {wait} seconds and try again."},
            headers={"Retry-After": str(wait)},
        )

    try:
        challenge = _read_state(payload.state, "pk-auth")
    except ValueError:
        return _error(400, "This request expired. Please try again.")

    credential_id = str(payload.credential.get("id") or "")
    row = db.query(PasskeyCredential).filter(PasskeyCredential.credential_id == credential_id).first()
    if row is None:
        log_audit(db, None, "login_failed", "user", None, "Face unlock with an unknown device", request,
                  username="(passkey)")
        db.commit()
        return _error(401, "This device is not registered for Face unlock. Sign in with your password.")

    user = db.query(User).filter(User.id == row.user_id).first()
    now = utcnow()
    if user is None or not user.is_active:
        log_audit(db, user, "login_blocked_inactive", "user", row.user_id,
                  "Face unlock used but account is deactivated", request)
        db.commit()
        return _error(401, GENERIC_LOGIN_ERROR)
    if user.locked_until and user.locked_until > now:
        minutes = int((user.locked_until - now).total_seconds() // 60) + 1
        log_audit(db, user, "login_blocked_locked", "user", user.id, "Face unlock attempt while account is locked", request)
        db.commit()
        return _error(423, f"Account is locked. Try again in about {minutes} minute(s).")

    # the passkey stores which user it belongs to; it must match the row we found
    handle = (payload.credential.get("response") or {}).get("userHandle")
    if handle:
        try:
            same = base64url_to_bytes(handle) == str(user.id).encode()
        except Exception:
            same = False
        if not same:
            return _error(401, GENERIC_LOGIN_ERROR)

    try:
        verified = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGINS,
            credential_public_key=base64url_to_bytes(row.public_key),
            credential_current_sign_count=int(row.sign_count or 0),
            require_user_verification=True,
        )
    except Exception:
        log_audit(db, user, "login_failed", "user", user.id, "Face unlock could not be verified", request)
        db.commit()
        return _error(401, "Face unlock could not be verified. Sign in with your password.")

    row.sign_count = int(verified.new_sign_count or 0)
    row.last_used_at = now
    user.last_login = now

    company_id = default_company_id(db, user)
    if company_id is None:
        log_audit(db, user, "login_blocked_no_company", "user", user.id, "Face unlock but no company access", request)
        db.commit()
        return _error(403, "You have not been given access to any company. Ask an administrator.")
    user.last_company_id = company_id
    token = _start_session(db, user, request, response, company_id)
    db.commit()
    log_audit(db, user, "login", "user", user.id, f"Logged in with Face unlock ({row.device_name})", request,
              company_id=company_id)
    return _session_json(db, user, token, company_id)