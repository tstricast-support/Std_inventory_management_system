"""Document numbers (INV-0001, PB-0001 ...): the next free number, and checks for a number typed by the user."""
import re
from fastapi import HTTPException
from sqlalchemy import or_, text
from sqlalchemy.orm import Session
from . import models

MAX_LEN = 30


def _lock(db: Session):
    # one number is handed out at a time, so two people saving together can't get the same one
    # (released automatically at commit / rollback)
    db.execute(text("SELECT pg_advisory_xact_lock(48151623)"))


def next_number(db: Session, column, prefix: str, width: int = 4, lock: bool = False) -> str:
    """Highest number already used with this prefix, plus 1 (documents AND their ledger entries are checked)."""
    if lock:
        _lock(db)
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    highest = 0
    for col in (column, models.Journal.journal_number):
        for (value,) in db.query(col).filter(col.like(f"{prefix}-%")).all():
            m = pattern.match(value or "")
            if m:
                highest = max(highest, int(m.group(1)))
    return f"{prefix}-{highest + 1:0{width}d}"


def resolve_number(db: Session, requested, *, model, column, prefix: str, journal_source: str, self_id=None) -> str:
    """The number typed by the user wins. Left empty -> the next free number."""
    number = (requested or "").strip()
    if not number:
        return next_number(db, column, prefix, lock=True)
    if len(number) > MAX_LEN:
        raise HTTPException(400, f"The number can't be longer than {MAX_LEN} characters")
    _lock(db)
    taken = db.query(model.id).filter(column == number)
    if self_id is not None:
        taken = taken.filter(model.id != self_id)
    if taken.first():
        raise HTTPException(400, f"{number} is already used. Type a different number.")
    # the ledger entry of a document uses the same number, so it must be free there too
    clash = db.query(models.Journal.id).filter(models.Journal.journal_number == number)
    if self_id is not None:   # ignore this document's own ledger entry
        clash = clash.filter(or_(
            models.Journal.source_type.is_(None),
            models.Journal.source_type != journal_source,
            models.Journal.source_id.is_(None),
            models.Journal.source_id != self_id,
        ))
    if clash.first():
        raise HTTPException(400, f"{number} is already used by another ledger entry. Type a different number.")
    return number