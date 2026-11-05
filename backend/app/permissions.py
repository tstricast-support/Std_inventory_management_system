"""Areas, levels, special rights and the preset (system) roles.

This file is only DATA. Nothing here touches the database - auth_setup.py reads it at startup.
"""

# ---- permission levels, lowest to highest -------------------------------------------------
LEVELS = ["none", "view", "create", "full"]          # create = view + new, full = view + new + edit
LEVEL_RANK = {name: i for i, name in enumerate(LEVELS)}


def level_allows(have: str, need: str) -> bool:
    """True if a user holding level `have` may do something that needs level `need`."""
    return LEVEL_RANK.get(have, 0) >= LEVEL_RANK.get(need, 99)


# ---- areas (key, label) -------------------------------------------------------------------
AREAS = [
    ("inventory", "Inventory / Products"),
    ("requests", "Item requests"),
    ("issued", "Issued lists"),
    ("stock_bills", "Restock bills"),
    ("customers", "Customers"),
    ("vendors", "Vendors"),
    ("sales_documents", "Quotes & sales orders"),
    ("invoices", "Invoices"),
    ("credit_notes", "Credit notes"),
    ("payments_in", "Payments received"),
    ("purchase_bills", "Purchase bills"),
    ("payments_out", "Vendor payments"),
    ("chart_of_accounts", "Chart of accounts"),
    ("journals", "Journals"),
    ("banking", "Banking & reconciliation"),
    ("taxes", "Taxes"),
    ("reports", "Reports"),
    ("users", "Users, roles & audit log"),
]
AREA_KEYS = [k for k, _ in AREAS]

# ---- special rights (key, label) ----------------------------------------------------------
RIGHTS = [
    ("void_transactions", "Void transactions"),
    ("delete_records", "Delete records"),
    ("view_reports", "View reports"),
    ("edit_closed_period", "Edit closed periods"),
    ("manage_users", "Manage users & roles"),
    ("view_cost_prices", "View cost prices"),
]
RIGHT_KEYS = [k for k, _ in RIGHTS]

# ---- helper groups used to build the presets ----------------------------------------------
STOCK_AREAS = ["inventory", "requests", "issued", "stock_bills"]
ACCOUNTING_AREAS = [
    "sales_documents", "invoices", "credit_notes", "payments_in", "purchase_bills",
    "payments_out", "chart_of_accounts", "journals", "banking", "taxes", "reports",
]


def _grid(**kw) -> dict:
    return kw


def _build_presets() -> list:
    # Admin / Owner: full on everything, every right
    admin = {k: "full" for k in AREA_KEYS}

    # Accountant: full on accounting + customers + vendors, view on stock, no users
    accountant = {k: "full" for k in ACCOUNTING_AREAS + ["customers", "vendors"]}
    accountant.update({k: "view" for k in STOCK_AREAS})

    # Sales
    sales = {
        "customers": "full",
        "sales_documents": "full",
        "invoices": "create",
        "payments_in": "create",
        "inventory": "view",
        "credit_notes": "view",
    }

    # Purchasing
    purchasing = {
        "vendors": "full",
        "purchase_bills": "full",
        "payments_out": "create",
        "inventory": "view",
    }

    # Store / Employee: stock areas only, view + new (no money areas)
    store = {"inventory": "create", "requests": "create", "issued": "create"}

    # View only: view on everything except users
    view_only = {k: "view" for k in AREA_KEYS if k != "users"}

    return [
        {
            "name": "Admin",
            "description": "Owner / administrator. Full access to everything, including users and the audit log.",
            "areas": admin,
            "rights": list(RIGHT_KEYS),
        },
        {
            "name": "Accountant",
            "description": "Full access to all accounting, banking, taxes, customers and vendors. Cannot manage users or delete records.",
            "areas": accountant,
            "rights": ["void_transactions", "view_reports", "edit_closed_period", "view_cost_prices"],
        },
        {
            "name": "Sales",
            "description": "Customers, quotes/orders and invoices. No voiding, deleting, banking or reports.",
            "areas": sales,
            "rights": [],
        },
        {
            "name": "Purchasing",
            "description": "Vendors, purchase bills and vendor payments. No voiding or deleting.",
            "areas": purchasing,
            "rights": ["view_cost_prices"],
        },
        {
            "name": "Store/Employee",
            "description": "Stock room staff: view and add inventory, requests and issued lists. No money areas.",
            "areas": store,
            "rights": [],
        },
        {
            "name": "View only",
            "description": "Can look at everything except users, and run reports. Cannot change anything.",
            "areas": view_only,
            "rights": ["view_reports"],
        },
    ]


SYSTEM_ROLES = _build_presets()


# =============================================================================
# Phase 3: how HTTP requests map onto areas / levels / rights
# =============================================================================

# Which area guards which router (used in main.py via require_area(...)).
ROUTER_AREAS = {
    "products": "inventory", "product_import": "inventory", "stock_movements": "inventory",
    "requests": "requests", "issued": "issued", "bills": "stock_bills",
    "customers": "customers", "vendors": "vendors",
    "sales_documents": "sales_documents", "invoices": "invoices", "credit_notes": "credit_notes",
    "payments": "payments_in", "purchase_bills": "purchase_bills", "vendor_payments": "payments_out",
    "accounts": "chart_of_accounts", "journals": "journals", "banking": "banking", "taxes": "taxes",
    "reports": "reports", "dashboard": "reports",
}

# HTTP method -> level needed. DELETE and "/void" routes also need a special right (see below).
METHOD_LEVEL = {"GET": "view", "HEAD": "view", "POST": "create", "PUT": "full", "PATCH": "full", "DELETE": "full"}

# Areas whose READ routes also need a special right.
AREA_READ_RIGHT = {"reports": "view_reports"}

# Routes that need something different from the default. key = (METHOD, route path) -> (level, right or None)
ROUTE_OVERRIDES = {
    # deleting a custom role is a user-management action, not a "delete records" action
    ("DELETE", "/api/roles/{role_id}"): ("full", "manage_users"),
    # importing can UPDATE existing items, so it needs "full"
    ("POST", "/api/product-import/"): ("full", None),
    ("POST", "/api/product-import/images"): ("full", None),
    # un-applying a credit note from an invoice is an edit, not a delete
    ("DELETE", "/api/credit-notes/{credit_id}/applications/{application_id}"): ("full", None),
    # undoing a bank reconciliation touches closed books
    ("DELETE", "/api/banking/reconciliations/{reconciliation_id}"): ("full", "edit_closed_period"),
}

# Dropdown / picker data. A user who is NOT allowed to see an area may still READ these exact routes
# if they have view-or-more on any of the listed areas (e.g. Sales needs the account, tax and product lists
# to fill in an invoice). Everything not listed here follows the normal rule.
LOOKUP_READS = {
    "/api/products/": ["requests", "issued", "stock_bills", "sales_documents", "invoices", "credit_notes", "purchase_bills"],
    "/api/products/{product_id}": ["requests", "issued", "stock_bills", "sales_documents", "invoices", "credit_notes", "purchase_bills"],
    "/api/customers/": ["sales_documents", "invoices", "credit_notes", "payments_in"],
    "/api/vendors/": ["inventory", "purchase_bills", "payments_out"],
    "/api/accounts/": ["inventory", "sales_documents", "invoices", "credit_notes", "payments_in",
                       "purchase_bills", "payments_out", "journals", "banking", "taxes"],
    "/api/taxes/": ["inventory", "sales_documents", "invoices", "credit_notes", "purchase_bills"],
    "/api/invoices/": ["payments_in", "credit_notes"],
    "/api/invoices/{invoice_id}": ["payments_in", "credit_notes"],
    "/api/purchase-bills/": ["payments_out"],
    "/api/purchase-bills/{bill_id}": ["payments_out"],
    "/api/sales-documents/": ["invoices"],
    "/api/requests/": ["issued"],
}


# Areas where EVERY request (not just reads) also needs one special right.
AREA_ALL_RIGHT = {"users": "manage_users"}

# Areas that stay enforced even while AUTH_REQUIRED=false (otherwise anyone could create an admin through the API).
ALWAYS_ENFORCED_AREAS = {"users"}