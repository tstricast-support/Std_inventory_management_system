import calendar
from bisect import bisect_right
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload
from .. import models
from ..account_types import ACCOUNT_CATEGORY, DEBIT_NORMAL
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
        sec_accounts = [a for a in accounts if a.account_type == key]
        own = {a.id: sign * nets.get(a.id, Decimal("0")) for a in sec_accounts}
        by_id = {a.id: a for a in sec_accounts}
        children = {}
        for a in sec_accounts:
            if a.parent_id in by_id:
                children.setdefault(a.parent_id, []).append(a.id)

        def rollup(aid):
            return own[aid] + sum((rollup(c) for c in children.get(aid, [])), Decimal("0"))

        # show every account with a non-zero amount, plus the parents above it
        show = {aid for aid, v in own.items() if v != 0}
        for aid in list(show):
            p = by_id[aid].parent_id
            while p in by_id and p not in show:
                show.add(p)
                p = by_id[p].parent_id

        rows = [
            {"id": a.id, "name": a.name, "parent_id": a.parent_id if a.parent_id in by_id else None,
             "amount": float(own[a.id]), "total": float(rollup(a.id))}
            for a in sec_accounts if a.id in show
        ]
        total = sum(own.values(), Decimal("0"))
        totals[key] = total
        sections.append({"key": key, "title": title, "accounts": rows, "total": float(total)})

    gross = totals["income"] - totals["cogs"]
    operating = gross - totals["expense"]
    net = operating + totals["other_income"] - totals["other_expense"]
    return {
        "date_from": date_from, "date_to": date_to, "sections": sections,
        "gross_profit": float(gross), "operating_profit": float(operating), "net_profit": float(net),
    }


# =====================================================================================================
# PROFIT & LOSS v2  (QuickBooks-style: columns by day/week/month/quarter/year, customer filter,
# show-zero accounts, drill-down to transactions, and the journal behind each transaction)
# =====================================================================================================
PL_GROUP_BY = {"total", "day", "week", "month", "quarter", "year"}

SOURCE_LABELS = {
    None: "Journal",
    "invoice": "Invoice",
    "credit_note": "Credit Note",
    "payment": "Payment",
    "purchase_bill": "Bill",
    "vendor_payment": "Bill Payment",
    "bank_opening": "Opening Balance",
    "stock_opening": "Opening Stock",
    "stock_restock": "Stock Added",
    "stock_bill": "Stock Bill",
}


def _source_label(source_type: str | None) -> str:
    if source_type in SOURCE_LABELS:
        return SOURCE_LABELS[source_type]
    if (source_type or "").startswith("bank_"):
        return "Bank"
    return (source_type or "").replace("_", " ").title()


def _period_end(d: date, group_by: str) -> date:
    if group_by == "day":
        return d
    if group_by == "week":                      # weeks run Monday - Sunday
        return d + timedelta(days=6 - d.weekday())
    if group_by == "month":
        return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])
    if group_by == "quarter":
        m = ((d.month - 1) // 3) * 3 + 3
        return date(d.year, m, calendar.monthrange(d.year, m)[1])
    return date(d.year, 12, 31)


def _columns(date_from: date, date_to: date, group_by: str) -> list[dict]:
    if group_by == "total":
        return [{"key": "total", "label": "Total", "from": date_from, "to": date_to}]
    cols, cur = [], date_from
    while cur <= date_to:
        end = min(_period_end(cur, group_by), date_to)
        if group_by == "day":
            label = cur.strftime("%d %b") if date_from.year == date_to.year else cur.strftime("%d %b %y")
        elif group_by == "week":
            label = f"{cur:%d %b}" if cur == end else f"{cur:%d %b} - {end:%d %b}"
        elif group_by == "month":
            label = cur.strftime("%b %Y")
        elif group_by == "quarter":
            label = f"Q{(cur.month - 1) // 3 + 1} {cur.year}"
        else:
            label = str(cur.year)
        cols.append({"key": f"{cur.isoformat()}", "label": label, "from": cur, "to": end})
        cur = end + timedelta(days=1)
        if len(cols) > 400:
            raise HTTPException(400, "Too many columns for this date range - pick a longer grouping (e.g. Month).")
    return cols


def _customer_filter(query, customer_id: int | None):
    """Keep only journals that came from this customer's invoices / credit notes."""
    if not customer_id:
        return query
    inv = select(models.Invoice.id).where(models.Invoice.customer_id == customer_id)
    cn = select(models.CreditNote.id).where(models.CreditNote.customer_id == customer_id)
    return query.filter(or_(
        and_(models.Journal.source_type == "invoice", models.Journal.source_id.in_(inv)),
        and_(models.Journal.source_type == "credit_note", models.Journal.source_id.in_(cn)),
    ))


@router.get("/profit-and-loss/columns")
def profit_and_loss_columns(
    date_from: date | None = None,
    date_to: date | None = None,
    group_by: str = "total",
    customer_id: int | None = None,
    show_zero: bool = False,
    db: Session = Depends(get_db),
):
    if group_by not in PL_GROUP_BY:
        raise HTTPException(400, "group_by must be one of: " + ", ".join(sorted(PL_GROUP_BY)))
    date_to = date_to or date.today()
    date_from = date_from or date(date_to.year, 1, 1)
    if date_from > date_to:
        raise HTTPException(400, "'From' date is after 'To' date")

    cols = _columns(date_from, date_to, group_by)
    n = len(cols)
    starts = [c["from"] for c in cols]
    zero = [Decimal("0")] * n

    query = (
        db.query(
            models.JournalLine.account_id,
            models.Journal.journal_date,
            func.coalesce(func.sum(models.JournalLine.debit), 0),
            func.coalesce(func.sum(models.JournalLine.credit), 0),
        )
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
        .filter(models.Journal.journal_date >= date_from, models.Journal.journal_date <= date_to)
    )
    query = _customer_filter(query, customer_id)
    nets: dict[int, list[Decimal]] = {}
    for aid, jdate, deb, cred in query.group_by(models.JournalLine.account_id, models.Journal.journal_date).all():
        i = bisect_right(starts, jdate) - 1
        nets.setdefault(aid, [Decimal("0")] * n)[i] += _money(deb) - _money(cred)

    accounts = db.query(models.Account).order_by(models.Account.name).all()
    add = lambda a, b: [x + y for x, y in zip(a, b)]  # noqa: E731

    sections, totals = [], {}
    for key, title, sign in PL_SECTIONS:
        sec_accounts = [a for a in accounts if a.account_type == key]
        by_id = {a.id: a for a in sec_accounts}
        own = {a.id: [sign * v + 0 for v in nets.get(a.id, zero)] for a in sec_accounts}
        children: dict[int, list[int]] = {}
        for a in sec_accounts:
            if a.parent_id in by_id:
                children.setdefault(a.parent_id, []).append(a.id)
        memo: dict[int, list[Decimal]] = {}

        def rollup(aid, children=children, own=own, memo=memo):
            if aid not in memo:
                tot = list(own[aid])
                for c in children.get(aid, []):
                    tot = add(tot, rollup(c))
                memo[aid] = tot
            return memo[aid]

        show = set(by_id) if show_zero else {aid for aid, v in own.items() if any(x != 0 for x in v)}
        for aid in list(show):                       # keep the parents above every shown account
            p = by_id[aid].parent_id
            while p in by_id and p not in show:
                show.add(p)
                p = by_id[p].parent_id

        rows = [{
            "id": a.id, "name": a.name, "account_code": a.account_code,
            "parent_id": a.parent_id if a.parent_id in by_id else None,
            "own": [float(x) for x in own[a.id]],
            "own_sum": float(sum(own[a.id], Decimal("0"))),
            "total": [float(x) for x in rollup(a.id)],
            "sum": float(sum(rollup(a.id), Decimal("0"))),
        } for a in sec_accounts if a.id in show]

        col_total = list(zero)
        for v in own.values():
            col_total = add(col_total, v)
        totals[key] = col_total
        sections.append({
            "key": key, "title": title, "accounts": rows,
            "totals": [float(x) for x in col_total], "sum": float(sum(col_total, Decimal("0"))),
        })

    gross = [i - c for i, c in zip(totals["income"], totals["cogs"])]
    operating = [g - e for g, e in zip(gross, totals["expense"])]
    other_net = [i - e for i, e in zip(totals["other_income"], totals["other_expense"])]
    net = add(operating, other_net)
    pack = lambda v: {"cols": [float(x) for x in v], "sum": float(sum(v, Decimal("0")))}  # noqa: E731
    return {
        "date_from": date_from, "date_to": date_to, "group_by": group_by, "customer_id": customer_id,
        "columns": cols, "sections": sections,
        "gross": pack(gross), "operating": pack(operating), "other_net": pack(other_net), "net": pack(net),
    }


@router.get("/profit-and-loss/transactions")
def profit_and_loss_transactions(
    account_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    include_children: bool = True,
    customer_id: int | None = None,
    db: Session = Depends(get_db),
):
    """The journal lines behind one Profit & Loss account (what QuickBooks shows when you click a number)."""
    date_to = date_to or date.today()
    date_from = date_from or date(date_to.year, 1, 1)

    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    signs = {key: sign for key, _title, sign in PL_SECTIONS}
    if account.account_type not in signs:
        raise HTTPException(400, "This is not a Profit & Loss account")
    sign = signs[account.account_type]

    same_type = db.query(models.Account).filter(models.Account.account_type == account.account_type).all()
    names = {a.id: a.name for a in same_type}
    ids = {account.id}
    if include_children:
        grew = True
        while grew:
            grew = False
            for a in same_type:
                if a.parent_id in ids and a.id not in ids:
                    ids.add(a.id)
                    grew = True

    query = (
        db.query(models.JournalLine, models.Journal)
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
        .filter(models.JournalLine.account_id.in_(ids))
        .filter(models.Journal.journal_date >= date_from, models.Journal.journal_date <= date_to)
    )
    query = _customer_filter(query, customer_id)
    lines = query.order_by(models.Journal.journal_date, models.Journal.id, models.JournalLine.id).all()

    rows, total = [], Decimal("0")
    for line, journal in lines:
        amount = sign * (_money(line.debit) - _money(line.credit))
        total += amount
        rows.append({
            "id": line.id,
            "journal_id": journal.id,
            "date": journal.journal_date,
            "type": _source_label(journal.source_type),
            "source_type": journal.source_type,
            "source_id": journal.source_id,
            "number": journal.journal_number,
            "name": journal.reference or "",
            "memo": line.description or journal.notes or "",
            "account": names.get(line.account_id, ""),
            "amount": float(amount),
        })
    return {
        "account": {"id": account.id, "name": account.name},
        "date_from": date_from, "date_to": date_to,
        "rows": rows, "total": float(total),
    }


@router.get("/journal/{journal_id}")
def journal_detail(journal_id: int, db: Session = Depends(get_db)):
    """One posting with every debit / credit line (QuickBooks 'Transaction Journal')."""
    j = (
        db.query(models.Journal)
        .options(joinedload(models.Journal.lines).joinedload(models.JournalLine.account))
        .filter(models.Journal.id == journal_id)
        .first()
    )
    if not j:
        raise HTTPException(404, "Transaction not found")
    lines = [{
        "account": l.account.name if l.account else "",
        "account_type": l.account.account_type if l.account else "",
        "description": l.description or "",
        "debit": float(_money(l.debit)),
        "credit": float(_money(l.credit)),
    } for l in j.lines]
    return {
        "id": j.id, "number": j.journal_number, "date": j.journal_date,
        "reference": j.reference or "", "notes": j.notes or "",
        "source_type": j.source_type, "source_id": j.source_id, "type": _source_label(j.source_type),
        "lines": lines,
        "total_debit": sum(l["debit"] for l in lines), "total_credit": sum(l["credit"] for l in lines),
    }


# ---------------------------------------------------------------- Balance Sheet (QuickBooks layout)
# (side, heading, sign, [(group heading, [(sub-group heading, account types)])])
BS_LAYOUT = [
    ("assets", "ASSETS", 1, [
        ("Current Assets", [
            ("Checking/Savings", {"cash", "bank"}),
            ("Accounts Receivable", {"accounts_receivable"}),
            ("Other Current Assets", {"other_current_asset", "asset"}),
        ]),
        ("Fixed Assets", [("Fixed Assets", {"fixed_asset"})]),
    ]),
    ("liabilities", "LIABILITIES", -1, [
        ("Current Liabilities", [
            ("Accounts Payable", {"accounts_payable"}),
            ("Credit Cards", {"credit_card"}),
            ("Other Current Liabilities", {"current_liability"}),
        ]),
        ("Long Term Liabilities", [("Long Term Liabilities", {"long_term_liability"})]),
    ]),
    ("equity", "EQUITY", -1, [("Equity", [("Equity", {"equity"})])]),
]
# an account of these types showing a minus balance is almost always a data mistake
BS_SHOULD_BE_POSITIVE = {"asset", "other_current_asset", "accounts_receivable", "fixed_asset", "accounts_payable", "credit_card"}


def _bs_tree(accts: list, own: dict, show_zero: bool) -> tuple[list[dict], Decimal]:
    """Accounts of one sub-group as a tree (sub-accounts nested under their parent), each with its own amount and its rolled-up total."""
    ids = {a.id for a in accts}
    kids: dict[int, list] = {}
    for a in accts:
        if a.parent_id in ids:
            kids.setdefault(a.parent_id, []).append(a)

    def build(a):
        children = [n for n in (build(c) for c in kids.get(a.id, [])) if n]
        amount = own.get(a.id, Decimal("0"))
        if not children and amount == 0 and not show_zero:
            return None
        total = amount + sum((c["total"] for c in children), Decimal("0"))
        return {"id": a.id, "name": a.name, "account_type": a.account_type, "amount": amount, "total": total, "children": children}

    roots = [n for n in (build(a) for a in accts if a.parent_id not in ids) if n]
    return roots, sum((n["total"] for n in roots), Decimal("0"))


def _bs_floats(node: dict) -> dict:
    return {**node, "amount": float(node["amount"]), "total": float(node["total"]),
            "children": [_bs_floats(c) for c in node["children"]]}


@router.get("/balance-sheet")
def balance_sheet(as_of: date | None = None, show_zero: bool = False, db: Session = Depends(get_db)):
    as_of = as_of or date.today()
    nets = _nets(db, None, as_of)
    accounts = db.query(models.Account).order_by(models.Account.name).all()

    out, side_totals, warnings = {}, {}, []
    for side, title, sign, groups in BS_LAYOUT:
        own = {a.id: sign * nets.get(a.id, Decimal("0")) for a in accounts}
        group_out, side_total = [], Decimal("0")
        for g_title, subs in groups:
            sub_out, g_total = [], Decimal("0")
            for s_title, types in subs:
                tree, s_total = _bs_tree([a for a in accounts if a.account_type in types], own, show_zero)
                if tree or show_zero:
                    sub_out.append({"title": s_title, "accounts": [_bs_floats(n) for n in tree], "total": float(s_total)})
                    g_total += s_total
                for a in accounts:
                    if a.account_type in types and a.account_type in BS_SHOULD_BE_POSITIVE and own[a.id] < 0:
                        warnings.append({
                            "account_id": a.id, "account": a.name, "amount": float(own[a.id]),
                            "message": f"{a.name} is negative ({own[a.id]:,.2f}). "
                                       + ("Stock was sold or used without a matching stock-in entry (opening stock or a purchase bill)."
                                          if a.account_type == "asset" else "Check the entries posted to this account."),
                        })
            if sub_out:
                group_out.append({"title": g_title, "subgroups": sub_out, "total": float(g_total)})
                side_total += g_total
        out[side] = {"title": title, "groups": group_out}
        side_totals[side] = side_total

    # every sale / cost since the books began that no one has closed into Retained Earnings yet
    profit = -sum(
        (nets.get(a.id, Decimal("0")) for a in accounts if ACCOUNT_CATEGORY.get(a.account_type) in ("Income", "Expense")),
        Decimal("0"),
    )
    if profit != 0:
        eq_sub = out["equity"]["groups"][0]["subgroups"] if out["equity"]["groups"] else None
        net_node = {"id": None, "name": "Net Income", "account_type": "net_income", "amount": float(profit),
                    "total": float(profit), "children": []}
        if eq_sub:
            eq_sub[0]["accounts"].append(net_node)
            eq_sub[0]["total"] = float(Decimal(str(eq_sub[0]["total"])) + profit)
            out["equity"]["groups"][0]["total"] = float(Decimal(str(out["equity"]["groups"][0]["total"])) + profit)
        else:
            out["equity"]["groups"] = [{"title": "Equity", "total": float(profit),
                                        "subgroups": [{"title": "Equity", "accounts": [net_node], "total": float(profit)}]}]
        side_totals["equity"] += profit

    right = side_totals["liabilities"] + side_totals["equity"]
    return {
        "as_of": as_of,
        "assets": out["assets"], "liabilities": out["liabilities"], "equity": out["equity"],
        "total_assets": float(side_totals["assets"]),
        "total_liabilities": float(side_totals["liabilities"]),
        "total_equity": float(side_totals["equity"]),
        "total_liabilities_and_equity": float(right),
        "difference": float(side_totals["assets"] - right),
        "warnings": warnings,
    }


@router.get("/account-transactions")
def account_transactions(
    account_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    include_children: bool = True,
    db: Session = Depends(get_db),
):
    """Every entry behind one account, with a running balance (QuickBooks 'QuickReport' / Transaction Detail by Account)."""
    account = db.query(models.Account).get(account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    sign = 1 if ACCOUNT_CATEGORY.get(account.account_type) in DEBIT_NORMAL else -1

    all_accounts = db.query(models.Account).all()
    names = {a.id: a.name for a in all_accounts}
    ids = {account.id}
    if include_children:
        grew = True
        while grew:
            grew = False
            for a in all_accounts:
                if a.parent_id in ids and a.id not in ids:
                    ids.add(a.id)
                    grew = True

    opening = Decimal("0")
    if date_from:
        d, c = (
            db.query(func.coalesce(func.sum(models.JournalLine.debit), 0), func.coalesce(func.sum(models.JournalLine.credit), 0))
            .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
            .filter(models.JournalLine.account_id.in_(ids), models.Journal.journal_date < date_from)
            .one()
        )
        opening = sign * (_money(d) - _money(c))

    query = (
        db.query(models.JournalLine, models.Journal)
        .join(models.Journal, models.JournalLine.journal_id == models.Journal.id)
        .filter(models.JournalLine.account_id.in_(ids))
    )
    if date_from:
        query = query.filter(models.Journal.journal_date >= date_from)
    if date_to:
        query = query.filter(models.Journal.journal_date <= date_to)
    lines = query.order_by(models.Journal.journal_date, models.Journal.id, models.JournalLine.id).all()

    rows, running = [], opening
    for line, journal in lines:
        debit, credit = _money(line.debit), _money(line.credit)
        running += sign * (debit - credit)
        rows.append({
            "id": line.id, "journal_id": journal.id, "date": journal.journal_date,
            "type": _source_label(journal.source_type), "source_type": journal.source_type, "source_id": journal.source_id,
            "number": journal.journal_number, "name": journal.reference or "",
            "memo": line.description or journal.notes or "",
            "account": names.get(line.account_id, ""),
            "debit": float(debit), "credit": float(credit), "balance": float(running),
        })
    return {
        "account": {"id": account.id, "name": account.name, "account_type": account.account_type},
        "date_from": date_from, "date_to": date_to,
        "opening_balance": float(opening), "rows": rows, "closing_balance": float(running),
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



# ---------------------------------------------------------------- Sales Summary (top customers / products / trend)
@router.get("/sales-summary")
def sales_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    top: int = 10,
    db: Session = Depends(get_db),
):
    """Sales between two dates: totals, best customers, best products and a sales trend (void documents are ignored)."""
    today = date.today()
    date_to = date_to or today
    date_from = date_from or date(date_to.year, date_to.month, 1)      # default = this month
    if date_from > date_to:
        raise HTTPException(400, "Start date must be on or before the end date")
    top = max(1, min(top, 100))

    invoices = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.customer), joinedload(models.Invoice.items))
        .filter(models.Invoice.status != "void",
                models.Invoice.invoice_date >= date_from, models.Invoice.invoice_date <= date_to)
        .all()
    )
    credit_notes = (
        db.query(models.CreditNote)
        .options(joinedload(models.CreditNote.customer))
        .filter(models.CreditNote.status != "void",
                models.CreditNote.credit_date >= date_from, models.CreditNote.credit_date <= date_to)
        .all()
    )
    money_in = (
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.payment_date >= date_from, models.Payment.payment_date <= date_to)
        .scalar()
    )

    # monthly buckets when the range is longer than ~2 months, otherwise daily
    monthly = (date_to - date_from).days > 62
    bucket = (lambda d: d.strftime("%Y-%m")) if monthly else (lambda d: d.isoformat())

    customers: dict[int, dict] = {}
    products: dict[str, dict] = {}
    trend: dict[str, dict] = {}
    sales = cost = outstanding = Decimal("0")
    qty_total = 0

    def cust(cid: int, name: str) -> dict:
        if cid not in customers:
            customers[cid] = {"customer_id": cid, "customer_name": name, "invoices": 0, "quantity": 0,
                              "sales": Decimal("0"), "returns": Decimal("0"), "paid": Decimal("0"),
                              "balance": Decimal("0"), "last_purchase": None}
        return customers[cid]

    for inv in invoices:
        total, paid = _money(inv.total), _money(inv.amount_paid)
        c = cust(inv.customer_id, inv.customer_name)
        c["invoices"] += 1
        c["sales"] += total
        c["paid"] += paid
        c["balance"] += total - paid
        if c["last_purchase"] is None or inv.invoice_date > c["last_purchase"]:
            c["last_purchase"] = inv.invoice_date
        sales += total
        outstanding += total - paid

        t = trend.setdefault(bucket(inv.invoice_date), {"sales": Decimal("0"), "invoices": 0})
        t["sales"] += total
        t["invoices"] += 1

        for it in inv.items:
            qty = int(it.quantity or 0)
            line_cost = _money(it.unit_cost) * qty
            c["quantity"] += qty
            qty_total += qty
            cost += line_cost
            key = f"p{it.product_id}" if it.product_id else f"n{it.item_name}"
            p = products.setdefault(key, {"product_id": it.product_id, "item_name": it.item_name,
                                          "quantity": 0, "sales": Decimal("0"), "cost": Decimal("0")})
            p["quantity"] += qty
            p["sales"] += _money(it.amount)
            p["cost"] += line_cost

    returns = Decimal("0")
    for cn in credit_notes:
        amount = _money(cn.total)
        cust(cn.customer_id, cn.customer_name)["returns"] += amount
        returns += amount

    customer_rows = sorted(customers.values(), key=lambda x: x["sales"], reverse=True)
    product_rows = sorted(products.values(), key=lambda x: x["sales"], reverse=True)
    top_customer = customer_rows[0] if customer_rows else None

    return {
        "date_from": date_from, "date_to": date_to, "group_by": "month" if monthly else "day",
        "totals": {
            "invoice_count": len(invoices),
            "customer_count": sum(1 for c in customer_rows if c["invoices"] > 0),
            "items_sold": qty_total,
            "sales": float(sales),
            "returns": float(returns),
            "net_sales": float(sales - returns),
            "cost": float(cost),
            "gross_profit": float(sales - cost),
            "collected": float(_money(money_in)),
            "outstanding": float(outstanding),
            "average_invoice": float((sales / len(invoices)).quantize(CENT, ROUND_HALF_UP)) if invoices else 0.0,
        },
        "top_customer": {"customer_name": top_customer["customer_name"], "sales": float(top_customer["sales"])} if top_customer else None,
        "top_customers": [
            {**c, "sales": float(c["sales"]), "returns": float(c["returns"]), "paid": float(c["paid"]),
             "balance": float(c["balance"])}
            for c in customer_rows[:top]
        ],
        "top_products": [
            {**p, "sales": float(p["sales"]), "cost": float(p["cost"]), "profit": float(p["sales"] - p["cost"])}
            for p in product_rows[:top]
        ],
        "trend": [
            {"label": k, "sales": float(v["sales"]), "invoices": v["invoices"]}
            for k, v in sorted(trend.items())
        ],
    }


# ---------------------------------------------------------------- Daily Sales & Collection
@router.get("/daily-sales-collection")
def daily_sales_collection(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    """One row per day: invoices raised (sales), credit notes (returns) and payments received (collection)."""
    date_to = date_to or date.today()
    date_from = date_from or date_to
    if date_from > date_to:
        raise HTTPException(400, "Start date must be on or before the end date")
    if (date_to - date_from).days > 731:
        raise HTTPException(400, "Please pick a range of 2 years or less")

    days: dict[date, dict] = {}
    cur = date_from
    while cur <= date_to:
        days[cur] = {"date": cur.isoformat(), "invoices": 0, "sales": Decimal("0"),
                     "returns": Decimal("0"), "payments": 0, "collection": Decimal("0")}
        cur += timedelta(days=1)

    for d, count, total in (
        db.query(models.Invoice.invoice_date, func.count(models.Invoice.id), func.coalesce(func.sum(models.Invoice.total), 0))
        .filter(models.Invoice.status != "void",
                models.Invoice.invoice_date >= date_from, models.Invoice.invoice_date <= date_to)
        .group_by(models.Invoice.invoice_date).all()
    ):
        if d in days:
            days[d]["invoices"] = count
            days[d]["sales"] = _money(total)

    for d, total in (
        db.query(models.CreditNote.credit_date, func.coalesce(func.sum(models.CreditNote.total), 0))
        .filter(models.CreditNote.status != "void",
                models.CreditNote.credit_date >= date_from, models.CreditNote.credit_date <= date_to)
        .group_by(models.CreditNote.credit_date).all()
    ):
        if d in days:
            days[d]["returns"] = _money(total)

    for d, count, total in (
        db.query(models.Payment.payment_date, func.count(models.Payment.id), func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.payment_date >= date_from, models.Payment.payment_date <= date_to)
        .group_by(models.Payment.payment_date).all()
    ):
        if d in days:
            days[d]["payments"] = count
            days[d]["collection"] = _money(total)

    by_mode = [
        {"mode": mode or "Other", "amount": float(_money(total))}
        for mode, total in (
            db.query(models.Payment.payment_mode, func.coalesce(func.sum(models.Payment.amount), 0))
            .filter(models.Payment.payment_date >= date_from, models.Payment.payment_date <= date_to)
            .group_by(models.Payment.payment_mode).all()
        )
    ]
    by_mode.sort(key=lambda m: m["amount"], reverse=True)

    rows = [
        {**r, "sales": float(r["sales"]), "returns": float(r["returns"]), "collection": float(r["collection"]),
         "net_sales": float(r["sales"] - r["returns"])}
        for r in days.values()
    ]
    sales = sum((days[d]["sales"] for d in days), Decimal("0"))
    returns = sum((days[d]["returns"] for d in days), Decimal("0"))
    collection = sum((days[d]["collection"] for d in days), Decimal("0"))
    return {
        "date_from": date_from, "date_to": date_to, "rows": rows, "by_mode": by_mode,
        "totals": {
            "invoices": sum(d["invoices"] for d in days.values()),
            "payments": sum(d["payments"] for d in days.values()),
            "sales": float(sales), "returns": float(returns), "net_sales": float(sales - returns),
            "collection": float(collection), "difference": float(sales - returns - collection),
        },
    }


@router.get("/daily-sales-collection/detail")
def daily_sales_collection_detail(day: date, db: Session = Depends(get_db)):
    """The invoices and payments behind one day of the daily report."""
    invoices = (
        db.query(models.Invoice).options(joinedload(models.Invoice.customer))
        .filter(models.Invoice.status != "void", models.Invoice.invoice_date == day)
        .order_by(models.Invoice.id).all()
    )
    payments = (
        db.query(models.Payment).options(joinedload(models.Payment.customer))
        .filter(models.Payment.payment_date == day)
        .order_by(models.Payment.id).all()
    )
    return {
        "day": day,
        "invoices": [{"id": i.id, "number": i.invoice_number, "customer": i.customer_name,
                      "total": float(_money(i.total)), "paid": float(_money(i.amount_paid))} for i in invoices],
        "payments": [{"id": p.id, "number": p.payment_number, "customer": p.customer_name,
                      "mode": p.payment_mode, "amount": float(_money(p.amount))} for p in payments],
    }