from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/issued", tags=["issued"])


@router.get("/", response_model=list[schemas.IssuedListOut])
def list_issued(db: Session = Depends(get_db)):
    # ordered by the date the admin selected (newest first), then by when it was created
    return (
        db.query(models.IssuedList)
        .options(joinedload(models.IssuedList.items).joinedload(models.IssuedItem.product))
        .order_by(
            models.IssuedList.issued_date.desc(),
            models.IssuedList.created_at.desc(),
            models.IssuedList.id.desc(),
        )
        .all()
    )


@router.post("/", response_model=schemas.IssuedListOut)
def create_issued(payload: schemas.IssuedListCreate, db: Session = Depends(get_db)):
    responsible = " ".join(payload.responsible_by.split())
    if not responsible:
        raise HTTPException(400, "Responsible by is required")
    if not payload.items:
        raise HTTPException(400, "Add at least one item to the list")

    # merge duplicate products and validate quantities
    totals: dict[int, int] = {}
    for item in payload.items:
        if item.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity

    products = {
        p.id: p
        for p in db.query(models.Product).filter(models.Product.id.in_(totals.keys())).with_for_update().all()
    }
    missing = [pid for pid in totals if pid not in products]
    if missing:
        raise HTTPException(404, f"Product(s) not found: {missing}")

    short = [
        f"{p.name} (need {totals[p.id]}, only {p.quantity} in stock)"
        for p in products.values()
        if p.quantity < totals[p.id]
    ]
    if short:
        raise HTTPException(400, "Not enough stock: " + "; ".join(short))

    # one transaction: the whole list is applied or nothing is
    description = (payload.description or "").strip() or None
    issued = models.IssuedList(
        issued_date=payload.issued_date,
        description=description,
        responsible_by=responsible,
    )
    db.add(issued)
    db.flush()

    for product_id, qty in totals.items():
        products[product_id].quantity -= qty
        db.add(models.IssuedItem(issued_list_id=issued.id, product_id=product_id, quantity=qty))

    db.commit()
    db.refresh(issued)
    return issued