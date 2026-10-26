from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

CENT = Decimal("0.01")
TERM_DAYS = {"Due on Receipt": 0, "Net 15": 15, "Net 30": 30, "Net 45": 45, "Net 60": 60}
STOCK_TRACKED_TYPE = "Inventory Part"   # only this item type has stock that goes down when sold


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _options():
    return (
        joinedload(models.Invoice.customer),
        joinedload(models.Invoice.items)
        .joinedload(models.InvoiceItem.product)
        .joinedload(models.Product.images),
    )


def _next_number(db: Session) -> str:
    last = db.query(models.Invoice).order_by(models.Invoice.id.desc()).first()
    return f"INV-{(last.id if last else 0) + 1:04d}"


def _get_or_create_account(db: Session, name: str, account_type: str) -> models.Account:
    """Fallback accounts for items that have no account chosen on the item itself."""
    account = db.query(models.Account).filter(
        models.Account.name == name, models.Account.account_type == account_type
    ).first()
    if not account:
        account = models.Account(name=name, account_type=account_type)
        db.add(account)
        db.flush()
    return account


def _receivable_account(db: Session) -> models.Account:
    account = (
        db.query(models.Account)
        .filter(models.Account.account_type == "accounts_receivable")
        .order_by(models.Account.id)
        .first()
    )
    return account or _get_or_create_account(db, "Accounts Receivable", "accounts_receivable")


@router.get("/", response_model=list[schemas.InvoiceOut])
def list_invoices(customer_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Invoice).options(*_options())
    if customer_id:
        query = query.filter(models.Invoice.customer_id == customer_id)
    return query.order_by(models.Invoice.invoice_date.desc(), models.Invoice.id.desc()).all()


@router.get("/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).options(*_options()).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return invoice


@router.post("/", response_model=schemas.InvoiceOut)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(payload.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    if not customer.is_active:
        raise HTTPException(400, "This customer is inactive")
    if not payload.items:
        raise HTTPException(400, "Add at least one item")

    due_date = payload.due_date or payload.invoice_date + timedelta(days=TERM_DAYS.get(customer.payment_terms, 0))
    if due_date < payload.invoice_date:
        raise HTTPException(400, "Due date can't be before the invoice date")

    # total quantity per item (the same item may be on two lines)
    wanted: dict[int, int] = {}
    for line in payload.items:
        if line.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        if line.rate < 0:
            raise HTTPException(400, "A rate can't be negative")
        wanted[line.product_id] = wanted.get(line.product_id, 0) + line.quantity

    products = {
        p.id: p
        for p in db.query(models.Product).filter(models.Product.id.in_(wanted.keys())).with_for_update().all()
    }
    missing = [pid for pid in wanted if pid not in products]
    if missing:
        raise HTTPException(404, f"Item(s) not found: {missing}")

    for pid in wanted:
        if products[pid].subitems:
            raise HTTPException(400, f"{products[pid].name} is a parent item. Pick one of its subitems.")

    short = [
        f"{products[pid].name} (need {qty}, only {products[pid].quantity} in stock)"
        for pid, qty in wanted.items()
        if products[pid].item_type == STOCK_TRACKED_TYPE and products[pid].quantity < qty
    ]
    if short:
        raise HTTPException(400, "Not enough stock: " + "; ".join(short))

    # ---- build the invoice lines and work out what to post to the ledger ----
    number = _next_number(db)
    invoice_lines = []
    total = Decimal("0")
    income: dict[int, Decimal] = {}      # income account -> sales amount
    cogs: dict[int, Decimal] = {}        # COGS account -> cost of what was sold
    stock: dict[int, Decimal] = {}       # inventory asset account -> cost of what was sold

    for line in payload.items:
        product = products[line.product_id]
        rate = _money(line.rate)
        amount = (rate * line.quantity).quantize(CENT, ROUND_HALF_UP)
        unit_cost = _money(product.cost)
        total += amount

        invoice_lines.append(models.InvoiceItem(
            product_id=product.id,
            item_name=product.name,
            description=(line.description or "").strip() or None,
            quantity=line.quantity,
            rate=rate,
            unit_cost=unit_cost,
            amount=amount,
        ))

        income_id = product.income_account_id or _get_or_create_account(db, "Sales", "income").id
        income[income_id] = income.get(income_id, Decimal("0")) + amount

        if product.item_type == STOCK_TRACKED_TYPE and unit_cost > 0:
            cost = (unit_cost * line.quantity).quantize(CENT, ROUND_HALF_UP)
            cogs_id = product.cogs_account_id or _get_or_create_account(db, "Cost of Goods Sold", "cogs").id
            asset_id = product.asset_account_id or _get_or_create_account(db, "Inventory Asset", "asset").id
            cogs[cogs_id] = cogs.get(cogs_id, Decimal("0")) + cost
            stock[asset_id] = stock.get(asset_id, Decimal("0")) + cost

    if total <= 0:
        raise HTTPException(400, "The invoice total must be greater than 0")

    # ---- one transaction: invoice + stock + journal are all saved, or none ----
    invoice = models.Invoice(
        invoice_number=number,
        customer_id=customer.id,
        invoice_date=payload.invoice_date,
        due_date=due_date,
        order_number=(payload.order_number or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        status="open",
        total=total,
        amount_paid=0,
        items=invoice_lines,
    )
    db.add(invoice)
    db.flush()

    for pid, qty in wanted.items():
        if products[pid].item_type == STOCK_TRACKED_TYPE:
            products[pid].quantity -= qty

    journal_lines = [models.JournalLine(
        account_id=_receivable_account(db).id, debit=total, credit=0,
        description=f"Invoice {number} - {customer.display_name}",
    )]
    for account_id, amount in income.items():
        journal_lines.append(models.JournalLine(account_id=account_id, debit=0, credit=amount, description=f"Sales {number}"))
    for account_id, amount in cogs.items():
        journal_lines.append(models.JournalLine(account_id=account_id, debit=amount, credit=0, description=f"Cost of sales {number}"))
    for account_id, amount in stock.items():
        journal_lines.append(models.JournalLine(account_id=account_id, debit=0, credit=amount, description=f"Stock sold {number}"))

    db.add(models.Journal(
        journal_number=number,
        journal_date=payload.invoice_date,
        reference=customer.display_name,
        notes=f"Invoice {number}",
        source_type="invoice",
        source_id=invoice.id,
        lines=journal_lines,
    ))
    db.commit()
    return db.query(models.Invoice).options(*_options()).filter(models.Invoice.id == invoice.id).one()


@router.put("/{invoice_id}/void", response_model=schemas.InvoiceOut)
def void_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Cancels an invoice: puts the stock back and removes its ledger entry. The invoice stays on record as Void."""
    invoice = db.query(models.Invoice).options(*_options()).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.status == "void":
        raise HTTPException(400, "This invoice is already void")
    if float(invoice.amount_paid or 0) > 0:
        raise HTTPException(400, "This invoice has payments. Remove the payments first.")

    for item in invoice.items:
        if item.product and item.product.item_type == STOCK_TRACKED_TYPE:
            item.product.quantity += item.quantity

    # delete through the ORM (not a bulk delete) so the journal's lines go with it
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "invoice", models.Journal.source_id == invoice.id
    ).all():
        db.delete(journal)

    invoice.status = "void"
    db.commit()
    return db.query(models.Invoice).options(*_options()).filter(models.Invoice.id == invoice_id).one()