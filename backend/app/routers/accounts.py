from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models, schemas
from ..account_types import ACCOUNT_CATEGORY, DEBIT_NORMAL
from ..database import get_db

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

VALID_TYPES = set(ACCOUNT_CATEGORY)


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

@router.put("/{account_id}", response_model=schemas.AccountOut)
def update_account(account_id: int, payload: schemas.AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    data = payload.model_dump(exclude_unset=True)
    if "account_type" in data and data["account_type"] not in VALID_TYPES:
        raise HTTPException(400, f"account_type must be one of {sorted(VALID_TYPES)}")

    new_name = data.get("name", account.name)
    new_type = data.get("account_type", account.account_type)
    existing = db.query(models.Account).filter(
        models.Account.name == new_name,
        models.Account.account_type == new_type,
        models.Account.id != account_id,
    ).first()
    if existing:
        raise HTTPException(400, "Account already exists")

    for field, value in data.items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account

# An item-linked account's total value = sum of (stock quantity x rate) over the items linked to it:
#   COGS / Asset accounts -> rate = item cost
#   Income accounts       -> rate = item sales price
# Only cogs / income / asset accounts can be linked to items; every other type returns None here.
def _link_column(account_type: str):
    return {
        "cogs": models.Product.cogs_account_id,
        "income": models.Product.income_account_id,
        "asset": models.Product.asset_account_id,
    }.get(account_type)


def _rate_column(account_type: str):
    return models.Product.price if account_type == "income" else models.Product.cost


def ledger_net(db: Session) -> dict:
    """account_id -> (total debits - total credits) from the journal entries."""
    rows = db.query(
        models.JournalLine.account_id,
        func.coalesce(func.sum(models.JournalLine.debit), 0),
        func.coalesce(func.sum(models.JournalLine.credit), 0),
    ).group_by(models.JournalLine.account_id).all()
    return {account_id: float(d) - float(c) for account_id, d, c in rows}


def _ledger_balance(account_type: str, net: float) -> float:
    """Balance on the account's normal side (debit for assets/expenses, credit for the rest)."""
    balance = net if ACCOUNT_CATEGORY.get(account_type) in DEBIT_NORMAL else -net
    return round(balance, 2)


@router.get("/summary", response_model=list[schemas.AccountSummary])
def accounts_summary(db: Session = Depends(get_db)):
    """Every account with its item value, number of linked items and journal (ledger) balance."""
    nets = ledger_net(db)
    result = []
    for a in db.query(models.Account).order_by(models.Account.name).all():
        count, total = 0, 0
        link = _link_column(a.account_type)
        if link is not None:
            count, total = db.query(
                func.count(models.Product.id),
                func.coalesce(func.sum(models.Product.quantity * _rate_column(a.account_type)), 0),
            ).filter(link == a.id).one()
        result.append({
            "id": a.id, "name": a.name, "account_type": a.account_type,
            "account_code": a.account_code, "description": a.description,
            "created_at": a.created_at, "total_value": float(total), "item_count": count,
            "category": ACCOUNT_CATEGORY.get(a.account_type, ""),
            "ledger_balance": _ledger_balance(a.account_type, nets.get(a.id, 0.0)),
        })
    return result


@router.get("/{account_id}/detail", response_model=schemas.AccountDetail)
def account_detail(account_id: int, db: Session = Depends(get_db)):
    """One account with the items that use it and how much each contributes."""
    a = db.query(models.Account).get(account_id)
    if not a:
        raise HTTPException(404, "Account not found")
    link = _link_column(a.account_type)
    products = (
        db.query(models.Product).filter(link == a.id).order_by(models.Product.name).all()
        if link is not None else []
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
        "id": a.id, "name": a.name, "account_type": a.account_type,
        "account_code": a.account_code, "description": a.description,
        "created_at": a.created_at,
        "total_value": sum(i["value"] for i in items), "item_count": len(items),
        "category": ACCOUNT_CATEGORY.get(a.account_type, ""),
        "ledger_balance": _ledger_balance(a.account_type, ledger_net(db).get(a.id, 0.0)),
        "value_basis": "price" if a.account_type == "income" else "cost",
        "items": items,
    }


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    if db.query(models.JournalLine).filter(models.JournalLine.account_id == account_id).first():
        raise HTTPException(400, "This account has journal entries, so it can't be deleted")
    db.delete(account)
    db.commit()
    return {"message": "Deleted"}