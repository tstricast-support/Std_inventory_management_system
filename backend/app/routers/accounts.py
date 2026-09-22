from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

VALID_TYPES = {"cogs", "income", "asset"}


@router.get("/", response_model=list[schemas.AccountOut])
def list_accounts(account_type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Account)
    if account_type:
        query = query.filter(models.Account.account_type == account_type)
    return query.order_by(models.Account.name).all()


@router.post("/", response_model=schemas.AccountOut)
def create_account(payload: schemas.AccountCreate, db: Session = Depends(get_db)):
    if payload.account_type not in VALID_TYPES:
        raise HTTPException(400, f"account_type must be one of {sorted(VALID_TYPES)}")
    existing = db.query(models.Account).filter(
        models.Account.name == payload.name,
        models.Account.account_type == payload.account_type,
    ).first()
    if existing:
        raise HTTPException(400, "Account already exists")
    account = models.Account(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    db.delete(account)
    db.commit()
    return {"message": "Deleted"}