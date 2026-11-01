from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models
from ..account_types import ACCOUNT_CATEGORY
from ..database import get_db
from .reports import _money, _nets, _bucket

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _month_start(today: date, back: int) -> date:
    """First day of the month, `back` months before today's month."""
    index = today.year * 12 + (today.month - 1) - back
    return date(index // 12, index % 12 + 1, 1)


@router.get("")
def dashboard(year: int | None = None, db: Session = Depends(get_db)):
    today = date.today()
    accounts = db.query(models.Account).order_by(models.Account.name).all()
    nets = _nets(db, None, today)

    # ---- cash & bank balances (ledger) ----
    cash = []
    for a in accounts:
        if a.account_type in ("cash", "bank"):
            cash.append({"id": a.id, "name": a.name, "balance": float(nets.get(a.id, Decimal("0")))})
    cash_total = sum((Decimal(str(c["balance"])) for c in cash), Decimal("0"))

    # ---- receivables / payables (open documents) ----
    recv_total = recv_overdue = Decimal("0")
    for inv in db.query(models.Invoice).filter(models.Invoice.status == "open").all():
        balance = _money(inv.total) - _money(inv.amount_paid)
        if balance > 0:
            recv_total += balance
            if inv.due_date < today:
                recv_overdue += balance

    pay_total = pay_overdue = Decimal("0")
    for bill in db.query(models.PurchaseBill).filter(models.PurchaseBill.status == "open").all():
        balance = _money(bill.total) - _money(bill.amount_paid)
        if balance > 0:
            pay_total += balance
            if bill.due_date < today:
                pay_overdue += balance

    # ---- income vs expense, last 6 months (grouped in Python so it works on SQLite and Postgres) ----
    first = _month_start(today, 5)
    months = {}
    for back in range(5, -1, -1):
        start = _month_start(today, back)
        months[(start.year, start.month)] = {"month": start.strftime("%b %Y"), "income": Decimal("0"), "expense": Decimal("0")}

    rows = (
        db.query(models.Journal.journal_date, models.JournalLine.debit, models.JournalLine.credit, models.Account.account_type)
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
        .join(models.Account, models.JournalLine.account_id == models.Account.id)
        .filter(models.Journal.journal_date >= first, models.Journal.journal_date <= today)
        .all()
    )
    for jdate, debit, credit, account_type in rows:
        bucket = months.get((jdate.year, jdate.month))
        category = ACCOUNT_CATEGORY.get(account_type)
        if bucket is None:
            continue
        if category == "Income":
            bucket["income"] += _money(credit) - _money(debit)
        elif category == "Expense":
            bucket["expense"] += _money(debit) - _money(credit)
    chart = [{"month": m["month"], "income": float(m["income"]), "expense": float(m["expense"])} for m in months.values()]

    # ---- this year: top expense accounts ----
    year_nets = _nets(db, date(today.year, 1, 1), today)
    top = []
    for a in accounts:
        if ACCOUNT_CATEGORY.get(a.account_type) == "Expense":
            amount = year_nets.get(a.id, Decimal("0"))
            if amount > 0:
                top.append({"id": a.id, "name": a.name, "amount": float(amount)})
    top.sort(key=lambda r: r["amount"], reverse=True)

    # ---- low stock ----
    low = (
        db.query(models.Product)
        .filter(models.Product.reorder_min.isnot(None), models.Product.quantity <= models.Product.reorder_min)
        .order_by(models.Product.quantity)
        .all()
    )

        # ---- Zoho-style: receivables / payables split by how overdue they are ----
    def _aged(documents):
        buckets = {b: Decimal("0") for b in ("current", "d1_15", "d16_30", "d31_45", "d45_plus")}
        for doc in documents:
            balance = _money(doc.total) - _money(doc.amount_paid)
            if balance > 0:
                buckets[_bucket((today - doc.due_date).days)] += balance
        out = {k: float(v) for k, v in buckets.items()}
        out["total"] = float(sum(buckets.values(), Decimal("0")))
        return out

    recv_ageing = _aged(db.query(models.Invoice).filter(models.Invoice.status == "open").all())
    pay_ageing = _aged(db.query(models.PurchaseBill).filter(models.PurchaseBill.status == "open").all())

    # ---- Zoho-style: Sales / Receipts / Expenses for each month of the fiscal year (Jan-Dec) ----
    fy = year or today.year
    fy_start, fy_end = date(fy, 1, 1), date(fy, 12, 31)
    fy_months = {
        m: {"month": date(fy, m, 1).strftime("%b"), "year": fy,
            "sales": Decimal("0"), "receipts": Decimal("0"), "expenses": Decimal("0")}
        for m in range(1, 13)
    }
    for inv in db.query(models.Invoice).filter(
        models.Invoice.status == "open", models.Invoice.invoice_date >= fy_start, models.Invoice.invoice_date <= fy_end
    ).all():
        fy_months[inv.invoice_date.month]["sales"] += _money(inv.total)
    for pay in db.query(models.Payment).filter(
        models.Payment.payment_date >= fy_start, models.Payment.payment_date <= fy_end
    ).all():
        fy_months[pay.payment_date.month]["receipts"] += _money(pay.amount)
    fy_expense_rows = (
        db.query(models.Journal.journal_date, models.JournalLine.debit, models.JournalLine.credit, models.Account.account_type)
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
        .join(models.Account, models.JournalLine.account_id == models.Account.id)
        .filter(models.Journal.journal_date >= fy_start, models.Journal.journal_date <= fy_end)
        .all()
    )
    for jdate, debit, credit, account_type in fy_expense_rows:
        if ACCOUNT_CATEGORY.get(account_type) == "Expense":
            fy_months[jdate.month]["expenses"] += _money(debit) - _money(credit)
    fy_chart = [
        {"month": r["month"], "year": r["year"], "sales": float(r["sales"]),
         "receipts": float(r["receipts"]), "expenses": float(r["expenses"])}
        for r in fy_months.values()
    ]

    return {
        "as_of": today,
        "cash_total": float(cash_total), "cash_accounts": cash,
        "receivables": float(recv_total), "receivables_overdue": float(recv_overdue),
        "payables": float(pay_total), "payables_overdue": float(pay_overdue),
        "chart": chart,
        "income_6m": float(sum((m["income"] for m in months.values()), Decimal("0"))),
        "expense_6m": float(sum((m["expense"] for m in months.values()), Decimal("0"))),
        "top_expenses": top[:5],
        "low_stock_count": len(low),
        "low_stock": [{"id": p.id, "name": p.name, "quantity": p.quantity, "reorder_min": p.reorder_min} for p in low[:8]],
                # ---- Zoho-style dashboard ----
        "fiscal_year": fy,
        "receivables_ageing": recv_ageing,
        "payables_ageing": pay_ageing,
        "fy_chart": fy_chart,
        "fy_sales": sum(r["sales"] for r in fy_chart),
        "fy_receipts": sum(r["receipts"] for r in fy_chart),
        "fy_expenses": sum(r["expenses"] for r in fy_chart),
    }