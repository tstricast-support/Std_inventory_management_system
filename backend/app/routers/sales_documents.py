from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/sales-documents", tags=["sales-documents"])

CENT = Decimal("0.01")
PREFIX = {"quote": "QT", "sales_order": "SO"}
FIRST_STATUS = {"quote": "draft", "sales_order": "open"}
QUOTE_STATUSES = {"draft", "sent", "accepted", "declined"}   # the ones you can set by hand
LOCKED_STATUSES = {"invoiced", "converted"}


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _options():
    return (
        joinedload(models.SalesDocument.customer),
        joinedload(models.SalesDocument.invoice),
        joinedload(models.SalesDocument.items)
        .joinedload(models.SalesDocumentItem.product)
        .joinedload(models.Product.images),
    )


def _load(db: Session, doc_id: int):
    return db.query(models.SalesDocument).options(*_options()).filter(models.SalesDocument.id == doc_id).first()


def _next_number(db: Session, doc_type: str) -> str:
    last = (
        db.query(models.SalesDocument)
        .filter(models.SalesDocument.doc_type == doc_type)
        .order_by(models.SalesDocument.id.desc())
        .first()
    )
    number = int(last.doc_number.split("-")[1]) + 1 if last else 1
    return f"{PREFIX[doc_type]}-{number:04d}"


@router.get("/", response_model=list[schemas.SalesDocumentOut])
def list_documents(doc_type: str | None = None, customer_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.SalesDocument).options(*_options())
    if doc_type:
        query = query.filter(models.SalesDocument.doc_type == doc_type)
    if customer_id:
        query = query.filter(models.SalesDocument.customer_id == customer_id)
    return query.order_by(models.SalesDocument.doc_date.desc(), models.SalesDocument.id.desc()).all()


@router.post("/", response_model=schemas.SalesDocumentOut)
def create_document(payload: schemas.SalesDocumentCreate, db: Session = Depends(get_db)):
    if payload.doc_type not in PREFIX:
        raise HTTPException(400, "doc_type must be quote or sales_order")
    customer = db.query(models.Customer).get(payload.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    if not customer.is_active:
        raise HTTPException(400, "This customer is inactive")
    if not payload.items:
        raise HTTPException(400, "Add at least one item")
    if payload.expiry_date and payload.expiry_date < payload.doc_date:
        raise HTTPException(400, "That date can't be before the document date")

    for line in payload.items:
        if line.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        if line.rate < 0:
            raise HTTPException(400, "A rate can't be negative")

    ids = {line.product_id for line in payload.items}
    products = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(ids)).all()}
    missing = [pid for pid in ids if pid not in products]
    if missing:
        raise HTTPException(404, f"Item(s) not found: {missing}")
    for product in products.values():
        if product.subitems:
            raise HTTPException(400, f"{product.name} is a parent item. Pick one of its subitems.")

    lines = []
    total = Decimal("0")
    for line in payload.items:
        product = products[line.product_id]
        rate = _money(line.rate)
        amount = (rate * line.quantity).quantize(CENT, ROUND_HALF_UP)
        total += amount
        lines.append(models.SalesDocumentItem(
            product_id=product.id,
            item_name=product.name,
            description=(line.description or "").strip() or None,
            quantity=line.quantity,
            rate=rate,
            amount=amount,
        ))
    if total <= 0:
        raise HTTPException(400, "The total must be greater than 0")

    doc = models.SalesDocument(
        doc_type=payload.doc_type,
        doc_number=_next_number(db, payload.doc_type),
        customer_id=customer.id,
        doc_date=payload.doc_date,
        expiry_date=payload.expiry_date,
        reference=(payload.reference or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        status=FIRST_STATUS[payload.doc_type],
        total=total,
        items=lines,
    )
    db.add(doc)
    db.commit()
    return _load(db, doc.id)


@router.put("/{doc_id}/status", response_model=schemas.SalesDocumentOut)
def set_quote_status(doc_id: int, payload: schemas.SalesDocumentStatusUpdate, db: Session = Depends(get_db)):
    """Quotes only: draft -> sent -> accepted / declined."""
    doc = _load(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.doc_type != "quote":
        raise HTTPException(400, "Only quotes have a status you can change")
    if doc.status in LOCKED_STATUSES:
        raise HTTPException(400, f"This quote is already {doc.status}")
    if payload.status not in QUOTE_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(QUOTE_STATUSES)}")
    doc.status = payload.status
    db.commit()
    return _load(db, doc_id)


@router.post("/{doc_id}/to-sales-order", response_model=schemas.SalesDocumentOut)
def quote_to_sales_order(doc_id: int, db: Session = Depends(get_db)):
    """Copies a quote into a new sales order and marks the quote as converted."""
    quote = _load(db, doc_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    if quote.doc_type != "quote":
        raise HTTPException(400, "Only a quote can be converted to a sales order")
    if quote.status not in {"draft", "sent", "accepted"}:
        raise HTTPException(400, f"This quote is {quote.status}, so it can't be converted")

    order = models.SalesDocument(
        doc_type="sales_order",
        doc_number=_next_number(db, "sales_order"),
        customer_id=quote.customer_id,
        doc_date=date.today(),
        expiry_date=None,
        reference=quote.reference or quote.doc_number,
        notes=quote.notes,
        status="open",
        total=quote.total,
        source_id=quote.id,
        items=[
            models.SalesDocumentItem(
                product_id=i.product_id, item_name=i.item_name, description=i.description,
                quantity=i.quantity, rate=i.rate, amount=i.amount,
            )
            for i in quote.items
        ],
    )
    db.add(order)
    quote.status = "converted"
    db.commit()
    return _load(db, order.id)


@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = _load(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status == "invoiced":
        raise HTTPException(400, "This was invoiced. Void the invoice first.")
    if doc.status == "converted":
        raise HTTPException(400, "This quote became a sales order. Delete the sales order first.")

    if doc.doc_type == "sales_order" and doc.source_id:
        quote = db.query(models.SalesDocument).get(doc.source_id)
        if quote and quote.status == "converted":
            quote.status = "accepted"      # the quote can be converted again

    db.delete(doc)
    db.commit()
    return {"deleted": True}