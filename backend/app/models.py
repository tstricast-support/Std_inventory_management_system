from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, ForeignKey, TIMESTAMP, Date, func,Index
from sqlalchemy.orm import relationship
from .database import Base

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
     
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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


    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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

    reconciliation_id = Column(Integer, ForeignKey("bank_reconciliations.id", ondelete="SET NULL"), nullable=True)   # step 8B

    journal = relationship("Journal", back_populates="lines")
    account = relationship("Account")

    @property
    def account_name(self):
        return self.account.name if self.account else ""

class BankReconciliation(Base):
    """Step 8B: one finished bank reconciliation (statement date + ending balance it was matched to)."""
    __tablename__ = "bank_reconciliations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    statement_date = Column(Date, nullable=False)
    statement_balance = Column(Numeric(12, 2), nullable=False)
    opening_balance = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    cleared_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(TIMESTAMP, server_default=func.now())

class Invoice(Base):
    """A sales invoice. Saving it lowers stock and posts a journal (see routers/invoices.py)."""
    __tablename__ = "invoices"

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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


# ---------- Step 5: purchase bills + vendor payments ----------
class PurchaseBill(Base):
    """A bill from a vendor. Saving it adds stock (Inventory Part lines) and posts a journal (see routers/purchase_bills.py).
    Not the same as the old `Bill` above, which is only the quick "restock several items" batch."""
    __tablename__ = "purchase_bills"

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_number = Column(String(30), nullable=False, unique=True)   # PB-0001, PB-0002 ...
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    vendor_ref = Column(String(100))                                # the vendor's own invoice number
    bill_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    notes = Column(Text)
    status = Column(String(20), nullable=False, default="open", server_default="open")  # open / void
    total = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")  # vendor payments fill this
    created_at = Column(TIMESTAMP, server_default=func.now())

    vendor = relationship("Vendor")
    items = relationship("PurchaseBillItem", back_populates="bill", cascade="all, delete-orphan",
                         order_by="PurchaseBillItem.id")

    @property
    def vendor_name(self):
        return self.vendor.name if self.vendor else ""

    @property
    def balance_due(self):
        if self.status == "void":
            return 0.0
        return float(self.total or 0) - float(self.amount_paid or 0)


class PurchaseBillItem(Base):
    """One bill line: either an item (product_id) or a plain expense (account_id)."""
    __tablename__ = "purchase_bill_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_id = Column(Integer, ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False)
    # SET NULL: deleting an item or account later must never delete the purchase history
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    item_name = Column(String(200), nullable=False)    # item name (or account name) at the time of purchase
    description = Column(Text)
    quantity = Column(Integer, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False, default=0)
    amount = Column(Numeric(12, 2), nullable=False, default=0)

    bill = relationship("PurchaseBill", back_populates="items")
    product = relationship("Product")
    account = relationship("Account")


class VendorPayment(Base):
    """Money paid to a vendor, applied to one or more of their bills."""
    __tablename__ = "vendor_payments"

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_number = Column(String(30), nullable=False, unique=True)   # VPAY-0001, VPAY-0002 ...
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_mode = Column(String(30), nullable=False, default="Cash", server_default="Cash")
    paid_from_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)   # where the money came from
    reference = Column(String(100))
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    vendor = relationship("Vendor")
    paid_from_account = relationship("Account")
    allocations = relationship("VendorPaymentAllocation", back_populates="payment", cascade="all, delete-orphan",
                               order_by="VendorPaymentAllocation.id")

    @property
    def vendor_name(self):
        return self.vendor.name if self.vendor else ""

    @property
    def paid_from_account_name(self):
        return self.paid_from_account.name if self.paid_from_account else ""


class VendorPaymentAllocation(Base):
    """How much of a vendor payment was applied to one bill."""
    __tablename__ = "vendor_payment_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(Integer, ForeignKey("vendor_payments.id", ondelete="CASCADE"), nullable=False)
    bill_id = Column(Integer, ForeignKey("purchase_bills.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    payment = relationship("VendorPayment", back_populates="allocations")
    bill = relationship("PurchaseBill")

    @property
    def bill_number(self):
        return self.bill.bill_number if self.bill else ""



# ---------- Step 6: quotes + sales orders ----------
class SalesDocument(Base):
    """A quote or a sales order. Neither touches stock or the ledger - only the invoice made from it does."""
    __tablename__ = "sales_documents"

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_type = Column(String(20), nullable=False)                      # "quote" or "sales_order"
    doc_number = Column(String(30), nullable=False, unique=True)       # QT-0001 / SO-0001 ...
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    doc_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)                          # quote: expiry date / sales order: expected shipment
    reference = Column(String(100))
    notes = Column(Text)
    # quote: draft / sent / accepted / declined / converted / invoiced      sales order: open / invoiced
    status = Column(String(20), nullable=False, default="draft", server_default="draft")
    total = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)   # set once invoiced
    source_id = Column(Integer, nullable=True)                         # sales order: id of the quote it was made from
    created_at = Column(TIMESTAMP, server_default=func.now())

    customer = relationship("Customer")
    invoice = relationship("Invoice")
    items = relationship("SalesDocumentItem", back_populates="document", cascade="all, delete-orphan",
                         order_by="SalesDocumentItem.id")

    @property
    def customer_name(self):
        return self.customer.display_name if self.customer else ""

    @property
    def invoice_number(self):
        return self.invoice.invoice_number if self.invoice else None


class SalesDocumentItem(Base):
    __tablename__ = "sales_document_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("sales_documents.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    item_name = Column(String(200), nullable=False)
    description = Column(Text)
    quantity = Column(Integer, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False, default=0)
    amount = Column(Numeric(12, 2), nullable=False, default=0)

    document = relationship("SalesDocument", back_populates="items")
    product = relationship("Product")



# ---------- Step 6B: credit notes ----------
class CreditNote(Base):
    """Money / goods given back to a customer. Posts a journal, can put stock back, and can be applied to invoices."""
    __tablename__ = "credit_notes"

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    id = Column(Integer, primary_key=True, autoincrement=True)
    credit_number = Column(String(30), nullable=False, unique=True)    # CN-0001, CN-0002 ...
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)   # the invoice it is about (optional)
    credit_date = Column(Date, nullable=False)
    reason = Column(Text)
    restock = Column(Boolean, nullable=False, default=True, server_default="1")   # goods came back -> stock goes up
    status = Column(String(20), nullable=False, default="open", server_default="open")   # open / void
    total = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    amount_applied = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")   # already used on invoices
    created_at = Column(TIMESTAMP, server_default=func.now())

    customer = relationship("Customer")
    invoice = relationship("Invoice")
    items = relationship("CreditNoteItem", back_populates="credit_note", cascade="all, delete-orphan",
                         order_by="CreditNoteItem.id")
    applications = relationship("CreditNoteApplication", back_populates="credit_note", cascade="all, delete-orphan",
                                order_by="CreditNoteApplication.id")

    @property
    def customer_name(self):
        return self.customer.display_name if self.customer else ""

    @property
    def invoice_number(self):
        return self.invoice.invoice_number if self.invoice else None

    @property
    def balance(self):
        if self.status == "void":
            return 0.0
        return float(self.total or 0) - float(self.amount_applied or 0)


class CreditNoteItem(Base):
    __tablename__ = "credit_note_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    credit_note_id = Column(Integer, ForeignKey("credit_notes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    item_name = Column(String(200), nullable=False)
    description = Column(Text)
    quantity = Column(Integer, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False, default=0)
    unit_cost = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")   # cost of the goods that came back
    amount = Column(Numeric(12, 2), nullable=False, default=0)

    credit_note = relationship("CreditNote", back_populates="items")
    product = relationship("Product")


class CreditNoteApplication(Base):
    """How much of a credit note was used to pay down one invoice."""
    __tablename__ = "credit_note_applications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    credit_note_id = Column(Integer, ForeignKey("credit_notes.id", ondelete="CASCADE"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    credit_note = relationship("CreditNote", back_populates="applications")
    invoice = relationship("Invoice")

    @property
    def invoice_number(self):
        return self.invoice.invoice_number if self.invoice else ""



# ---------- Step 7: taxes ----------
class Tax(Base):
    """A tax rate you can put on invoice / bill lines (e.g. VAT 18%)."""
    __tablename__ = "taxes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    rate = Column(Numeric(6, 3), nullable=False, default=0)          # percent, e.g. 18 means 18%
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    is_default = Column(Boolean, nullable=False, default=False, server_default="0")   # pre-selected on new lines
    created_at = Column(TIMESTAMP, server_default=func.now())

# ---------------------------------------------------------------------------
# Login / users / roles / audit (QuickBooks-style access control)
# ---------------------------------------------------------------------------

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    is_system = Column(Boolean, nullable=False, default=False, server_default="0")  # preset roles cannot be deleted
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    rights = relationship("RoleRight", back_populates="role", cascade="all, delete-orphan")


class RolePermission(Base):
    """One cell of the permission grid: this role has `level` (none/view/create/full) on `area`."""
    __tablename__ = "role_permissions"

    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    area = Column(String(50), primary_key=True)
    level = Column(String(10), nullable=False, default="none", server_default="none")

    role = relationship("Role", back_populates="permissions")


class RoleRight(Base):
    """A special right (void_transactions, delete_records, ...) granted to a role."""
    __tablename__ = "role_rights"

    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    right_name = Column(String(50), primary_key=True)   # not called "right": that is an SQL keyword

    role = relationship("Role", back_populates="rights")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=False, unique=True)  # always stored lower-case (see auth.normalize_username)
    full_name = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)          # argon2id hash, never the password
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    must_change_password = Column(Boolean, nullable=False, default=False, server_default="0")
    failed_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    locked_until = Column(TIMESTAMP, nullable=True)
    last_login = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    role = relationship("Role")


class RefreshToken(Base):
    """Opaque refresh token, stored hashed. One row per device/login; rotated on every use."""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    family_id = Column(String(36), nullable=False, index=True)   # all tokens from one login share it (reuse detection)
    expires_at = Column(TIMESTAMP, nullable=False)
    revoked = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(TIMESTAMP, server_default=func.now())
    user_agent = Column(String(255))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_record", "record_type", "record_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username = Column(String(100))          # copied, so the log still reads well if a user is changed later
    action = Column(String(50), nullable=False)   # login, login_failed, create, update, void, delete, ...
    record_type = Column(String(50))
    record_id = Column(Integer)
    summary = Column(Text)
    ip = Column(String(64))