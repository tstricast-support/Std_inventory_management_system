from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from .stock_posting import post_stock_journal, remove_stock_journal

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
    
    post_stock_journal(
        db, "stock_bill", bill.id,
        [(products[pid], qty) for pid, qty in totals.items()],
        reference=name, notes=f"Stock bill #{bill.id} by {name}",
    )

    db.commit()
    db.refresh(bill)
    return bill



def _clean_bill_payload(payload: schemas.BillCreate):
    name = " ".join(payload.adder_name.split())
    if not name:
        raise HTTPException(400, "Stock adder name is required")
    if not payload.items:
        raise HTTPException(400, "Add at least one item to the bill")
    totals: dict[int, int] = {}
    for item in payload.items:
        if item.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity
    return name, totals


def _load_bill(db: Session, bill_id: int) -> models.Bill:
    bill = (
        db.query(models.Bill)
        .options(joinedload(models.Bill.items))
        .filter(models.Bill.id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(404, "Bill not found")
    return bill


def _bill_qty(bill: models.Bill) -> dict[int, int]:
    old: dict[int, int] = {}
    for it in bill.items:
        old[it.product_id] = old.get(it.product_id, 0) + it.quantity
    return old


def _remove_bill_movements(db: Session, bill: models.Bill):
    # the Stock History rows this bill created (see create_bill: note = "Bill #id by name")
    db.query(models.StockMovement).filter(
        models.StockMovement.movement_type == "restock",
        models.StockMovement.note == f"Bill #{bill.id} by {bill.adder_name}",
    ).delete(synchronize_session=False)


@router.put("/{bill_id}", response_model=schemas.BillOut)
def update_bill(bill_id: int, payload: schemas.BillCreate, db: Session = Depends(get_db)):
    """Edits a bill in place: stock is corrected by the difference between the old and new quantities."""
    name, totals = _clean_bill_payload(payload)
    bill = _load_bill(db, bill_id)
    old = _bill_qty(bill)

    ids = set(totals) | set(old)
    products = {
        p.id: p
        for p in db.query(models.Product).filter(models.Product.id.in_(ids)).with_for_update().all()
    }
    missing = [pid for pid in totals if pid not in products]
    if missing:
        raise HTTPException(404, f"Product(s) not found: {missing}")

    short = [
        f"{products[pid].name} (stock would become "
        f"{products[pid].quantity - old.get(pid, 0) + totals.get(pid, 0)})"
        for pid in ids
        if pid in products and products[pid].quantity - old.get(pid, 0) + totals.get(pid, 0) < 0
    ]
    if short:
        raise HTTPException(400, "Can't save - some of this stock is already used: " + "; ".join(short))

    _remove_bill_movements(db, bill)   # must run before the name is changed
    for pid in ids:
        if pid in products:
            products[pid].quantity += totals.get(pid, 0) - old.get(pid, 0)

    bill.items.clear()
    db.flush()
    bill.adder_name = name
    for pid, qty in totals.items():
        db.add(models.BillItem(bill_id=bill.id, product_id=pid, quantity=qty))
        db.add(models.StockMovement(
            product_id=pid,
            quantity=qty,
            movement_type="restock",
            note=f"Bill #{bill.id} by {name}",
        ))
    remove_stock_journal(db, "stock_bill", bill.id)
    db.flush()
    post_stock_journal(
        db, "stock_bill", bill.id,
        [(products[pid], qty) for pid, qty in totals.items() if pid in products],
        reference=name, notes=f"Stock bill #{bill.id} by {name}",
    )
    db.commit()

    return (
        db.query(models.Bill)
        .options(joinedload(models.Bill.items).joinedload(models.BillItem.product))
        .filter(models.Bill.id == bill_id)
        .one()
    )


@router.delete("/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    """Deletes a bill: the stock it added is taken back out and its Stock History rows are removed."""
    bill = _load_bill(db, bill_id)
    old = _bill_qty(bill)

    products = {
        p.id: p
        for p in db.query(models.Product).filter(models.Product.id.in_(old.keys())).with_for_update().all()
    }
    short = [
        f"{products[pid].name} (bill added {qty}, only {products[pid].quantity} in stock now)"
        for pid, qty in old.items()
        if pid in products and products[pid].quantity < qty
    ]
    if short:
        raise HTTPException(400, "Can't delete - some of this stock is already used: " + "; ".join(short))

    for pid, qty in old.items():
        if pid in products:
            products[pid].quantity -= qty

    _remove_bill_movements(db, bill)
    remove_stock_journal(db, "stock_bill", bill.id)
    db.delete(bill)   # cascades to its items
    db.commit()
    return {"ok": True, "removed_units": sum(old.values())}