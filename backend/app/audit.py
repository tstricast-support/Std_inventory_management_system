"""Audit helper. Call log_audit() wherever something should be remembered."""
import logging
import os
from contextvars import ContextVar

from fastapi import Request

from app.models import AuditLog
from app.database import company_session

log = logging.getLogger(__name__)

# Behind a proxy (Railway, nginx) the real client IP is in X-Forwarded-For. Only trust it if you set this.
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").strip().lower() in ("1", "true", "yes", "on")


# Filled in by require_area() for every request: {"user_id", "username", "ip", "method", "route", "action"}.
# audit_events.py reads it to stamp created_by_id and to write audit rows without touching the routers.
request_ctx: ContextVar = ContextVar("request_ctx", default=None)


def get_client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    if TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


def log_audit(db, user, action, record_type=None, record_id=None, summary=None, request=None, username=None):
    """Adds one AuditLog row to the session. It does NOT commit: it is saved together with the
    caller's own commit, so a rolled-back change leaves no log line. (Auth events commit themselves.)
    `user` may be None (e.g. failed login); then pass `username` if you know it."""
    name = username or getattr(user, "username", None)
    row = AuditLog(
        user_id=getattr(user, "id", None),
        username=name[:100] if name else None,
        action=action[:50],
        record_type=record_type,
        record_id=record_id,
        summary=(summary[:2000] if summary else None),
        ip=get_client_ip(request),
    )
    db.add(row)
    return row

def log_audit_company(company_id, user, action, record_type=None, record_id=None, summary=None, request=None, username=None):
    """Writes ONE audit row straight into a company's audit_logs and commits it on its own.
    For events outside a company session (login, logout, refresh, switch-company).
    A failing audit write must never lock people out, so it is logged and swallowed."""
    if company_id is None:
        return
    db = company_session(company_id)
    try:
        log_audit(db, user, action, record_type, record_id, summary, request, username)
        db.commit()
    except Exception:
        db.rollback()
        log.exception("audit write failed (company %s, action %s)", company_id, action)
    finally:
        db.close()