from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from .invoices import _receivable_account

router = APIRouter(prefix="/api/payments", tags=["payments"])

CENT = Decimal("0.01")
PAYMENT_MODES = {"Cash", "Bank Transfer", "Cheque", "Card", "Other"}
DEPOSIT_TYPES = {"cash", "bank", "other_current_asset"}   # accounts the money can land in


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _options():
    return (
        joinedload(models.Payment.customer),
        joinedload(models.Payment.deposit_account),
        joinedload(models.Payment.allocations).joinedload(models.PaymentAllocation.invoice),
    )


def _next_number(db: Session) -> str:
    last = db.query(models.Payment).order_by(models.Payment.id.desc()).first()
    return f"PAY-{(last.id if last else 0) + 1:04d}"


@router.get("/", response_model=list[schemas.PaymentOut])
def list_payments(customer_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Payment).options(*_options())
    if customer_id:
        query = query.filter(models.Payment.customer_id == customer_id)
    return query.order_by(models.Payment.payment_date.desc(), models.Payment.id.desc()).all()


@router.post("/", response_model=schemas.PaymentOut)
def create_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(payload.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    if payload.payment_mode not in PAYMENT_MODES:
        raise HTTPException(400, f"payment_mode must be one of {sorted(PAYMENT_MODES)}")

    deposit = db.query(models.Account).get(payload.deposit_account_id)
    if not deposit or deposit.account_type not in DEPOSIT_TYPES:
        raise HTTPException(400, "Pick a cash, bank or other current asset account to deposit into")

    if not payload.allocations:
        raise HTTPException(400, "Apply the payment to at least one invoice")

    # amount applied per invoice (the same invoice may be listed twice)
    applied: dict[int, Decimal] = {}
    for a in payload.allocations:
        amount = _money(a.amount)
        if amount <= 0:
            raise HTTPException(400, "Every amount must be greater than 0")
        applied[a.invoice_id] = applied.get(a.invoice_id, Decimal("0")) + amount

    invoices = {
        i.id: i
        for i in db.query(models.Invoice).filter(models.Invoice.id.in_(applied.keys())).with_for_update().all()
    }
    for invoice_id, amount in applied.items():
        invoice = invoices.get(invoice_id)
        if not invoice:
            raise HTTPException(404, f"Invoice {invoice_id} not found")
        if invoice.customer_id != customer.id:
            raise HTTPException(400, f"{invoice.invoice_number} belongs to a different customer")
        if invoice.status != "open":
            raise HTTPException(400, f"{invoice.invoice_number} is {invoice.status}")
        balance = _money(invoice.total) - _money(invoice.amount_paid)
        if amount > balance:
            raise HTTPException(400, f"{invoice.invoice_number}: only {balance} is still owed")

    total = sum(applied.values(), Decimal("0"))
    number = _next_number(db)

    payment = models.Payment(
        payment_number=number,
        customer_id=customer.id,
        payment_date=payload.payment_date,
        amount=total,
        payment_mode=payload.payment_mode,
        deposit_account_id=deposit.id,
        reference=(payload.reference or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        allocations=[models.PaymentAllocation(invoice_id=iid, amount=amt) for iid, amt in applied.items()],
    )
    db.add(payment)
    db.flush()

    for invoice_id, amount in applied.items():
        invoices[invoice_id].amount_paid = _money(invoices[invoice_id].amount_paid) + amount

    db.add(models.Journal(
        journal_number=number,
        journal_date=payload.payment_date,
        reference=customer.display_name,
        notes=f"Payment {number}",
        source_type="payment",
        source_id=payment.id,
        lines=[
            models.JournalLine(account_id=deposit.id, debit=total, credit=0,
                               description=f"Payment {number} - {customer.display_name}"),
            models.JournalLine(account_id=_receivable_account(db).id, debit=0, credit=total,
                               description=f"Payment {number}"),
        ],
    ))
    db.commit()
    return db.query(models.Payment).options(*_options()).filter(models.Payment.id == payment.id).one()


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    """Removes a payment: the invoices owe the money again and the ledger entry is removed."""
    payment = db.query(models.Payment).options(*_options()).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    for alloc in payment.allocations:
        if alloc.invoice:
            alloc.invoice.amount_paid = max(Decimal("0"), _money(alloc.invoice.amount_paid) - _money(alloc.amount))

    # delete through the ORM (not a bulk delete) so the journal's lines go with it
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "payment", models.Journal.source_id == payment.id
    ).all():
        db.delete(journal)

    db.delete(payment)
    db.commit()
    return {"message": "Deleted"}