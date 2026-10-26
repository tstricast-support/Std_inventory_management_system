from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..account_types import ACCOUNT_CATEGORY
from ..database import get_db
from .accounts import ledger_net

router = APIRouter(prefix="/api/journals", tags=["journals"])

CENT = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _next_number(db: Session) -> str:
    last = db.query(models.Journal).order_by(models.Journal.id.desc()).first()
    return f"JNL-{(last.id if last else 0) + 1:04d}"


@router.get("/", response_model=list[schemas.JournalOut])
def list_journals(db: Session = Depends(get_db)):
    return (
        db.query(models.Journal)
        .filter(models.Journal.source_type.is_(None))   # manual journals only; invoice postings are hidden here
        .order_by(models.Journal.journal_date.desc(), models.Journal.id.desc())
        .all()
    )


@router.post("/", response_model=schemas.JournalOut)
def create_journal(payload: schemas.JournalCreate, db: Session = Depends(get_db)):
    if len(payload.lines) < 2:
        raise HTTPException(400, "A journal needs at least two lines")

    ids = {line.account_id for line in payload.lines}
    found = {a.id for a in db.query(models.Account).filter(models.Account.id.in_(ids)).all()}
    if ids - found:
        raise HTTPException(400, "One of the selected accounts no longer exists")

    lines, total_debit, total_credit = [], Decimal("0"), Decimal("0")
    for line in payload.lines:
        debit, credit = _money(line.debit), _money(line.credit)
        if debit < 0 or credit < 0:
            raise HTTPException(400, "Amounts can't be negative")
        if (debit > 0) == (credit > 0):
            raise HTTPException(400, "Each line needs either a debit or a credit amount (not both, not neither)")
        total_debit += debit
        total_credit += credit
        lines.append(models.JournalLine(
            account_id=line.account_id, debit=debit, credit=credit, description=line.description,
        ))

    if total_debit != total_credit:
        raise HTTPException(400, f"Debits ({total_debit}) and credits ({total_credit}) must be equal")

    journal = models.Journal(
        journal_number=_next_number(db),
        journal_date=payload.journal_date,
        reference=payload.reference,
        notes=payload.notes,
        lines=lines,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)
    return journal


@router.delete("/{journal_id}")
def delete_journal(journal_id: int, db: Session = Depends(get_db)):
    journal = db.query(models.Journal).get(journal_id)
    if not journal:
        raise HTTPException(404, "Journal not found")\

    if journal.source_type:
        raise HTTPException(400, "This entry was posted automatically by an invoice or a payment. Void the invoice or delete the payment instead.")
    db.delete(journal)
    db.commit()
    return {"message": "Deleted"}


@router.get("/trial-balance", response_model=list[schemas.TrialBalanceRow])
def trial_balance(db: Session = Depends(get_db)):
    """Every account that has journal entries, with its net balance on the debit or credit side."""
    nets = ledger_net(db)
    rows = []
    for a in db.query(models.Account).order_by(models.Account.name).all():
        net = round(nets.get(a.id, 0.0), 2)
        if net == 0:
            continue
        rows.append({
            "account_id": a.id, "name": a.name, "account_type": a.account_type,
            "category": ACCOUNT_CATEGORY.get(a.account_type, ""),
            "debit": net if net > 0 else 0, "credit": -net if net < 0 else 0,
        })
    return rows