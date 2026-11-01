from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from .. import models
from ..account_types import ACCOUNT_CATEGORY
from ..database import get_db

router = APIRouter(prefix="/api/reports", tags=["reports"])

CENT = Decimal("0.01")

# Profit & Loss sections: (account_type, heading, +1 if a debit is "positive" / -1 if a credit is "positive")
PL_SECTIONS = [
    ("income", "Operating Income", -1),
    ("cogs", "Cost of Goods Sold", 1),
    ("expense", "Operating Expense", 1),
    ("other_income", "Non Operating Income", -1),
    ("other_expense", "Non Operating Expense", 1),
]

# Balance Sheet groups: (side, heading, account types)
BS_GROUPS = [
    ("assets", "Current Assets", {"cash", "bank", "accounts_receivable", "other_current_asset", "asset"}),
    ("assets", "Fixed Assets", {"fixed_asset"}),
    ("liabilities", "Current Liabilities", {"accounts_payable", "credit_card", "current_liability"}),
    ("liabilities", "Long Term Liabilities", {"long_term_liability"}),
    ("equity", "Equity", {"equity"}),
]

BUCKETS = ["current", "d1_15", "d16_30", "d31_45", "d45_plus"]


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _nets(db: Session, date_from: date | None = None, date_to: date | None = None) -> dict[int, Decimal]:
    """account_id -> (debits - credits) of the journal lines dated inside the range."""
    query = (
        db.query(
            models.JournalLine.account_id,
            func.coalesce(func.sum(models.JournalLine.debit), 0),
            func.coalesce(func.sum(models.JournalLine.credit), 0),
        )
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
    )
    if date_from:
        query = query.filter(models.Journal.journal_date >= date_from)
    if date_to:
        query = query.filter(models.Journal.journal_date <= date_to)
    return {aid: _money(d) - _money(c) for aid, d, c in query.group_by(models.JournalLine.account_id).all()}


# ---------------------------------------------------------------- Profit & Loss
@router.get("/profit-and-loss")
def profit_and_loss(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db)):
    today = date.today()
    date_to = date_to or today
    date_from = date_from or date(date_to.year, 1, 1)
    nets = _nets(db, date_from, date_to)
    accounts = db.query(models.Account).order_by(models.Account.name).all()

    sections, totals = [], {}
    for key, title, sign in PL_SECTIONS:
        rows = []
        for a in accounts:
            if a.account_type != key:
                continue
            amount = sign * nets.get(a.id, Decimal("0"))
            if amount != 0:
                rows.append({"id": a.id, "name": a.name, "amount": float(amount)})
        total = sum((Decimal(str(r["amount"])) for r in rows), Decimal("0"))
        totals[key] = total
        sections.append({"key": key, "title": title, "accounts": rows, "total": float(total)})

    gross = totals["income"] - totals["cogs"]
    operating = gross - totals["expense"]
    net = operating + totals["other_income"] - totals["other_expense"]
    return {
        "date_from": date_from, "date_to": date_to, "sections": sections,
        "gross_profit": float(gross), "operating_profit": float(operating), "net_profit": float(net),
    }


# ---------------------------------------------------------------- Balance Sheet
@router.get("/balance-sheet")
def balance_sheet(as_of: date | None = None, db: Session = Depends(get_db)):
    as_of = as_of or date.today()
    nets = _nets(db, None, as_of)
    accounts = db.query(models.Account).order_by(models.Account.name).all()

    sides = {"assets": [], "liabilities": [], "equity": []}
    side_totals = {"assets": Decimal("0"), "liabilities": Decimal("0"), "equity": Decimal("0")}
    for side, title, types in BS_GROUPS:
        sign = 1 if side == "assets" else -1          # assets are debit-normal, the rest credit-normal
        rows = []
        for a in accounts:
            if a.account_type not in types:
                continue
            amount = sign * nets.get(a.id, Decimal("0"))
            if amount != 0:
                rows.append({"id": a.id, "name": a.name, "amount": float(amount)})
        total = sum((Decimal(str(r["amount"])) for r in rows), Decimal("0"))
        sides[side].append({"title": title, "accounts": rows, "total": float(total)})
        side_totals[side] += total

    # every sale / cost since the books began that no one has closed into Retained Earnings yet
    profit = -sum(
        (nets.get(a.id, Decimal("0")) for a in accounts if ACCOUNT_CATEGORY.get(a.account_type) in ("Income", "Expense")),
        Decimal("0"),
    )
    if profit != 0:
        sides["equity"][0]["accounts"].append({"id": None, "name": "Net Profit (to date)", "amount": float(profit)})
        sides["equity"][0]["total"] = float(Decimal(str(sides["equity"][0]["total"])) + profit)
        side_totals["equity"] += profit

    right = side_totals["liabilities"] + side_totals["equity"]
    return {
        "as_of": as_of,
        "assets": sides["assets"], "liabilities": sides["liabilities"], "equity": sides["equity"],
        "total_assets": float(side_totals["assets"]),
        "total_liabilities": float(side_totals["liabilities"]),
        "total_equity": float(side_totals["equity"]),
        "total_liabilities_and_equity": float(right),
        "difference": float(side_totals["assets"] - right),
    }


# ---------------------------------------------------------------- Ageing (receivables / payables)
def _bucket(days_overdue: int) -> str:
    if days_overdue <= 0:
        return "current"
    if days_overdue <= 15:
        return "d1_15"
    if days_overdue <= 30:
        return "d16_30"
    if days_overdue <= 45:
        return "d31_45"
    return "d45_plus"


def _build_ageing(as_of: date, entries: list[dict], credits: dict[int, tuple[str, Decimal]], ledger_balance: Decimal) -> dict:
    """entries: one dict per open document. credits: party_id -> (party name, unused credit)."""
    parties: dict[int, dict] = {}

    def party(pid: int, name: str) -> dict:
        if pid not in parties:
            parties[pid] = {
                "party_id": pid, "party_name": name, "documents": [], "credits": Decimal("0"),
                **{b: Decimal("0") for b in BUCKETS},
            }
        return parties[pid]

    for e in entries:
        days = (as_of - e["due_date"]).days
        bucket = _bucket(days)
        p = party(e["party_id"], e["party_name"])
        p[bucket] += e["balance"]
        p["documents"].append({
            "id": e["id"], "number": e["number"], "doc_date": e["doc_date"], "due_date": e["due_date"],
            "days_overdue": max(days, 0), "bucket": bucket, "balance": float(e["balance"]),
        })
    for pid, (name, amount) in credits.items():
        party(pid, name)["credits"] += amount

    totals = {b: Decimal("0") for b in BUCKETS}
    total_credits = Decimal("0")
    rows = []
    for p in sorted(parties.values(), key=lambda x: x["party_name"].lower()):
        owed = sum((p[b] for b in BUCKETS), Decimal("0"))
        for b in BUCKETS:
            totals[b] += p[b]
        total_credits += p["credits"]
        p["documents"].sort(key=lambda d: d["due_date"])
        rows.append({
            "party_id": p["party_id"], "party_name": p["party_name"], "documents": p["documents"],
            **{b: float(p[b]) for b in BUCKETS},
            "total": float(owed), "credits": float(p["credits"]), "net": float(owed - p["credits"]),
        })
    total_owed = sum(totals.values(), Decimal("0"))
    return {
        "as_of": as_of, "rows": rows,
        "totals": {**{b: float(v) for b, v in totals.items()}, "total": float(total_owed),
                   "credits": float(total_credits), "net": float(total_owed - total_credits)},
        "ledger_balance": float(ledger_balance),
        "matches_ledger": (total_owed - total_credits) == ledger_balance,
    }


@router.get("/receivables-ageing")
def receivables_ageing(as_of: date | None = None, db: Session = Depends(get_db)):
    as_of = as_of or date.today()
    entries = []
    for inv in db.query(models.Invoice).options(joinedload(models.Invoice.customer)).filter(models.Invoice.status == "open").all():
        balance = _money(inv.total) - _money(inv.amount_paid)
        if balance > 0:
            entries.append({
                "party_id": inv.customer_id, "party_name": inv.customer_name, "id": inv.id, "number": inv.invoice_number,
                "doc_date": inv.invoice_date, "due_date": inv.due_date, "balance": balance,
            })
    credits: dict[int, tuple[str, Decimal]] = {}
    for cn in db.query(models.CreditNote).options(joinedload(models.CreditNote.customer)).filter(models.CreditNote.status == "open").all():
        left = _money(cn.total) - _money(cn.amount_applied)
        if left > 0:
            name, so_far = credits.get(cn.customer_id, (cn.customer_name, Decimal("0")))
            credits[cn.customer_id] = (name, so_far + left)

    nets = _nets(db)
    ledger = sum((nets.get(a.id, Decimal("0")) for a in db.query(models.Account).filter(models.Account.account_type == "accounts_receivable")), Decimal("0"))
    return _build_ageing(as_of, entries, credits, ledger)


@router.get("/payables-ageing")
def payables_ageing(as_of: date | None = None, db: Session = Depends(get_db)):
    as_of = as_of or date.today()
    entries = []
    for bill in db.query(models.PurchaseBill).options(joinedload(models.PurchaseBill.vendor)).filter(models.PurchaseBill.status == "open").all():
        balance = _money(bill.total) - _money(bill.amount_paid)
        if balance > 0:
            entries.append({
                "party_id": bill.vendor_id, "party_name": bill.vendor_name, "id": bill.id, "number": bill.bill_number,
                "doc_date": bill.bill_date, "due_date": bill.due_date, "balance": balance,
            })
    nets = _nets(db)
    ledger = -sum((nets.get(a.id, Decimal("0")) for a in db.query(models.Account).filter(models.Account.account_type == "accounts_payable")), Decimal("0"))
    return _build_ageing(as_of, entries, {}, ledger)