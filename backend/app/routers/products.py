from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from .. import models, schemas
from ..database import current_company_id, get_db
from ..imagekit_client import upload_image, delete_image
from ..upload_checks import check_image_count, validate_image

router = APIRouter(prefix="/api/products", tags=["products"])

PRODUCT_RELATIONS = (
    joinedload(models.Product.images),
    joinedload(models.Product.cogs_account),
    joinedload(models.Product.income_account),
    joinedload(models.Product.asset_account),
    joinedload(models.Product.preferred_vendor),
    joinedload(models.Product.subitems),
)

@router.get("/", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    query = db.query(models.Product).options(*PRODUCT_RELATIONS)
    # only top-level items; subitems ride along nested inside `subitems`
    query = query.filter(models.Product.parent_id.is_(None))
    return query.all()


@router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(models.Product)
        .options(*PRODUCT_RELATIONS)
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
    purchase_description: Optional[str] = Form(None),
    quantity: int = Form(0),
    price: float = Form(0),
    cost: float = Form(0),
    item_type: str = Form("Inventory Part"),
    manufacturer_part_number: Optional[str] = Form(None),
    reorder_min: Optional[int] = Form(None),
    reorder_max: Optional[int] = Form(None),
    parent_id: Optional[int] = Form(None),
    cogs_account_id: Optional[int] = Form(None),
    income_account_id: Optional[int] = Form(None),
    asset_account_id: Optional[int] = Form(None),
    preferred_vendor_id: Optional[int] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):

    check_image_count(images)
    safe_names = [validate_image(img) for img in images]   # refuse bad pictures BEFORE the item is saved

    if parent_id is not None:
        parent = db.query(models.Product).get(parent_id)
        if not parent:
            raise HTTPException(400, f"Parent item {parent_id} does not exist")

    product = models.Product(
        name=name, sku=(sku or "").strip() or None, description=description, purchase_description=purchase_description,
        quantity=quantity, price=price, cost=cost,
        item_type=item_type, manufacturer_part_number=manufacturer_part_number,
        reorder_min=reorder_min, reorder_max=reorder_max, parent_id=parent_id,
        cogs_account_id=cogs_account_id, income_account_id=income_account_id,
        asset_account_id=asset_account_id, preferred_vendor_id=preferred_vendor_id,
    )
    
    db.add(product)
    try:
        db.commit()
    except IntegrityError:                       # SKU already used inside THIS company
        db.rollback()
        raise HTTPException(400, "An item with that SKU already exists.")
    db.refresh(product)

    for idx, img in enumerate(images):
        file_bytes = img.file.read()
        url, file_id = upload_image(file_bytes, safe_names[idx], current_company_id(db))
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


    if payload.parent_id is not None:
        if payload.parent_id == product_id:
            raise HTTPException(400, "An item cannot be a subitem of itself")
        parent = db.query(models.Product).get(payload.parent_id)
        if not parent:
            raise HTTPException(400, f"Parent item {payload.parent_id} does not exist")

    data = payload.model_dump(exclude_unset=True)
    if "sku" in data:
        data["sku"] = (data["sku"] or "").strip() or None

    for field, value in data.items():
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
        .options(joinedload(models.Product.images))
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

    check_image_count(images)
    safe_names = [validate_image(img) for img in images]   # real picture? small enough? checked before anything is saved

    has_primary = any(i.is_primary for i in product.images)
    for img, safe_name in zip(images, safe_names):
        url, file_id = upload_image(img.file.read(), safe_name, current_company_id(db))
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