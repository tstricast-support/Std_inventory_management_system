from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/customers", tags=["customers"])

VALID_TYPES = {"Business", "Individual"}
VALID_TERMS = {"Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60"}


def _validate(payload: schemas.CustomerCreate):
    if payload.customer_type not in VALID_TYPES:
        raise HTTPException(400, f"customer_type must be one of {sorted(VALID_TYPES)}")
    if payload.payment_terms not in VALID_TERMS:
        raise HTTPException(400, f"payment_terms must be one of {sorted(VALID_TERMS)}")


@router.get("/", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.display_name).all()

@router.get("/{customer_id}/history")
def customer_history(customer_id: int, db: Session = Depends(get_db)):
    """Everything about one customer: invoices, payments, credit notes, quotes / orders and a running statement."""
    c = db.query(models.Customer).get(customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")

    f = lambda v: float(v or 0)
    d = lambda v: v.isoformat() if v else None

    invoices = (db.query(models.Invoice).filter(models.Invoice.customer_id == customer_id)
                .order_by(models.Invoice.invoice_date.desc(), models.Invoice.id.desc()).all())
    payments = (db.query(models.Payment).filter(models.Payment.customer_id == customer_id)
                .order_by(models.Payment.payment_date.desc(), models.Payment.id.desc()).all())
    credits = (db.query(models.CreditNote).filter(models.CreditNote.customer_id == customer_id)
               .order_by(models.CreditNote.credit_date.desc(), models.CreditNote.id.desc()).all())
    docs = (db.query(models.SalesDocument).filter(models.SalesDocument.customer_id == customer_id)
            .order_by(models.SalesDocument.doc_date.desc(), models.SalesDocument.id.desc()).all())

    def line(i):
        return {"item_name": i.item_name, "description": i.description,
                "quantity": i.quantity, "rate": f(i.rate), "amount": f(i.amount)}

    inv_out = [{
        "id": i.id, "number": i.invoice_number, "date": d(i.invoice_date), "due_date": d(i.due_date),
        "status": i.status, "total": f(i.total), "discount": f(i.discount_amount),
        "paid": f(i.amount_paid), "balance_due": f(i.balance_due),
        "order_number": i.order_number, "notes": i.notes,
        "items": [line(x) for x in i.items],
    } for i in invoices]

    pay_out = [{
        "id": p.id, "number": p.payment_number, "date": d(p.payment_date), "amount": f(p.amount),
        "mode": p.payment_mode, "deposit_account": p.deposit_account_name,
        "reference": p.reference, "notes": p.notes,
        "allocations": [{"invoice_number": a.invoice_number, "amount": f(a.amount)} for a in p.allocations],
    } for p in payments]

    cn_out = [{
        "id": n.id, "number": n.credit_number, "date": d(n.credit_date), "status": n.status,
        "total": f(n.total), "applied": f(n.amount_applied), "balance": f(n.balance),
        "invoice_number": n.invoice_number, "reason": n.reason,
        "items": [line(x) for x in n.items],
        "applications": [{"invoice_number": a.invoice_number, "amount": f(a.amount)} for a in n.applications],
    } for n in credits]

    doc_out = [{
        "id": s.id, "type": s.doc_type, "number": s.doc_number, "date": d(s.doc_date),
        "expiry_date": d(s.expiry_date), "status": s.status, "total": f(s.total),
        "invoice_number": s.invoice_number, "reference": s.reference,
        "items": [line(x) for x in s.items],
    } for s in docs]

    # running statement (void documents are left out)
    events = []
    for i in invoices:
        if i.status != "void":
            events.append((i.invoice_date, i.created_at or datetime.min, "Invoice", i.invoice_number, f(i.total), 0.0))
    for p in payments:
        events.append((p.payment_date, p.created_at or datetime.min, "Payment", p.payment_number, 0.0, f(p.amount)))
    for n in credits:
        if n.status != "void":
            events.append((n.credit_date, n.created_at or datetime.min, "Credit note", n.credit_number, 0.0, f(n.total)))
    events.sort(key=lambda e: (e[0], e[1]))

    opening = f(c.opening_balance)
    balance = opening
    statement = []
    for dt, _, kind, number, debit, credit in events:
        balance += debit - credit
        statement.append({"date": d(dt), "type": kind, "number": number,
                          "debit": debit, "credit": credit, "balance": round(balance, 2)})

    live_inv = [i for i in invoices if i.status != "void"]
    return {
        "customer": {
            "id": c.id, "customer_type": c.customer_type, "display_name": c.display_name,
            "company_name": c.company_name, "contact_person": c.contact_person,
            "email": c.email, "phone": c.phone, "billing_address": c.billing_address,
            "shipping_address": c.shipping_address, "payment_terms": c.payment_terms,
            "opening_balance": opening, "notes": c.notes, "is_active": c.is_active,
            "created_at": d(c.created_at),
        },
        "summary": {
            "invoice_count": len(live_inv),
            "total_invoiced": round(sum(f(i.total) for i in live_inv), 2),
            "total_paid": round(sum(f(p.amount) for p in payments), 2),
            "total_credits": round(sum(f(n.total) for n in credits if n.status != "void"), 2),
            "invoices_due": round(sum(i.balance_due for i in live_inv), 2),
            "balance": round(balance, 2),
            "last_invoice_date": d(live_inv[0].invoice_date) if live_inv else None,
            "last_payment_date": d(payments[0].payment_date) if payments else None,
        },
        "statement": statement,
        "invoices": inv_out,
        "payments": pay_out,
        "credit_notes": cn_out,
        "documents": doc_out,
    }


@router.post("/", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    _validate(payload)
    if db.query(models.Customer).filter(models.Customer.display_name == payload.display_name).first():
        raise HTTPException(400, "Customer already exists")
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    _validate(payload)
    dup = db.query(models.Customer).filter(
        models.Customer.display_name == payload.display_name,
        models.Customer.id != customer_id,
    ).first()
    if dup:
        raise HTTPException(400, "Customer already exists")
    for field, value in payload.model_dump().items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    if db.query(models.Invoice).filter(models.Invoice.customer_id == customer_id).first():
        raise HTTPException(400, "This customer has invoices, so it can't be deleted. Mark it inactive instead.")

    if db.query(models.Payment).filter(models.Payment.customer_id == customer_id).first():
        raise HTTPException(400, "This customer has payments. Delete those payments first.")

    if db.query(models.SalesDocument).filter(models.SalesDocument.customer_id == customer_id).first():
        raise HTTPException(400, "This customer has quotes / sales orders, so it can't be deleted. Mark it inactive instead.")
    if db.query(models.CreditNote).filter(models.CreditNote.customer_id == customer_id).first():
        raise HTTPException(400, "This customer has credit notes, so it can't be deleted. Mark it inactive instead.")
        
    db.delete(customer)
    db.commit()
    return {"message": "Deleted"}