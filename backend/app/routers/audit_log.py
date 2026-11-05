from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog

# Guarded by require_area("users") in main.py, which also needs the manage_users right.
router = APIRouter(prefix="/api/audit", tags=["audit"])


def _row(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "user_id": a.user_id,
        "username": a.username,
        "action": a.action,
        "record_type": a.record_type,
        "record_id": a.record_id,
        "summary": a.summary,
        "ip": a.ip,
    }


@router.get("/filters")
def audit_filters(db: Session = Depends(get_db)):
    """Values for the filter dropdowns on the Audit log screen."""
    record_types = [r[0] for r in db.query(AuditLog.record_type).filter(AuditLog.record_type.isnot(None)).distinct().order_by(AuditLog.record_type)]
    actions = [r[0] for r in db.query(AuditLog.action).distinct().order_by(AuditLog.action)]
    users = [
        {"id": uid, "username": name}
        for uid, name in db.query(AuditLog.user_id, AuditLog.username)
        .filter(AuditLog.username.isnot(None)).distinct().order_by(AuditLog.username)
    ]
    return {"record_types": record_types, "actions": actions, "users": users}


@router.get("/")
def list_audit(
    user_id: int | None = None,
    record_type: str | None = Query(default=None, max_length=50),
    record_id: int | None = None,
    action: str | None = Query(default=None, max_length=50),
    date_from: date | None = None,
    date_to: date | None = None,          # inclusive: the whole of that day is included
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if record_type:
        query = query.filter(AuditLog.record_type == record_type)
    if record_id is not None:
        query = query.filter(AuditLog.record_id == record_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(AuditLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    if q:
        query = query.filter(AuditLog.summary.contains(q, autoescape=True))

    total = query.with_entities(func.count(AuditLog.id)).scalar()
    rows = query.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
    return {"total": total, "limit": limit, "offset": offset, "items": [_row(a) for a in rows]}