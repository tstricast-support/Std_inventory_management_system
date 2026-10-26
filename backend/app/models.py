from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, ForeignKey, TIMESTAMP, Date, func
from sqlalchemy.orm import relationship
from .database import Base
from .departments import DEFAULT_DEPARTMENT

class Account(Base):
    """Simple chart-of-accounts entry: a COGS, Income or Asset account (QuickBooks style)."""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    account_type = Column(String(20), nullable=False)  # see account_types.py for every allowed value
    account_code = Column(String(30))                  # optional, e.g. "1000"
    description = Column(Text)
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

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_type = Column(String(20), nullable=False, default="Business", server_default="Business")
    display_name = Column(String(150), nullable=False, unique=True)
    company_name = Column(String(150))
    contact_person = Column(String(150))
    email = Column(String(150))
    phone = Column(String(50))
    billing_address = Column(Text)
    shipping_address = Column(Text)
    payment_terms = Column(String(30), nullable=False, default="Due on Receipt", server_default="Due on Receipt")
    opening_balance = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
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



class Journal(Base):
    """A manual journal: a dated set of debit / credit lines that must balance."""
    __tablename__ = "journals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    journal_number = Column(String(30), nullable=False, unique=True)   # JNL-0001, JNL-0002 ...
    journal_date = Column(Date, nullable=False)
    reference = Column(String(100))
    source_type = Column(String(30), nullable=True)   # None = typed in by hand; "invoice" = posted automatically by an invoice
    source_id = Column(Integer, nullable=True)        # id of that invoice
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    lines = relationship("JournalLine", back_populates="journal", cascade="all, delete-orphan",
                         order_by="JournalLine.id")

    @property
    def total(self):
        return sum((line.debit or 0) for line in self.lines)


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    journal_id = Column(Integer, ForeignKey("journals.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    credit = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    description = Column(Text)

    journal = relationship("Journal", back_populates="lines")
    account = relationship("Account")

    @property
    def account_name(self):
        return self.account.name if self.account else ""



class Invoice(Base):
    """A sales invoice. Saving it lowers stock and posts a journal (see routers/invoices.py)."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(30), nullable=False, unique=True)   # INV-0001, INV-0002 ...
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    order_number = Column(String(100))
    notes = Column(Text)
    status = Column(String(20), nullable=False, default="open", server_default="open")  # open / void
    total = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")  # step 4 (payments) fills this
    created_at = Column(TIMESTAMP, server_default=func.now())

    customer = relationship("Customer")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan",
                         order_by="InvoiceItem.id")

    @property
    def customer_name(self):
        return self.customer.display_name if self.customer else ""

    @property
    def balance_due(self):
        if self.status == "void":
            return 0.0
        return float(self.total or 0) - float(self.amount_paid or 0)


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    # SET NULL: deleting an item later must never delete the sales history
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    item_name = Column(String(200), nullable=False)    # name at the time of sale
    description = Column(Text)
    quantity = Column(Integer, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False, default=0)
    unit_cost = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")  # item cost at the time of sale
    amount = Column(Numeric(12, 2), nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")



class Payment(Base):
    """Money received from a customer, applied to one or more of their invoices."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_number = Column(String(30), nullable=False, unique=True)   # PAY-0001, PAY-0002 ...
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_mode = Column(String(30), nullable=False, default="Cash", server_default="Cash")
    deposit_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)   # where the money went
    reference = Column(String(100))
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    customer = relationship("Customer")
    deposit_account = relationship("Account")
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan",
                               order_by="PaymentAllocation.id")

    @property
    def customer_name(self):
        return self.customer.display_name if self.customer else ""

    @property
    def deposit_account_name(self):
        return self.deposit_account.name if self.deposit_account else ""


class PaymentAllocation(Base):
    """How much of a payment was applied to one invoice."""
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    payment = relationship("Payment", back_populates="allocations")
    invoice = relationship("Invoice")

    @property
    def invoice_number(self):
        return self.invoice.invoice_number if self.invoice else ""