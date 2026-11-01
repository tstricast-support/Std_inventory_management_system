from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/taxes", tags=["taxes"])


def _clean(payload: schemas.TaxCreate, db: Session, tax_id: int | None = None):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(400, "Tax name is required")
    if payload.rate < 0 or payload.rate > 100:
        raise HTTPException(400, "The rate must be between 0 and 100")
    dup = db.query(models.Tax).filter(func.lower(models.Tax.name) == name.lower())
    if tax_id:
        dup = dup.filter(models.Tax.id != tax_id)
    if dup.first():
        raise HTTPException(400, "A tax with this name already exists")
    if payload.is_default and not payload.is_active:
        raise HTTPException(400, "An inactive tax can't be the default")
    rate = Decimal(str(payload.rate)).quantize(Decimal("0.001"), ROUND_HALF_UP)
    return name, rate


def _in_use(db: Session, tax_id: int) -> bool:
    """Step 7B will make this check invoice / bill lines. Until a tax can be put on a line, nothing uses it."""
    return False


def _only_default(db: Session, keep_id: int):
    db.query(models.Tax).filter(models.Tax.id != keep_id, models.Tax.is_default.is_(True)).update(
        {"is_default": False}, synchronize_session=False
    )


@router.get("/", response_model=list[schemas.TaxOut])
def list_taxes(db: Session = Depends(get_db)):
    return db.query(models.Tax).order_by(models.Tax.name).all()


@router.post("/", response_model=schemas.TaxOut)
def create_tax(payload: schemas.TaxCreate, db: Session = Depends(get_db)):
    name, rate = _clean(payload, db)
    tax = models.Tax(name=name, rate=rate, is_active=payload.is_active, is_default=payload.is_default)
    db.add(tax)
    db.flush()
    if tax.is_default:
        _only_default(db, tax.id)
    db.commit()
    db.refresh(tax)
    return tax


@router.put("/{tax_id}", response_model=schemas.TaxOut)
def update_tax(tax_id: int, payload: schemas.TaxCreate, db: Session = Depends(get_db)):
    tax = db.query(models.Tax).get(tax_id)
    if not tax:
        raise HTTPException(404, "Tax not found")
    name, rate = _clean(payload, db, tax_id)
    tax.name, tax.rate = name, rate
    tax.is_active, tax.is_default = payload.is_active, payload.is_default
    if tax.is_default:
        _only_default(db, tax.id)
    db.commit()
    db.refresh(tax)
    return tax


@router.delete("/{tax_id}")
def delete_tax(tax_id: int, db: Session = Depends(get_db)):
    tax = db.query(models.Tax).get(tax_id)
    if not tax:
        raise HTTPException(404, "Tax not found")
    if _in_use(db, tax_id):
        raise HTTPException(400, "This tax is used on transactions, so it can't be deleted. Mark it inactive instead.")
    db.delete(tax)
    db.commit()
    return {"deleted": True}