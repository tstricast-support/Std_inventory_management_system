"""Backup & restore of company data.

Same rules as companies.py: not guarded by require_area(); every endpoint checks login + company access through
get_user_and_company(), and everything needs the special right 'manage_companies'.

  GET    /api/backups/settings            schedule of the CURRENT company
  PUT    /api/backups/settings            change it (off / weekly / monthly)
  GET    /api/backups                     backups of the current company + backups of companies that were deleted
  POST   /api/backups                     back up the current company now
  GET    /api/backups/{id}/download       the backup as a file (keep a copy off the server!)
  DELETE /api/backups/{id}
  POST   /api/backups/{id}/restore        restore from a saved backup   (body: {"confirm": "restore <name>"})
  POST   /api/backups/inspect-upload      read a backup FILE and say what it contains (nothing is changed)
  POST   /api/backups/restore-upload      restore from a backup FILE    (form: file + confirm)
"""
import logging
import re
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import backup_service as svc
from ..audit import log_audit_company
from ..auth import get_user_and_company, user_rights
from ..database import get_public_db
from ..models import Company, CompanyBackup, CompanyBackupSetting, UserCompanyAccess
from ..permissions import SUPER_ADMIN_ROLE

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/backups", tags=["backups"])


# ---------- helpers ----------
def _require_manage(user) -> None:
    if user is None:
        raise HTTPException(403, "Please log in to manage backups.")
    if user.must_change_password:
        raise HTTPException(403, "PASSWORD_CHANGE_REQUIRED")
    if "manage_companies" not in user_rights(user):
        raise HTTPException(403, "This needs the special right 'manage_companies'")


def _access_ids(b: CompanyBackup) -> list:
    import json
    try:
        return [int(x) for x in json.loads(b.access_user_ids or "[]")]
    except (ValueError, TypeError):
        return []


def _can_use(db: Session, user, b: CompanyBackup) -> bool:
    """A backup of a company that still exists: you need access to that company.
    A backup of a company that was deleted: you were allowed to enter it back then, or you are a Super Admin."""
    if db.query(Company.id).filter(Company.id == b.company_id).first():
        return db.query(UserCompanyAccess.id).filter(
            UserCompanyAccess.user_id == user.id, UserCompanyAccess.company_id == b.company_id).first() is not None
    if user.id in _access_ids(b):
        return True
    return bool(user.role and user.role.name == SUPER_ADMIN_ROLE)


def _get_backup(db: Session, user, backup_id: int) -> CompanyBackup:
    b = db.get(CompanyBackup, backup_id)
    if b is None or not _can_use(db, user, b):
        raise HTTPException(404, "Backup not found")
    return b


def _settings_json(s: CompanyBackupSetting | None) -> dict:
    s = s or CompanyBackupSetting(frequency="off", weekday=0, month_day=1, run_hour=2, keep_count=svc.DEFAULT_KEEP)
    return {
        "frequency": s.frequency, "weekday": s.weekday, "month_day": s.month_day, "run_hour": s.run_hour,
        "keep_count": s.keep_count,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "last_status": s.last_status, "last_error": s.last_error,
        "timezone": svc.timezone_name(),
    }


def _fail(e: Exception):
    if isinstance(e, svc.BackupBusy):
        raise HTTPException(409, str(e))
    if isinstance(e, svc.BackupError):
        raise HTTPException(400, str(e))
    log.exception("backup operation failed")
    raise HTTPException(500, "The backup operation failed. See the server log.")


def _safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", s or "company").strip("_")[:40] or "company"


# ---------- schedule ----------
class SettingsIn(BaseModel):
    frequency: Literal["off", "weekly", "monthly"]
    weekday: int = Field(0, ge=0, le=6)           # 0 = Monday
    month_day: int = Field(1, ge=1, le=28)        # capped at 28 so every month has that day
    run_hour: int = Field(2, ge=0, le=23)
    keep_count: int = Field(svc.DEFAULT_KEEP, ge=1, le=60)


@router.get("/settings")
def get_settings(db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    user, company_id = ctx
    _require_manage(user)
    return _settings_json(db.get(CompanyBackupSetting, company_id))


@router.put("/settings")
def put_settings(payload: SettingsIn, request: Request, db: Session = Depends(get_public_db),
                 ctx=Depends(get_user_and_company)):
    user, company_id = ctx
    _require_manage(user)
    s = db.get(CompanyBackupSetting, company_id)
    if s is None:
        s = CompanyBackupSetting(company_id=company_id)
        db.add(s)
    s.frequency, s.weekday, s.month_day = payload.frequency, payload.weekday, payload.month_day
    s.run_hour, s.keep_count, s.updated_by_id = payload.run_hour, payload.keep_count, user.id
    s.next_run_at = svc.compute_next_run(s.frequency, s.weekday, s.month_day, s.run_hour)
    db.commit()
    result = _settings_json(s)
    log_audit_company(company_id, user, "backup_settings_changed", "company", company_id,
                      f"Automatic backups set to: {payload.frequency}", request)
    return result


# ---------- list / create ----------
@router.get("")
def list_backups(db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    user, company_id = ctx
    _require_manage(user)
    mine = (db.query(CompanyBackup).filter(CompanyBackup.company_id == company_id)
            .order_by(CompanyBackup.created_at.desc(), CompanyBackup.id.desc()).limit(200).all())
    gone = (db.query(CompanyBackup)
            .filter(~CompanyBackup.company_id.in_(db.query(Company.id)))
            .order_by(CompanyBackup.created_at.desc(), CompanyBackup.id.desc()).limit(200).all())
    return {
        "backups": [svc.backup_to_json(b) for b in mine],
        "deleted_companies": [svc.backup_to_json(b) for b in gone if _can_use(db, user, b)],
    }


@router.post("")
def backup_now(request: Request, db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    user, company_id = ctx
    _require_manage(user)
    uid, uname = user.id, user.username
    db.rollback()
    try:
        summary = svc.create_backup(company_id, "manual", uid, uname)
    except Exception as e:
        _fail(e)
    log_audit_company(company_id, user, "backup_created", "company", company_id,
                      f"Backup #{summary['id']} created ({summary['row_count']} records)", request, username=uname)
    return summary


# ---------- download / delete ----------
@router.get("/{backup_id}/download")
def download_backup(backup_id: int, request: Request, db: Session = Depends(get_public_db),
                    ctx=Depends(get_user_and_company)):
    user, current_id = ctx
    _require_manage(user)
    b = _get_backup(db, user, backup_id)
    data = bytes(b.data)
    stamp = b.created_at.strftime("%Y%m%d_%H%M%S") if b.created_at else "backup"
    fname = f"{_safe_name(b.company_name)}_co{b.company_id}_{stamp}.stdbackup.gz"
    log_audit_company(current_id, user, "backup_downloaded", "company", b.company_id,
                      f"Backup #{b.id} of '{b.company_name}' downloaded", request)
    return Response(content=data, media_type="application/gzip",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.delete("/{backup_id}")
def delete_backup(backup_id: int, request: Request, db: Session = Depends(get_public_db),
                  ctx=Depends(get_user_and_company)):
    user, current_id = ctx
    _require_manage(user)
    b = _get_backup(db, user, backup_id)
    info = f"Backup #{b.id} of '{b.company_name}' ({b.kind}) deleted"
    db.delete(b)
    db.commit()
    log_audit_company(current_id, user, "backup_deleted", "company", b.company_id, info, request)
    return {"deleted": backup_id}


# ---------- restore ----------
class RestoreIn(BaseModel):
    confirm: str = Field(max_length=300)          # must be exactly:  restore <company name>


def _finish_restore(request: Request, user, result: dict, current_id: int, source: str) -> dict:
    log_audit_company(result["company_id"], user, "company_restored", "company", result["company_id"],
                      f"Company '{result['company_name']}' restored from {source} "
                      f"({result['rows']} records)", request)
    result["is_current"] = result["company_id"] == current_id
    return result


@router.post("/{backup_id}/restore")
def restore_backup(backup_id: int, payload: RestoreIn, request: Request, db: Session = Depends(get_public_db),
                   ctx=Depends(get_user_and_company)):
    """Replaces ALL data of that company with the backup. There is a safety copy of what is replaced
    (kind 'pre_restore'), but it is still a big step, so the name must be typed."""
    user, current_id = ctx
    _require_manage(user)
    b = _get_backup(db, user, backup_id)
    expected = f"restore {b.company_name}"
    if (payload.confirm or "").strip() != expected:
        raise HTTPException(400, f"To confirm, type exactly: {expected}")
    import hashlib
    data = bytes(b.data)
    if hashlib.sha256(data).hexdigest() != b.sha256:
        raise HTTPException(400, "This stored backup is damaged (its checksum does not match). "
                                 "Use another backup.")
    uid, uname, source = user.id, user.username, f"backup #{b.id}"
    db.rollback()                                  # end the read transaction so it cannot block the DROP SCHEMA
    try:
        result = svc.restore_company(data, uid, uname)
    except Exception as e:
        _fail(e)
    return _finish_restore(request, user, result, current_id, source)


MAX_FILE_BYTES = 100 * 1024 * 1024


def _read_upload(upload: UploadFile) -> bytes:
    data = upload.file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(413, "The file is too large (max 100 MB).")
    return data


def _check_upload_target(db: Session, user, header: dict):
    """A file may re-create a company that no longer exists. If the company exists, you must have access to it."""
    cid = int(header["company"]["id"])
    current = db.get(Company, cid)
    if current is not None and db.query(UserCompanyAccess.id).filter(
            UserCompanyAccess.user_id == user.id, UserCompanyAccess.company_id == cid).first() is None:
        raise HTTPException(403, "This backup belongs to a company you cannot enter.")
    return current


@router.post("/inspect-upload")
def inspect_upload(file: UploadFile = File(...), db: Session = Depends(get_public_db),
                   ctx=Depends(get_user_and_company)):
    """Looks inside a backup file (changes nothing) so the screen can show what would be restored."""
    user, _ = ctx
    _require_manage(user)
    data = _read_upload(file)
    try:
        header = svc.read_header(data)
    except svc.BackupError as e:
        raise HTTPException(400, str(e))
    current = _check_upload_target(db, user, header)
    comp = header["company"]
    return {
        "company_id": int(comp["id"]), "company_name": comp["name"], "created_at": header.get("created_at"),
        "exists_now": current is not None, "current_name": current.name if current else None,
        "confirm_text": f"restore {comp['name']}",
    }


@router.post("/restore-upload")
def restore_upload(request: Request, file: UploadFile = File(...), confirm: str = Form(...),
                   db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    user, current_id = ctx
    _require_manage(user)
    data = _read_upload(file)
    try:
        header = svc.read_header(data)
    except svc.BackupError as e:
        raise HTTPException(400, str(e))
    _check_upload_target(db, user, header)
    expected = f"restore {header['company']['name']}"
    if (confirm or "").strip() != expected:
        raise HTTPException(400, f"To confirm, type exactly: {expected}")
    uid, uname = user.id, user.username
    db.rollback()
    try:
        result = svc.restore_company(data, uid, uname)
    except Exception as e:
        _fail(e)
    return _finish_restore(request, user, result, current_id, "an uploaded file")