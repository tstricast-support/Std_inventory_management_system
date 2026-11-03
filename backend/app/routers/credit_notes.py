from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from .invoices import _get_or_create_account, _receivable_account, STOCK_TRACKED_TYPE

router = APIRouter(prefix="/api/credit-notes", tags=["credit-notes"])

CENT = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _options():
    return (
        joinedload(models.CreditNote.customer),
        joinedload(models.CreditNote.invoice),
        joinedload(models.CreditNote.applications).joinedload(models.CreditNoteApplication.invoice),
        joinedload(models.CreditNote.items)
        .joinedload(models.CreditNoteItem.product)
        .joinedload(models.Product.images),
    )


def _load(db: Session, credit_id: int):
    return db.query(models.CreditNote).options(*_options()).filter(models.CreditNote.id == credit_id).first()


def _next_number(db: Session) -> str:
    last = db.query(models.CreditNote).order_by(models.CreditNote.id.desc()).first()
    return f"CN-{(last.id if last else 0) + 1:04d}"


@router.get("/", response_model=list[schemas.CreditNoteOut])
def list_credit_notes(customer_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.CreditNote).options(*_options())
    if customer_id:
        query = query.filter(models.CreditNote.customer_id == customer_id)
    return query.order_by(models.CreditNote.credit_date.desc(), models.CreditNote.id.desc()).all()


@router.post("/", response_model=schemas.CreditNoteOut)
def create_credit_note(payload: schemas.CreditNoteCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(payload.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    if not payload.items:
        raise HTTPException(400, "Add at least one item")

    invoice = None
    sold_cost: dict[int, Decimal] = {}     # product -> what it cost when it was sold on that invoice
    if payload.invoice_id:
        invoice = db.query(models.Invoice).options(joinedload(models.Invoice.items)).get(payload.invoice_id)
        if not invoice:
            raise HTTPException(404, "Invoice not found")
        if invoice.customer_id != customer.id:
            raise HTTPException(400, f"{invoice.invoice_number} belongs to a different customer")
        if invoice.status == "void":
            raise HTTPException(400, f"{invoice.invoice_number} is void")
        for item in invoice.items:
            if item.product_id and item.product_id not in sold_cost:
                sold_cost[item.product_id] = _money(item.unit_cost)

    for line in payload.items:
        if line.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        if line.rate < 0:
            raise HTTPException(400, "A rate can't be negative")

    ids = {line.product_id for line in payload.items}
    products = {
        p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(ids)).with_for_update().all()
    }
    missing = [pid for pid in ids if pid not in products]
    if missing:
        raise HTTPException(404, f"Item(s) not found: {missing}")
    for product in products.values():
        if product.subitems:
            raise HTTPException(400, f"{product.name} is a parent item. Pick one of its subitems.")

    number = _next_number(db)
    lines = []
    total = Decimal("0")
    income: dict[int, Decimal] = {}     # income account -> sales being reversed
    cogs: dict[int, Decimal] = {}       # COGS account -> cost coming back
    stock: dict[int, Decimal] = {}      # inventory asset account -> cost coming back
    back_in_stock: dict[int, int] = {}

    for line in payload.items:
        product = products[line.product_id]
        rate = _money(line.rate)
        amount = (rate * line.quantity).quantize(CENT, ROUND_HALF_UP)
        unit_cost = sold_cost.get(product.id, _money(product.cost))
        total += amount

        lines.append(models.CreditNoteItem(
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

        if payload.restock and product.item_type == STOCK_TRACKED_TYPE:
            back_in_stock[product.id] = back_in_stock.get(product.id, 0) + line.quantity
            if unit_cost > 0:
                cost = (unit_cost * line.quantity).quantize(CENT, ROUND_HALF_UP)
                cogs_id = product.cogs_account_id or _get_or_create_account(db, "Cost of Goods Sold", "cogs").id
                asset_id = product.asset_account_id or _get_or_create_account(db, "Inventory Asset", "asset").id
                cogs[cogs_id] = cogs.get(cogs_id, Decimal("0")) + cost
                stock[asset_id] = stock.get(asset_id, Decimal("0")) + cost

    if total <= 0:
        raise HTTPException(400, "The credit note total must be greater than 0")

    credit = models.CreditNote(
        credit_number=number,
        customer_id=customer.id,
        invoice_id=invoice.id if invoice else None,
        credit_date=payload.credit_date,
        reason=(payload.reason or "").strip() or None,
        restock=payload.restock,
        status="open",
        total=total,
        amount_applied=0,
        items=lines,
    )
    db.add(credit)
    db.flush()

    for pid, qty in back_in_stock.items():
        products[pid].quantity += qty

    # the reverse of an invoice: sales and receivable go down, and (if goods came back) stock goes up
    journal_lines = [models.JournalLine(
        account_id=_receivable_account(db).id, debit=0, credit=total,
        description=f"Credit note {number} - {customer.display_name}",
    )]
    for account_id, amount in income.items():
        journal_lines.append(models.JournalLine(account_id=account_id, debit=amount, credit=0, description=f"Sales return {number}"))
    for account_id, amount in stock.items():
        journal_lines.append(models.JournalLine(account_id=account_id, debit=amount, credit=0, description=f"Stock returned {number}"))
    for account_id, amount in cogs.items():
        journal_lines.append(models.JournalLine(account_id=account_id, debit=0, credit=amount, description=f"Cost reversed {number}"))

    db.add(models.Journal(
        journal_number=number,
        journal_date=payload.credit_date,
        reference=customer.display_name,
        notes=f"Credit note {number}",
        source_type="credit_note",
        source_id=credit.id,
        lines=journal_lines,
    ))
    db.commit()
    return _load(db, credit.id)


@router.post("/{credit_id}/apply", response_model=schemas.CreditNoteOut)
def apply_credit(credit_id: int, payload: schemas.CreditApplyCreate, db: Session = Depends(get_db)):
    """Uses part (or all) of the credit to pay down one invoice. Receivable stays the same, so no journal."""
    credit = db.query(models.CreditNote).with_for_update().filter(models.CreditNote.id == credit_id).first()
    if not credit:
        raise HTTPException(404, "Credit note not found")
    if credit.status != "open":
        raise HTTPException(400, f"{credit.credit_number} is {credit.status}")

    invoice = db.query(models.Invoice).with_for_update().filter(models.Invoice.id == payload.invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.customer_id != credit.customer_id:
        raise HTTPException(400, f"{invoice.invoice_number} belongs to a different customer")
    if invoice.status != "open":
        raise HTTPException(400, f"{invoice.invoice_number} is {invoice.status}")

    amount = _money(payload.amount)
    if amount <= 0:
        raise HTTPException(400, "The amount must be greater than 0")
    left = _money(credit.total) - _money(credit.amount_applied)
    if amount > left:
        raise HTTPException(400, f"Only {left} of this credit is left")
    owed = _money(invoice.total) - _money(invoice.amount_paid)
    if amount > owed:
        raise HTTPException(400, f"{invoice.invoice_number}: only {owed} is still owed")

    credit.applications.append(models.CreditNoteApplication(invoice_id=invoice.id, amount=amount))
    credit.amount_applied = _money(credit.amount_applied) + amount
    invoice.amount_paid = _money(invoice.amount_paid) + amount
    db.commit()
    return _load(db, credit_id)


@router.delete("/{credit_id}/applications/{application_id}", response_model=schemas.CreditNoteOut)
def remove_application(credit_id: int, application_id: int, db: Session = Depends(get_db)):
    """Takes the credit back off the invoice: the invoice owes that money again."""
    application = (
        db.query(models.CreditNoteApplication)
        .options(joinedload(models.CreditNoteApplication.invoice), joinedload(models.CreditNoteApplication.credit_note))
        .filter(models.CreditNoteApplication.id == application_id, models.CreditNoteApplication.credit_note_id == credit_id)
        .first()
    )
    if not application:
        raise HTTPException(404, "Application not found")

    amount = _money(application.amount)
    if application.invoice:
        application.invoice.amount_paid = max(Decimal("0"), _money(application.invoice.amount_paid) - amount)
    application.credit_note.amount_applied = max(Decimal("0"), _money(application.credit_note.amount_applied) - amount)
    db.delete(application)
    db.commit()
    return _load(db, credit_id)


@router.put("/{credit_id}/void", response_model=schemas.CreditNoteOut)
def void_credit_note(credit_id: int, db: Session = Depends(get_db)):
    """Cancels a credit note: takes the returned stock out again and removes its ledger entry."""
    credit = _load(db, credit_id)
    if not credit:
        raise HTTPException(404, "Credit note not found")
    if credit.status == "void":
        raise HTTPException(400, "This credit note is already void")
    if float(credit.amount_applied or 0) > 0:
        raise HTTPException(400, "This credit was used on invoices. Remove those first.")

    if credit.restock:
        wanted: dict[int, int] = {}
        for item in credit.items:
            if item.product and item.product.item_type == STOCK_TRACKED_TYPE:
                wanted[item.product.id] = wanted.get(item.product.id, 0) + item.quantity
        products = {
            p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(wanted.keys())).with_for_update().all()
        } if wanted else {}
        short = [
            f"{products[pid].name} (need {qty}, only {products[pid].quantity} in stock)"
            for pid, qty in wanted.items()
            if products[pid].quantity < qty
        ]
        if short:
            raise HTTPException(400, "Can't take the stock back out: " + "; ".join(short))
        for pid, qty in wanted.items():
            products[pid].quantity -= qty

    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "credit_note", models.Journal.source_id == credit.id
    ).all():
        db.delete(journal)

    credit.status = "void"
    db.commit()
    return _load(db, credit_id)
    


@router.delete("/{credit_id}")
def delete_credit_note(credit_id: int, db: Session = Depends(get_db)):
    """Permanently deletes a VOID credit note (stock and ledger were already reversed when it was voided)."""
    credit = _load(db, credit_id)
    if not credit:
        raise HTTPException(404, "Credit note not found")
    if credit.status != "void":
        raise HTTPException(400, "Only a void credit note can be deleted. Void it first.")
    if credit.applications or float(credit.amount_applied or 0) > 0:
        raise HTTPException(400, "This credit was used on invoices. Remove those first.")

    # leftover ledger entries (normally already removed by void)
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "credit_note", models.Journal.source_id == credit.id
    ).all():
        db.delete(journal)

    db.delete(credit)   # its lines go with it
    db.commit()
    return {"message": "Deleted"}