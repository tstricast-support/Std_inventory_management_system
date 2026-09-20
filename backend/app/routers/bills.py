from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/bills", tags=["bills"])


@router.get("/", response_model=list[schemas.BillOut])
def list_bills(db: Session = Depends(get_db)):
    return (
        db.query(models.Bill)
        .options(joinedload(models.Bill.items).joinedload(models.BillItem.product))
        .order_by(models.Bill.created_at.desc(), models.Bill.id.desc())
        .all()
    )


@router.post("/", response_model=schemas.BillOut)
def create_bill(payload: schemas.BillCreate, db: Session = Depends(get_db)):
    name = " ".join(payload.adder_name.split())
    if not name:
        raise HTTPException(400, "Stock adder name is required")
    if not payload.items:
        raise HTTPException(400, "Add at least one item to the bill")

    # merge duplicate products and validate quantities
    totals: dict[int, int] = {}
    for item in payload.items:
        if item.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity

    products = {
        p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(totals.keys())).all()
    }
    missing = [pid for pid in totals if pid not in products]
    if missing:
        raise HTTPException(404, f"Product(s) not found: {missing}")

    # one transaction: the whole bill is saved or nothing is
    bill = models.Bill(adder_name=name)
    db.add(bill)
    db.flush()

    for product_id, qty in totals.items():
        products[product_id].quantity += qty
        db.add(models.BillItem(bill_id=bill.id, product_id=product_id, quantity=qty))
        # also log it so it shows in the existing Stock History tab
        db.add(models.StockMovement(
            product_id=product_id,
            quantity=qty,
            movement_type="restock",
            note=f"Bill #{bill.id} by {name}",
        ))

    db.commit()
    db.refresh(bill)
    return bill