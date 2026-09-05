from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("/", response_model=list[schemas.ItemRequestOut])
def list_requests(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.ItemRequest).options(
        joinedload(models.ItemRequest.product).joinedload(models.Product.images)
    )
    if status:
        query = query.filter(models.ItemRequest.status == status)
    return query.order_by(models.ItemRequest.created_at.desc()).all()


@router.post("/", response_model=schemas.ItemRequestOut)
def create_request(payload: schemas.ItemRequestCreate, db: Session = Depends(get_db)):
    product = db.query(models.Product).get(payload.product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    if payload.quantity <= 0:
        raise HTTPException(400, "Quantity must be greater than 0")

    request = models.ItemRequest(
        product_id=payload.product_id,
        quantity=payload.quantity,
        requested_by=payload.requested_by,
        note=payload.note,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.put("/{request_id}/approve", response_model=schemas.ItemRequestOut)
def approve_request(request_id: int, db: Session = Depends(get_db)):
    request = db.query(models.ItemRequest).options(joinedload(models.ItemRequest.product)).get(request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    if request.status != "pending":
        raise HTTPException(400, f"Request already {request.status}")

    product = request.product
    if product.quantity < request.quantity:
        raise HTTPException(400, f"Not enough stock. Only {product.quantity} available.")

    product.quantity -= request.quantity
    request.status = "approved"
    request.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request


@router.put("/{request_id}/reject", response_model=schemas.ItemRequestOut)
def reject_request(request_id: int, db: Session = Depends(get_db)):
    request = db.query(models.ItemRequest).get(request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    if request.status != "pending":
        raise HTTPException(400, f"Request already {request.status}")

    request.status = "rejected"
    request.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request