from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, ForeignKey, TIMESTAMP, Date, func
from sqlalchemy.orm import relationship
from .database import Base
from .departments import DEFAULT_DEPARTMENT

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    products = relationship("Product", back_populates="category")

class Account(Base):
    """Simple chart-of-accounts entry: a COGS, Income or Asset account (QuickBooks style)."""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    account_type = Column(String(20), nullable=False)  # "cogs" | "income" | "asset"
    created_at = Column(TIMESTAMP, server_default=func.now())


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)
    contact_person = Column(String(150))
    phone = Column(String(50))
    email = Column(String(150))
    address = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(100), unique=True)
    description = Column(Text)                 # "Description on Sales Transactions"
    purchase_description = Column(Text)         # "Description on Purchase Transactions"
    quantity = Column(Integer, nullable=False, default=0)
    price = Column(Numeric(10, 2), nullable=False, default=0)          # Sales Price
    cost = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")  # Cost
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    department = Column(String(50), nullable=False, default=DEFAULT_DEPARTMENT, server_default=DEFAULT_DEPARTMENT)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # ---- QuickBooks-style item fields ----
    item_type = Column(String(30), nullable=False, default="Inventory Part", server_default="Inventory Part")
    manufacturer_part_number = Column(String(100))
    reorder_min = Column(Integer, nullable=True)
    reorder_max = Column(Integer, nullable=True)

    parent_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True)
    cogs_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    income_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    asset_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    preferred_vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)

    category = relationship("Category", back_populates="products")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")

    cogs_account = relationship("Account", foreign_keys=[cogs_account_id])
    income_account = relationship("Account", foreign_keys=[income_account_id])
    asset_account = relationship("Account", foreign_keys=[asset_account_id])
    preferred_vendor = relationship("Vendor")

    parent = relationship("Product", remote_side=[id], back_populates="subitems")
    subitems = relationship("Product", back_populates="parent", cascade="all, delete-orphan")

    
class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=False)
    file_id = Column(String(100))
    is_primary = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product", back_populates="images")

class ItemRequest(Base):
    __tablename__ = "item_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    requested_by = Column(String(100))
    note = Column(Text)
    status = Column(String(20), nullable=False, default="pending")  # pending / approved / rejected
    created_at = Column(TIMESTAMP, server_default=func.now())
    resolved_at = Column(TIMESTAMP, nullable=True)

    product = relationship("Product")

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)  # positive = stock added
    movement_type = Column(String(20), nullable=False, default="restock")
    note = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product")

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    adder_name = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")


class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)

    bill = relationship("Bill", back_populates="items")
    product = relationship("Product")

class IssuedList(Base):
    __tablename__ = "issued_lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issued_date = Column(Date, nullable=False)          # the day the items were taken
    description = Column(Text, nullable=True)
    responsible_by = Column(String(100), nullable=False)  # who created this list
    created_at = Column(TIMESTAMP, server_default=func.now())

    items = relationship("IssuedItem", back_populates="issued_list", cascade="all, delete-orphan")
        # approved requests that this list already counted (so they are not deducted twice)
    request_links = relationship("IssuedRequestLink", back_populates="issued_list", cascade="all, delete-orphan")

    @property
    def covered_requests(self):
        return [link.request for link in self.request_links if link.request]


class IssuedItem(Base):
    __tablename__ = "issued_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issued_list_id = Column(Integer, ForeignKey("issued_lists.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)

    issued_list = relationship("IssuedList", back_populates="items")
    product = relationship("Product")

class IssuedRequestLink(Base):
    __tablename__ = "issued_request_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issued_list_id = Column(Integer, ForeignKey("issued_lists.id", ondelete="CASCADE"), nullable=False)
    # unique: one approved request can be counted by only ONE issued list
    request_id = Column(Integer, ForeignKey("item_requests.id", ondelete="CASCADE"), nullable=False, unique=True)

    issued_list = relationship("IssuedList", back_populates="request_links")
    request = relationship("ItemRequest")