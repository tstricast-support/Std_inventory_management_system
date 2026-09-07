from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from .. import models, schemas
from ..database import get_db
from ..imagekit_client import upload_image, delete_image

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return (
        db.query(models.Product)
        .options(joinedload(models.Product.images), joinedload(models.Product.category))
        .all()
    )


@router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(models.Product)
        .options(joinedload(models.Product.images), joinedload(models.Product.category))
        .filter(models.Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.post("/", response_model=schemas.ProductOut)
def create_product(
    name: str = Form(...),
    sku: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    quantity: int = Form(0),
    price: float = Form(0),
    category_id: Optional[int] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    product = models.Product(
        name=name, sku=sku, description=description,
        quantity=quantity, price=price, category_id=category_id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    for idx, img in enumerate(images):
        file_bytes = img.file.read()
        url, file_id = upload_image(file_bytes, img.filename)
        db.add(models.ProductImage(
            product_id=product.id,
            image_url=url,
            file_id=file_id,
            is_primary=(idx == 0),
        ))
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(models.Product).get(product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    if payload.category_id is not None:
        category = db.query(models.Category).get(payload.category_id)
        if not category:
            raise HTTPException(400, f"Category {payload.category_id} does not exist")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(400, f"Could not update product: {str(e.orig)}")

    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).options(joinedload(models.Product.images)).get(product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    for img in product.images:
        delete_image(img.file_id)
    db.delete(product)
    db.commit()
    return {"message": "Deleted"}

@router.put("/{product_id}/restock", response_model=schemas.ProductOut)
def restock_product(product_id: int, payload: schemas.StockAdjustment, db: Session = Depends(get_db)):
    if payload.quantity <= 0:
        raise HTTPException(400, "Quantity must be greater than 0")

    product = db.query(models.Product).get(product_id)
    if not product: 
        raise HTTPException(404, "Product not found")

    product.quantity += payload.quantity
    db.add(models.StockMovement(
        product_id=product.id,
        quantity=payload.quantity,
        movement_type="restock",
        note=payload.note,
    ))
    db.commit()
    db.refresh(product)
    return product