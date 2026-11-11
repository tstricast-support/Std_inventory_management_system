"""Companies ("company files"): list the ones I may enter, create / rename / (de)activate, profile and logo.

Not guarded by require_area(): every endpoint checks login + company access through get_user_and_company(),
and everything that changes a company also needs the special right 'manage_companies'.
Only shared tables (schema public) are used here, so these endpoints work on a PUBLIC session.
Roles stay global (one role per user for all companies); per-company roles could be added later.
"""
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from ..audit import log_audit_company
from ..auth import get_user_and_company, user_rights
from ..company_init import init_company_schema
from ..database import engine, get_public_db, quote_schema, schema_for
from ..imagekit_client import delete_image, upload_image
from ..models import Company, UserCompanyAccess
from ..upload_checks import validate_image

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["companies"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- payloads ----------
class CompanyIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address_lines: Optional[str] = None      # one address line per text line
    phone: Optional[str] = None
    email: Optional[str] = None
    invoice_footer: Optional[str] = None


class CompanyUpdate(CompanyIn):
    is_active: Optional[bool] = None         # only used by PUT /companies/{id}


# ---------- helpers ----------
def _text(value, limit: int, label: str, required: bool = False):
    value = (value or "").strip()
    if required and not value:
        raise HTTPException(400, f"{label} is required.")
    if len(value) > limit:
        raise HTTPException(400, f"{label} is too long (max {limit} characters).")
    return value or None


def _address(value):
    lines = [ln.strip() for ln in (value or "").replace("\r", "").split("\n") if ln.strip()]
    if len(lines) > 8 or sum(len(ln) for ln in lines) > 600:
        raise HTTPException(400, "Address is too long (max 8 lines, 600 characters).")
    return "\n".join(lines) or None


def _apply(company: Company, p: CompanyIn) -> None:
    company.name = _text(p.name, 150, "Company name", required=True)
    company.address_lines = _address(p.address_lines)
    company.phone = _text(p.phone, 50, "Phone")
    email = _text(p.email, 150, "Email")
    if email and not EMAIL_RE.match(email):
        raise HTTPException(400, "Email address is not valid.")
    company.email = email
    company.invoice_footer = _text(p.invoice_footer, 2000, "Invoice footer")


def _json(c: Company) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "address_lines": c.address_lines or "",
        "phone": c.phone or "",
        "email": c.email or "",
        "logo_url": c.logo_url,
        "invoice_footer": c.invoice_footer or "",
        "is_active": bool(c.is_active),
    }


def _require_manage(user) -> None:
    if user is None:
        raise HTTPException(403, "Please log in to manage companies.")
    if user.must_change_password:
        raise HTTPException(403, "PASSWORD_CHANGE_REQUIRED")
    if "manage_companies" not in user_rights(user):
        raise HTTPException(403, "This needs the special right 'manage_companies'")


def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    q = db.query(Company.id).filter(func.lower(Company.name) == name.lower())
    if exclude_id is not None:
        q = q.filter(Company.id != exclude_id)
    return q.first() is not None


def _managed_company(db: Session, user, company_id: int) -> Company:
    """A company the user has an access row for (active or not, so it can be re-activated)."""
    company = (
        db.query(Company)
        .join(UserCompanyAccess, UserCompanyAccess.company_id == Company.id)
        .filter(UserCompanyAccess.user_id == user.id, Company.id == company_id)
        .first()
    )
    if company is None:
        raise HTTPException(404, "Company not found")
    return company


def _schema_exists(schema: str) -> bool:
    with engine.connect() as c:
        return c.execute(text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"),
                         {"s": schema}).first() is not None


def _drop_schema(schema: str) -> None:
    """Only ever called for a schema this request itself just created (id came fresh from the sequence)."""
    try:
        with engine.begin() as c:
            c.execute(text(f"DROP SCHEMA IF EXISTS {quote_schema(schema)} CASCADE"))
    except Exception:
        log.exception("could not drop half-built schema %s", schema)


# ---------- list ----------
@router.get("/companies")
def list_companies(include_inactive: bool = False, db: Session = Depends(get_public_db),
                   ctx=Depends(get_user_and_company)):
    """Companies I may enter (for the switcher). include_inactive=true (needs manage_companies) also lists
    deactivated ones, so they can be re-activated."""
    user, company_id = ctx
    if user is None:     # open mode, nobody logged in: just the one company everything runs in
        rows = db.query(Company).filter(Company.id == company_id).all()
    else:
        q = (db.query(Company).join(UserCompanyAccess, UserCompanyAccess.company_id == Company.id)
             .filter(UserCompanyAccess.user_id == user.id))
        if include_inactive:
            _require_manage(user)
        else:
            q = q.filter(Company.is_active == True)  # noqa: E712
        rows = q.order_by(Company.id).all()
    return [{**_json(c), "current": c.id == company_id} for c in rows]


# ---------- create ----------
@router.post("/companies")
def create_company(payload: CompanyIn, request: Request, db: Session = Depends(get_public_db),
                   ctx=Depends(get_user_and_company)):
    user, _ = ctx
    _require_manage(user)
    company = Company(is_active=True)
    _apply(company, payload)
    if _name_taken(db, company.name):
        raise HTTPException(400, "A company with that name already exists.")
    user_id, username = user.id, user.username

    db.add(company)
    db.flush()                                   # gets the id; nothing is committed yet
    new_id = company.id
    schema = schema_for(new_id)                  # co_<integer id>, never built from user text
    pre_existing = False
    try:
        if _schema_exists(schema):               # never touch (or drop) something that was already there
            pre_existing = True
            raise RuntimeError(f"schema {schema} already exists")
        init_company_schema(schema)              # ONE transaction: schema + tables + column upgrades + seeds
        db.add(UserCompanyAccess(user_id=user_id, company_id=new_id))   # the creator may enter it
        db.commit()
    except Exception:
        db.rollback()                            # the company row disappears
        if not pre_existing:
            _drop_schema(schema)                 # and so does any half-built schema
        log.exception("company creation failed (id %s)", new_id)
        raise HTTPException(500, "Could not create the company. Nothing was saved.")

    log_audit_company(new_id, user, "company_created", "company", new_id,
                      f"Company '{company.name}' created by {username}", request, username=username)
    return _json(company)


# ---------- rename / edit / (de)activate ----------
def _save_company(db: Session, request: Request, user, company: Company, payload: CompanyIn,
                  new_active: Optional[bool]) -> dict:
    old_name, was_active = company.name, bool(company.is_active)
    _apply(company, payload)
    if _name_taken(db, company.name, exclude_id=company.id):
        raise HTTPException(400, "A company with that name already exists.")

    events = []
    if new_active is not None and new_active != was_active:
        if not new_active:
            other = db.query(Company.id).filter(Company.is_active == True,  # noqa: E712
                                                Company.id != company.id).first()
            if other is None:
                raise HTTPException(400, "You cannot deactivate the last active company.")
            events.append(("company_deactivated", f"Company '{company.name}' deactivated"))
        else:
            try:
                init_company_schema(schema_for(company.id))   # bring an old schema up to date before use
            except Exception:
                log.exception("re-activation failed for company %s", company.id)
                raise HTTPException(500, "Could not re-activate the company.")
            events.append(("company_activated", f"Company '{company.name}' re-activated"))
        company.is_active = new_active
    if company.name != old_name:
        events.append(("company_renamed", f"Company renamed '{old_name}' -> '{company.name}'"))
    if not events:
        events.append(("company_updated", f"Company profile of '{company.name}' edited"))

    db.commit()
    for action, summary in events:
        log_audit_company(company.id, user, action, "company", company.id, summary, request)
    return _json(company)


@router.put("/companies/{company_id}")
def update_company(company_id: int, payload: CompanyUpdate, request: Request,
                   db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    user, _ = ctx
    _require_manage(user)
    company = _managed_company(db, user, company_id)
    return _save_company(db, request, user, company, payload, payload.is_active)

# ---------- delete (PERMANENT) ----------
class DeleteCompanyIn(BaseModel):
    confirm: str = Field(max_length=300)      # must be exactly:  delete <company name>


@router.post("/companies/{company_id}/delete")
def delete_company(company_id: int, payload: DeleteCompanyIn, request: Request,
                   db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    """Permanently deletes ONE company: its whole schema co_<id> (every invoice, item, customer, ...), the company
    row, everybody's access to it, and its pictures/logo in ImageKit. There is no undo, so:
    needs 'manage_companies', the caller must have access to it, the confirmation text must match exactly,
    you cannot delete the company you are working in, and you cannot delete the last active company."""
    user, current_id = ctx
    _require_manage(user)
    company = _managed_company(db, user, company_id)
    expected = f"delete {company.name}"
    if (payload.confirm or "").strip() != expected:
        raise HTTPException(400, f"To confirm, type exactly: {expected}")
    if company.id == current_id:
        raise HTTPException(400, "You are working inside this company. Open another company first, then delete this one.")
    if company.is_active and db.query(Company.id).filter(
            Company.is_active == True, Company.id != company.id).first() is None:  # noqa: E712
        raise HTTPException(400, "You cannot delete the last active company.")

    name, schema = company.name, schema_for(company.id)
    S = quote_schema(schema)
    file_ids = [company.logo_file_id] if company.logo_file_id else []
    db.rollback()                                   # end the read transaction so it cannot block the DROP below

    try:                                            # remember the ImageKit files BEFORE the data is gone
        with engine.connect() as c:
            file_ids += [r[0] for r in c.execute(text(f"SELECT file_id FROM {S}.product_images WHERE file_id IS NOT NULL"))]
    except Exception:
        log.warning("could not list product images of %s before deleting it", schema)

    try:
        with engine.begin() as conn:                # ONE transaction: the schema and the company row go together or not at all
            conn.execute(text("SET LOCAL lock_timeout = '10s'"))
            conn.execute(text(f"DROP SCHEMA IF EXISTS {S} CASCADE"))
            conn.execute(text("DELETE FROM public.companies WHERE id = :i"), {"i": company_id})
    except OperationalError:
        log.exception("company %s is busy, delete cancelled", company_id)
        raise HTTPException(409, "Someone is still working in this company. Try again in a minute. Nothing was deleted.")
    except Exception:
        log.exception("deleting company %s failed", company_id)
        raise HTTPException(500, "Could not delete the company. Nothing was deleted.")

    failed = 0
    for fid in file_ids:                            # best effort: the data is already gone, a leftover picture is harmless
        try:
            delete_image(fid)
        except Exception:
            failed += 1
            log.exception("could not delete ImageKit file %s of deleted company %s", fid, company_id)
    # the deleted company's own audit log is gone with it, so the event is recorded in the company the user is in
    log_audit_company(current_id, user, "company_deleted", "company", company_id,
                      f"Company '{name}' (#{company_id}) permanently deleted", request)
    return {"deleted": company_id, "name": name, "images_not_removed": failed}

# ---------- profile of the CURRENT company ----------
@router.get("/company/profile")
def get_profile(db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    _, company_id = ctx
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, "Company not found")
    return _json(company)


@router.put("/company/profile")
def update_profile(payload: CompanyIn, request: Request, db: Session = Depends(get_public_db),
                   ctx=Depends(get_user_and_company)):
    user, company_id = ctx
    _require_manage(user)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, "Company not found")
    return _save_company(db, request, user, company, payload, None)


# ---------- logo ----------
def _store_logo(db: Session, request: Request, user, company: Company, upload: UploadFile) -> dict:
    safe_name = validate_image(upload)           # real JPG/PNG/GIF/WEBP, size limit, safe file name
    data = upload.file.read()
    try:
        url, file_id = upload_image(data, safe_name, company.id, "branding")   # /co_<id>/branding/
    except Exception:
        log.exception("logo upload failed (company %s)", company.id)
        raise HTTPException(502, "The logo could not be uploaded. Please try again.")
    old_file_id = company.logo_file_id
    company.logo_url, company.logo_file_id = url, file_id
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_image(file_id)                # do not leave an orphan in ImageKit
        except Exception:
            log.exception("could not remove orphan logo %s", file_id)
        raise HTTPException(500, "Could not save the logo.")
    if old_file_id:                              # delete the old one only after the new one is saved
        try:
            delete_image(old_file_id)
        except Exception:
            log.exception("could not delete old logo %s", old_file_id)
    log_audit_company(company.id, user, "company_logo_changed", "company", company.id,
                      f"Logo of '{company.name}' changed", request)
    return _json(company)


@router.post("/company/logo")
def upload_current_logo(request: Request, logo: UploadFile = File(...), db: Session = Depends(get_public_db),
                        ctx=Depends(get_user_and_company)):
    user, company_id = ctx
    _require_manage(user)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, "Company not found")
    return _store_logo(db, request, user, company, logo)


@router.post("/companies/{company_id}/logo")
def upload_company_logo(company_id: int, request: Request, logo: UploadFile = File(...),
                        db: Session = Depends(get_public_db), ctx=Depends(get_user_and_company)):
    """Used by the 'Create company' form right after the company is created (the new company is not the
    one the token works in yet)."""
    user, _ = ctx
    _require_manage(user)
    company = _managed_company(db, user, company_id)
    return _store_logo(db, request, user, company, logo)