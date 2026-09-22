from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


@router.get("/", response_model=list[schemas.VendorOut])
def list_vendors(db: Session = Depends(get_db)):
    return db.query(models.Vendor).order_by(models.Vendor.name).all()


@router.post("/", response_model=schemas.VendorOut)
def create_vendor(payload: schemas.VendorCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Vendor).filter(models.Vendor.name == payload.name).first()
    if existing:
        raise HTTPException(400, "Vendor already exists")
    vendor = models.Vendor(**payload.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.put("/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(vendor_id: int, payload: schemas.VendorCreate, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).get(vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    for field, value in payload.model_dump().items():
        setattr(vendor, field, value)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).get(vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    db.delete(vendor)
    db.commit()
    return {"message": "Deleted"}