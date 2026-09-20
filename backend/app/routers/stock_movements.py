from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/stock-movements", tags=["stock-movements"])

@router.get("/", response_model=list[schemas.StockMovementOut])
def list_stock_movements(product_id: int | None = None, department: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.StockMovement).options(joinedload(models.StockMovement.product))
    if product_id:
        query = query.filter(models.StockMovement.product_id == product_id)
    if department:
        query = query.filter(models.StockMovement.product.has(models.Product.department == department))
    return query.order_by(models.StockMovement.created_at.desc()).all()