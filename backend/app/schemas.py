from pydantic import BaseModel, ConfigDict, field_validator
from decimal import Decimal
from datetime import datetime
from typing import Optional, List


# ---------- Category ----------
class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------- Product Image ----------
class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    image_url: str
    is_primary: bool


# ---------- Product ----------
class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity: int = 0
    price: Decimal = Decimal("0")
    category_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[Decimal] = None
    category_id: Optional[int] = None

    @field_validator("category_id", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    images: List[ProductImageOut] = []
    category: Optional[CategoryOut] = None

class ItemRequestCreate(BaseModel):
    product_id: int
    quantity: int
    requested_by: Optional[str] = None
    note: Optional[str] = None

class ItemRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    requested_by: Optional[str]
    note: Optional[str]
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]
    product: Optional[ProductOut] = None

class StockAdjustment(BaseModel):
    quantity: int
    note: Optional[str] = None

class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    movement_type: str
    note: Optional[str]
    created_at: datetime
    product: Optional[ProductOut] = None