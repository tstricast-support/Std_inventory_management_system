from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from .purchase_bills import _payable_account
from .accounts import block_if_reconciled

router = APIRouter(prefix="/api/vendor-payments", tags=["vendor-payments"])

CENT = Decimal("0.01")
PAYMENT_MODES = {"Cash", "Bank Transfer", "Cheque", "Card", "Other"}
PAID_FROM_TYPES = {"cash", "bank", "other_current_asset", "credit_card"}   # accounts the money can leave from


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _options():
    return (
        joinedload(models.VendorPayment.vendor),
        joinedload(models.VendorPayment.paid_from_account),
        joinedload(models.VendorPayment.allocations).joinedload(models.VendorPaymentAllocation.bill),
    )


def _next_number(db: Session) -> str:
    last = db.query(models.VendorPayment).order_by(models.VendorPayment.id.desc()).first()
    return f"VPAY-{(last.id if last else 0) + 1:04d}"


@router.get("/", response_model=list[schemas.VendorPaymentOut])
def list_vendor_payments(vendor_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.VendorPayment).options(*_options())
    if vendor_id:
        query = query.filter(models.VendorPayment.vendor_id == vendor_id)
    return query.order_by(models.VendorPayment.payment_date.desc(), models.VendorPayment.id.desc()).all()


@router.post("/", response_model=schemas.VendorPaymentOut)
def create_vendor_payment(payload: schemas.VendorPaymentCreate, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).get(payload.vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    if payload.payment_mode not in PAYMENT_MODES:
        raise HTTPException(400, f"payment_mode must be one of {sorted(PAYMENT_MODES)}")

    paid_from = db.query(models.Account).get(payload.paid_from_account_id)
    if not paid_from or paid_from.account_type not in PAID_FROM_TYPES:
        raise HTTPException(400, "Pick a cash, bank, credit card or other current asset account to pay from")

    if not payload.allocations:
        raise HTTPException(400, "Apply the payment to at least one bill")

    # amount applied per bill (the same bill may be listed twice)
    applied: dict[int, Decimal] = {}
    for a in payload.allocations:
        amount = _money(a.amount)
        if amount <= 0:
            raise HTTPException(400, "Every amount must be greater than 0")
        applied[a.bill_id] = applied.get(a.bill_id, Decimal("0")) + amount

    bills = {
        b.id: b
        for b in db.query(models.PurchaseBill).filter(models.PurchaseBill.id.in_(applied.keys())).with_for_update().all()
    }
    for bill_id, amount in applied.items():
        bill = bills.get(bill_id)
        if not bill:
            raise HTTPException(404, f"Bill {bill_id} not found")
        if bill.vendor_id != vendor.id:
            raise HTTPException(400, f"{bill.bill_number} belongs to a different vendor")
        if bill.status != "open":
            raise HTTPException(400, f"{bill.bill_number} is {bill.status}")
        balance = _money(bill.total) - _money(bill.amount_paid)
        if amount > balance:
            raise HTTPException(400, f"{bill.bill_number}: only {balance} is still owed")

    total = sum(applied.values(), Decimal("0"))
    number = _next_number(db)

    payment = models.VendorPayment(
        payment_number=number,
        vendor_id=vendor.id,
        payment_date=payload.payment_date,
        amount=total,
        payment_mode=payload.payment_mode,
        paid_from_account_id=paid_from.id,
        reference=(payload.reference or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        allocations=[models.VendorPaymentAllocation(bill_id=bid, amount=amt) for bid, amt in applied.items()],
    )
    db.add(payment)
    db.flush()

    for bill_id, amount in applied.items():
        bills[bill_id].amount_paid = _money(bills[bill_id].amount_paid) + amount

    db.add(models.Journal(
        journal_number=number,
        journal_date=payload.payment_date,
        reference=vendor.name,
        notes=f"Vendor payment {number}",
        source_type="vendor_payment",
        source_id=payment.id,
        lines=[
            models.JournalLine(account_id=_payable_account(db).id, debit=total, credit=0,
                               description=f"Payment {number} - {vendor.name}"),
            models.JournalLine(account_id=paid_from.id, debit=0, credit=total,
                               description=f"Payment {number} - {vendor.name}"),
        ],
    ))
    db.commit()
    return db.query(models.VendorPayment).options(*_options()).filter(models.VendorPayment.id == payment.id).one()


@router.delete("/{payment_id}")
def delete_vendor_payment(payment_id: int, db: Session = Depends(get_db)):
    """Removes a payment: the bills are owed again and the ledger entry is removed."""
    payment = db.query(models.VendorPayment).options(*_options()).filter(models.VendorPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    for alloc in payment.allocations:
        if alloc.bill:
            alloc.bill.amount_paid = max(Decimal("0"), _money(alloc.bill.amount_paid) - _money(alloc.amount))

    # delete through the ORM (not a bulk delete) so the journal's lines go with it
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "vendor_payment", models.Journal.source_id == payment.id
    ).all():
        block_if_reconciled(journal)
        db.delete(journal)

    db.delete(payment)
    db.commit()
    return {"message": "Deleted"}