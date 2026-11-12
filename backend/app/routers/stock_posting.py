from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models
from .invoices import _get_or_create_account, STOCK_TRACKED_TYPE
from .banking import _offset_account

CENT = Decimal("0.01")


def _next_number(db: Session) -> str:
    n = db.query(func.count(models.Journal.id)).filter(models.Journal.source_type.like("stock_%")).scalar() + 1
    while db.query(models.Journal).filter(models.Journal.journal_number == f"STK-{n:04d}").first():
        n += 1
    return f"STK-{n:04d}"


def post_stock_journal(db: Session, source_type: str, source_id: int, items, reference: str, notes: str, journal_date=None):
    """Stock added WITHOUT a vendor bill: Dr Inventory Asset, Cr Opening Balance Offset.
    items = [(product, quantity), ...]. Valued at the item's current cost. Nothing is posted if the value is 0."""
    debits: dict[int, Decimal] = {}
    total = Decimal("0")
    for product, qty in items:
        if product.item_type != STOCK_TRACKED_TYPE or qty <= 0:
            continue
        amount = (Decimal(str(product.cost or 0)) * qty).quantize(CENT, ROUND_HALF_UP)
        if amount <= 0:
            continue
        asset_id = product.asset_account_id or _get_or_create_account(db, "Inventory Asset", "asset").id
        debits[asset_id] = debits.get(asset_id, Decimal("0")) + amount
        total += amount
    if total <= 0:
        return None

    lines = [
        models.JournalLine(account_id=acc_id, debit=amt, credit=0, description=notes)
        for acc_id, amt in debits.items()
    ]
    lines.append(models.JournalLine(
        account_id=_offset_account(db).id, debit=0, credit=total, description=notes,
    ))
    journal = models.Journal(
        journal_number=_next_number(db),
        journal_date=journal_date or date.today(),
        reference=reference,
        notes=notes,
        source_type=source_type,
        source_id=source_id,
        lines=lines,
    )
    db.add(journal)
    db.flush()
    return journal


def remove_stock_journal(db: Session, source_type: str, source_id: int):
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == source_type, models.Journal.source_id == source_id
    ).all():
        db.delete(journal)   # ORM delete so its lines go too