from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from .. import models, schemas
from ..database import get_db
from ..imagekit_client import upload_image, delete_image
from ..departments import validate_department, DEFAULT_DEPARTMENT

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=list[schemas.ProductOut])
def list_products(department: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Product).options(
        joinedload(models.Product.images), joinedload(models.Product.category)
    )
    if department:
        query = query.filter(models.Product.department == department)
    return query.all()


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
    department: str = Form(DEFAULT_DEPARTMENT),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    validate_department(department)
    product = models.Product(
        name=name, sku=sku, description=description,
        quantity=quantity, price=price, category_id=category_id,
        department=department,
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

    if payload.department is not None:
        validate_department(payload.department)

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

# ---------- Image management for an existing product ----------
def _load_product(db: Session, product_id: int):
    product = (
        db.query(models.Product)
        .options(joinedload(models.Product.images), joinedload(models.Product.category))
        .filter(models.Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.post("/{product_id}/images", response_model=schemas.ProductOut)
def add_product_images(
    product_id: int,
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    product = _load_product(db, product_id)

    for img in images:
        if not (img.content_type or "").startswith("image/"):
            raise HTTPException(400, f'"{img.filename}" is not an image')

    has_primary = any(i.is_primary for i in product.images)
    for img in images:
        url, file_id = upload_image(img.file.read(), img.filename)
        db.add(models.ProductImage(
            product_id=product.id,
            image_url=url,
            file_id=file_id,
            is_primary=not has_primary,  # first image of a product becomes the main one
        ))
        has_primary = True
    db.commit()
    return _load_product(db, product_id)


@router.put("/{product_id}/images/{image_id}/primary", response_model=schemas.ProductOut)
def set_primary_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    product = _load_product(db, product_id)
    target = next((i for i in product.images if i.id == image_id), None)
    if not target:
        raise HTTPException(404, "Image not found")
    for i in product.images:
        i.is_primary = (i.id == image_id)
    db.commit()
    return _load_product(db, product_id)


@router.delete("/{product_id}/images/{image_id}", response_model=schemas.ProductOut)
def delete_product_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    product = _load_product(db, product_id)
    target = next((i for i in product.images if i.id == image_id), None)
    if not target:
        raise HTTPException(404, "Image not found")

    was_primary = target.is_primary
    file_id = target.file_id
    db.delete(target)
    db.flush()

    if was_primary:  # promote another image so the product still has a main one
        remaining = db.query(models.ProductImage).filter(models.ProductImage.product_id == product_id).first()
        if remaining:
            remaining.is_primary = True
    db.commit()

    try:
        delete_image(file_id)  # remove from ImageKit last, so a failure here can't lose DB data
    except Exception:
        pass
    return _load_product(db, product_id)