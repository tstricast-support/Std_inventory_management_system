from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from .accounts import ledger_net

router = APIRouter(prefix="/api/banking", tags=["banking"])

CENT = Decimal("0.01")
BANK_TYPES = {"cash", "bank"}                                  # the accounts the Banking page manages
NOT_FOR_BANK_ENTRIES = {"accounts_receivable", "accounts_payable"}   # these move only through invoices / bills / payments
KIND_LABELS = {
    "payment": "Customer payment",
    "vendor_payment": "Vendor payment",
    "bank_deposit": "Deposit",
    "bank_withdrawal": "Withdrawal",
    "bank_transfer": "Transfer",
    "bank_opening": "Opening balance",
    "credit_note": "Credit note",
    "invoice": "Invoice",
    "purchase_bill": "Purchase bill",
    None: "Manual journal",
}


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _next_number(db: Session) -> str:
    n = db.query(func.count(models.Journal.id)).filter(models.Journal.source_type.like("bank_%")).scalar() + 1
    while db.query(models.Journal).filter(models.Journal.journal_number == f"BNK-{n:04d}").first():
        n += 1
    return f"BNK-{n:04d}"


def _offset_account(db: Session) -> models.Account:
    account = db.query(models.Account).filter(models.Account.name == "Opening Balance Offset").first()
    if not account:
        account = models.Account(name="Opening Balance Offset", account_type="equity")
        db.add(account)
        db.flush()
    return account


def _bank_account(db: Session, account_id: int) -> models.Account:
    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    if account.account_type not in BANK_TYPES:
        raise HTTPException(400, f"{account.name} is not a bank or cash account")
    return account


@router.get("/accounts", response_model=list[schemas.BankAccountOut])
def list_bank_accounts(db: Session = Depends(get_db)):
    nets = ledger_net(db)
    counts = dict(
        db.query(models.JournalLine.account_id, func.count(models.JournalLine.id))
        .group_by(models.JournalLine.account_id).all()
    )
    accounts = (
        db.query(models.Account).filter(models.Account.account_type.in_(BANK_TYPES))
        .order_by(models.Account.account_type, models.Account.name).all()
    )
    return [
        {
            "id": a.id, "name": a.name, "account_type": a.account_type, "account_code": a.account_code,
            "balance": round(nets.get(a.id, 0.0), 2), "transaction_count": counts.get(a.id, 0),
        }
        for a in accounts
    ]


@router.post("/accounts", response_model=schemas.BankAccountOut)
def create_bank_account(payload: schemas.BankAccountCreate, db: Session = Depends(get_db)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(400, "Account name is required")
    if payload.account_type not in BANK_TYPES:
        raise HTTPException(400, "account_type must be bank or cash")
    if db.query(models.Account).filter(
        func.lower(models.Account.name) == name.lower(), models.Account.account_type == payload.account_type
    ).first():
        raise HTTPException(400, "Account already exists")

    account = models.Account(
        name=name, account_type=payload.account_type,
        account_code=(payload.account_code or "").strip() or None,
    )
    db.add(account)
    db.flush()

    opening = _money(payload.opening_balance)
    if opening != 0:
        offset = _offset_account(db)
        amount = abs(opening)
        # money in the account: bank is debited. Overdrawn (negative) opening: bank is credited.
        bank_debit, bank_credit = (amount, Decimal("0")) if opening > 0 else (Decimal("0"), amount)
        db.add(models.Journal(
            journal_number=_next_number(db),
            journal_date=payload.opening_date or date.today(),
            reference="Opening balance",
            notes=f"Opening balance - {name}",
            source_type="bank_opening",
            source_id=account.id,
            lines=[
                models.JournalLine(account_id=account.id, debit=bank_debit, credit=bank_credit, description="Opening balance"),
                models.JournalLine(account_id=offset.id, debit=bank_credit, credit=bank_debit, description=f"Opening balance - {name}"),
            ],
        ))
    db.commit()
    nets = ledger_net(db)
    return {
        "id": account.id, "name": account.name, "account_type": account.account_type,
        "account_code": account.account_code, "balance": round(nets.get(account.id, 0.0), 2),
        "transaction_count": 1 if opening != 0 else 0,
    }


@router.get("/accounts/{account_id}/transactions", response_model=list[schemas.BankTransactionOut])
def bank_transactions(account_id: int, date_from: date | None = None, date_to: date | None = None,
                      db: Session = Depends(get_db)):
    """Every ledger line on the account, newest first, each with the balance after it."""
    _bank_account(db, account_id)
    lines = (
        db.query(models.JournalLine)
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
        .filter(models.JournalLine.account_id == account_id)
        .options(joinedload(models.JournalLine.journal).joinedload(models.Journal.lines).joinedload(models.JournalLine.account))
        .order_by(models.Journal.journal_date, models.Journal.id, models.JournalLine.id)
        .all()
    )
    rows, running = [], Decimal("0")
    for line in lines:
        debit, credit = _money(line.debit), _money(line.credit)
        running += debit - credit
        j = line.journal
        if (date_from and j.journal_date < date_from) or (date_to and j.journal_date > date_to):
            continue
        others = [l.account.name for l in j.lines if l.account_id != account_id and l.account]
        rows.append({
            "line_id": line.id, "journal_id": j.id, "journal_number": j.journal_number,
            "date": j.journal_date, "source_type": j.source_type,
            "kind": KIND_LABELS.get(j.source_type, j.source_type or "Journal"),
            "reference": j.reference, "description": line.description or j.notes,
            "other_accounts": ", ".join(dict.fromkeys(others)),
            "money_in": float(debit), "money_out": float(credit), "balance": float(running),
            "can_delete": bool(j.source_type and j.source_type.startswith("bank_")),
        })
    rows.reverse()
    return rows


@router.post("/transactions")
def create_bank_transaction(payload: schemas.BankTransactionCreate, db: Session = Depends(get_db)):
    if payload.txn_type not in {"deposit", "withdrawal", "transfer"}:
        raise HTTPException(400, "txn_type must be deposit, withdrawal or transfer")
    amount = _money(payload.amount)
    if amount <= 0:
        raise HTTPException(400, "The amount must be greater than 0")
    if payload.account_id == payload.other_account_id:
        raise HTTPException(400, "Pick two different accounts")

    account = _bank_account(db, payload.account_id)
    other = db.query(models.Account).get(payload.other_account_id)
    if not other:
        raise HTTPException(404, "The other account was not found")
    if payload.txn_type == "transfer":
        if other.account_type not in BANK_TYPES:
            raise HTTPException(400, "A transfer must go to a bank or cash account")
    elif other.account_type in NOT_FOR_BANK_ENTRIES:
        raise HTTPException(400, f"{other.name} can't be used here. Use invoices, bills and payments for it.")

    description = (payload.description or "").strip() or None
    if payload.txn_type == "deposit":          # money comes in: bank debit
        bank_dr, bank_cr = amount, Decimal("0")
        note = f"Deposit from {other.name}"
    elif payload.txn_type == "withdrawal":     # money goes out: bank credit
        bank_dr, bank_cr = Decimal("0"), amount
        note = f"Withdrawal to {other.name}"
    else:                                      # transfer: leaves `account`, lands in `other`
        bank_dr, bank_cr = Decimal("0"), amount
        note = f"Transfer from {account.name} to {other.name}"

    journal = models.Journal(
        journal_number=_next_number(db),
        journal_date=payload.txn_date,
        reference=(payload.reference or "").strip() or None,
        notes=description or note,
        source_type=f"bank_{payload.txn_type}",
        lines=[
            models.JournalLine(account_id=account.id, debit=bank_dr, credit=bank_cr, description=description or note),
            models.JournalLine(account_id=other.id, debit=bank_cr, credit=bank_dr, description=description or note),
        ],
    )
    db.add(journal)
    db.commit()
    return {"id": journal.id, "journal_number": journal.journal_number}


@router.delete("/transactions/{journal_id}")
def delete_bank_transaction(journal_id: int, db: Session = Depends(get_db)):
    journal = db.query(models.Journal).get(journal_id)
    if not journal:
        raise HTTPException(404, "Transaction not found")
    if not (journal.source_type or "").startswith("bank_"):
        raise HTTPException(400, "Only deposits, withdrawals, transfers and opening balances can be deleted here. Void the invoice / delete the payment instead.")
    db.delete(journal)
    db.commit()
    return {"deleted": True}