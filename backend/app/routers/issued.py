from datetime import datetime, timedelta, time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/issued", tags=["issued"])


def _list_options():
    return (
        joinedload(models.IssuedList.items).joinedload(models.IssuedItem.product),
        joinedload(models.IssuedList.request_links)
        .joinedload(models.IssuedRequestLink.request)
        .joinedload(models.ItemRequest.product),
    )


@router.get("/", response_model=list[schemas.IssuedListOut])
def list_issued(db: Session = Depends(get_db)):
    # ordered by the date the admin selected (newest first), then by when it was created
    return (
        db.query(models.IssuedList)
        .options(*_list_options())
        .order_by(
            models.IssuedList.issued_date.desc(),
            models.IssuedList.created_at.desc(),
            models.IssuedList.id.desc(),
        )
        .all()
    )


@router.get("/reconcilable", response_model=list[schemas.CoveredRequestOut])
def reconcilable_requests(issued_date: str, days: int = 7, db: Session = Depends(get_db)):
    """Approved requests (stock ALREADY deducted) that no issued list has counted yet.
    Looks back `days` days before the chosen date, so requests approved a little
    earlier or later than the day items were taken are still offered."""
    try:
        chosen = datetime.strptime(issued_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "issued_date must be YYYY-MM-DD")
    since = datetime.combine(chosen.date() - timedelta(days=days), time.min)

    already_counted = db.query(models.IssuedRequestLink.request_id)
    return (
        db.query(models.ItemRequest)
        .options(joinedload(models.ItemRequest.product))
        .filter(
            models.ItemRequest.status == "approved",
            models.ItemRequest.resolved_at.isnot(None),
            models.ItemRequest.resolved_at >= since,
            ~models.ItemRequest.id.in_(already_counted),
        )
        .order_by(models.ItemRequest.resolved_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.IssuedListOut)
def create_issued(payload: schemas.IssuedListCreate, db: Session = Depends(get_db)):
    responsible = " ".join(payload.responsible_by.split())
    if not responsible:
        raise HTTPException(400, "Responsible by is required")
    if not payload.items:
        raise HTTPException(400, "Add at least one item to the list")

    # total taken per product (merge duplicate lines)
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

    # approved requests the admin ticked: their stock was already deducted at approval
    request_ids = list(dict.fromkeys(payload.request_ids))
    covered: dict[int, int] = {}
    counted_requests = []
    if request_ids:
        counted_requests = (
            db.query(models.ItemRequest).filter(models.ItemRequest.id.in_(request_ids)).all()
        )
        found = {r.id for r in counted_requests}
        if len(found) != len(request_ids):
            raise HTTPException(404, f"Request(s) not found: {[i for i in request_ids if i not in found]}")

        taken = {
            row[0]
            for row in db.query(models.IssuedRequestLink.request_id)
            .filter(models.IssuedRequestLink.request_id.in_(request_ids))
            .all()
        }
        for r in counted_requests:
            if r.status != "approved":
                raise HTTPException(400, f"Request #{r.id} is not approved")
            if r.id in taken:
                raise HTTPException(400, f"Request #{r.id} was already counted in another issued list")
            covered[r.product_id] = covered.get(r.product_id, 0) + r.quantity

    # what this list really has to deduct = total taken - already deducted through requests
    to_deduct: dict[int, int] = {}
    for product_id, total in totals.items():
        already = covered.get(product_id, 0)
        if already > total:
            name = products[product_id].name
            raise HTTPException(400, f"{name}: approved requests ({already}) are more than the quantity in the list ({total})")
        to_deduct[product_id] = total - already

    stray = [pid for pid in covered if pid not in totals]
    if stray:
        names = [p.name for p in db.query(models.Product).filter(models.Product.id.in_(stray)).all()]
        raise HTTPException(400, f"Approved request ticked but the item is not in the list: {', '.join(names)}")

    short = [
        f"{products[pid].name} (need {qty}, only {products[pid].quantity} in stock)"
        for pid, qty in to_deduct.items()
        if products[pid].quantity < qty
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

    for product_id, qty in to_deduct.items():
        if qty == 0:
            continue  # fully covered by approved requests: nothing left to deduct
        products[product_id].quantity -= qty
        db.add(models.IssuedItem(issued_list_id=issued.id, product_id=product_id, quantity=qty))

    for r in counted_requests:
        db.add(models.IssuedRequestLink(issued_list_id=issued.id, request_id=r.id))

    db.commit()
    return (
        db.query(models.IssuedList)
        .options(*_list_options())
        .filter(models.IssuedList.id == issued.id)
        .one()
    )


@router.delete("/{issued_id}")
def undo_issued(issued_id: int, db: Session = Depends(get_db)):
    """Undo a list: puts the deducted stock back and frees its approved requests
    so they can be counted again. (Stock from the requests themselves is NOT touched.)"""
    issued = (
        db.query(models.IssuedList)
        .options(joinedload(models.IssuedList.items))
        .filter(models.IssuedList.id == issued_id)
        .first()
    )
    if not issued:
        raise HTTPException(404, "Issued list not found")

    restored = 0
    for item in issued.items:
        product = db.query(models.Product).get(item.product_id)
        if product:
            product.quantity += item.quantity
            restored += item.quantity

    db.delete(issued)  # cascades to its items and request links
    db.commit()
    return {"ok": True, "restored_units": restored}