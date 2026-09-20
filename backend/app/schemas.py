from pydantic import BaseModel, ConfigDict, field_validator
from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List
from .departments import DEFAULT_DEPARTMENT


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
    department: str = DEFAULT_DEPARTMENT

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[Decimal] = None
    category_id: Optional[int] = None
    department: Optional[str] = None

    @field_validator("category_id", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("sku", mode="before")
    @classmethod
    def empty_sku_to_none(cls, v):
        # an empty SKU must be stored as NULL, otherwise two products
        # without an SKU collide on the unique constraint
        if v is None:
            return None
        v = str(v).strip()
        return v or None

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

# ---------- Bill ----------
class BillItemCreate(BaseModel):
    product_id: int
    quantity: int

class BillCreate(BaseModel):
    adder_name: str
    items: List[BillItemCreate]

class BillProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    department: str

class BillItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    product: Optional[BillProductOut] = None

class BillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    adder_name: str
    created_at: datetime
    items: List[BillItemOut] = []

# ---------- Issued list ----------
class IssuedItemCreate(BaseModel):
    product_id: int
    quantity: int          # total taken (the number on the QuickBooks list)

class IssuedListCreate(BaseModel):
    issued_date: date
    description: Optional[str] = None
    responsible_by: str
    items: List[IssuedItemCreate]
    request_ids: List[int] = []   # approved requests already deducted earlier (ticked in the form)

class IssuedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int          # amount actually deducted by this list
    product: Optional[BillProductOut] = None

class CoveredRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    requested_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    product: Optional[BillProductOut] = None

class IssuedListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issued_date: date
    description: Optional[str] = None
    responsible_by: str
    created_at: datetime
    items: List[IssuedItemOut] = []
    covered_requests: List[CoveredRequestOut] = []