from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
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

# An account's total value = sum of (stock quantity x rate) over the items linked to it:
#   COGS / Asset accounts -> rate = item cost
#   Income accounts       -> rate = item sales price
def _link_column(account_type: str):
    return {
        "cogs": models.Product.cogs_account_id,
        "income": models.Product.income_account_id,
        "asset": models.Product.asset_account_id,
    }[account_type]


def _rate_column(account_type: str):
    return models.Product.price if account_type == "income" else models.Product.cost


@router.get("/summary", response_model=list[schemas.AccountSummary])
def accounts_summary(db: Session = Depends(get_db)):
    """Every account with its total value and number of linked items."""
    result = []
    for a in db.query(models.Account).order_by(models.Account.name).all():
        count, total = db.query(
            func.count(models.Product.id),
            func.coalesce(func.sum(models.Product.quantity * _rate_column(a.account_type)), 0),
        ).filter(_link_column(a.account_type) == a.id).one()
        result.append({
            "id": a.id, "name": a.name, "account_type": a.account_type,
            "created_at": a.created_at, "total_value": float(total), "item_count": count,
        })
    return result


@router.get("/{account_id}/detail", response_model=schemas.AccountDetail)
def account_detail(account_id: int, db: Session = Depends(get_db)):
    """One account with the items that use it and how much each contributes."""
    a = db.query(models.Account).get(account_id)
    if not a:
        raise HTTPException(404, "Account not found")
    products = (
        db.query(models.Product)
        .filter(_link_column(a.account_type) == a.id)
        .order_by(models.Product.name)
        .all()
    )
    items = []
    for p in products:
        unit = float(getattr(p, "price" if a.account_type == "income" else "cost") or 0)
        items.append({
            "id": p.id, "name": p.name, "sku": p.sku, "department": p.department,
            "quantity": p.quantity, "unit_value": unit, "value": unit * p.quantity,
            "parent_name": p.parent.name if p.parent else None,
        })
    return {
        "id": a.id, "name": a.name, "account_type": a.account_type, "created_at": a.created_at,
        "total_value": sum(i["value"] for i in items), "item_count": len(items),
        "value_basis": "price" if a.account_type == "income" else "cost",
        "items": items,
    }


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    db.delete(account)
    db.commit()
    return {"message": "Deleted"}