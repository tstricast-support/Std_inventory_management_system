from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/customers", tags=["customers"])

VALID_TYPES = {"Business", "Individual"}
VALID_TERMS = {"Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60"}


def _validate(payload: schemas.CustomerCreate):
    if payload.customer_type not in VALID_TYPES:
        raise HTTPException(400, f"customer_type must be one of {sorted(VALID_TYPES)}")
    if payload.payment_terms not in VALID_TERMS:
        raise HTTPException(400, f"payment_terms must be one of {sorted(VALID_TERMS)}")


@router.get("/", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.display_name).all()


@router.post("/", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    _validate(payload)
    if db.query(models.Customer).filter(models.Customer.display_name == payload.display_name).first():
        raise HTTPException(400, "Customer already exists")
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    _validate(payload)
    dup = db.query(models.Customer).filter(
        models.Customer.display_name == payload.display_name,
        models.Customer.id != customer_id,
    ).first()
    if dup:
        raise HTTPException(400, "Customer already exists")
    for field, value in payload.model_dump().items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    db.delete(customer)
    db.commit()
    return {"message": "Deleted"}