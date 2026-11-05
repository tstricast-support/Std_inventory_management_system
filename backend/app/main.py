import os
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.account_types import DEFAULT_ACCOUNTS
from app.database import Base, engine
from app.auth import IS_PRODUCTION, require_area, validate_auth_settings
from app.security import SecurityMiddleware
import app.audit_events  
from app.auth_setup import seed_system_roles, bootstrap_owner
from app.routers import products, requests, stock_movements, bills, issued, vendors, accounts, customers, journals, invoices,payments,purchase_bills,vendor_payments,sales_documents,credit_notes,taxes,banking,reports,dashboard,product_import,auth,users,audit_log
Base.metadata.create_all(bind=engine) 


def add_accounting_columns():
    """create_all() never alters existing tables, so add the new item/accounting columns by hand."""
    existing = [c["name"] for c in inspect(engine).get_columns("products")]
    new_columns = {
        "item_type": "VARCHAR(30) NOT NULL DEFAULT 'Inventory Part'",
        "purchase_description": "TEXT",
        "cost": "NUMERIC(10,2) NOT NULL DEFAULT 0",
        "manufacturer_part_number": "VARCHAR(100)",
        "reorder_min": "INTEGER",
        "reorder_max": "INTEGER",
        "parent_id": "INTEGER REFERENCES products(id) ON DELETE CASCADE",
        "cogs_account_id": "INTEGER REFERENCES accounts(id) ON DELETE SET NULL",
        "income_account_id": "INTEGER REFERENCES accounts(id) ON DELETE SET NULL",
        "asset_account_id": "INTEGER REFERENCES accounts(id) ON DELETE SET NULL",
        "preferred_vendor_id": "INTEGER REFERENCES vendors(id) ON DELETE SET NULL",
    }
    with engine.begin() as conn:
        for col, ddl in new_columns.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE products ADD COLUMN {col} {ddl}"))


add_accounting_columns()

def add_account_columns():
    """create_all() never alters existing tables, so add the new chart-of-accounts columns by hand."""
    existing = [c["name"] for c in inspect(engine).get_columns("accounts")]
    with engine.begin() as conn:
        for col, ddl in {"account_code": "VARCHAR(30)", "description": "TEXT"}.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE accounts ADD COLUMN {col} {ddl}"))


add_account_columns()


def add_journal_columns():
    """create_all() never alters existing tables, so add the journal source columns by hand."""
    existing = [c["name"] for c in inspect(engine).get_columns("journals")]
    with engine.begin() as conn:
        for col, ddl in {"source_type": "VARCHAR(30)", "source_id": "INTEGER"}.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE journals ADD COLUMN {col} {ddl}"))


add_journal_columns()


def add_reconciliation_column():
    """Step 8B: journal_lines.reconciliation_id (create_all() only builds the new bank_reconciliations table)."""
    existing = [c["name"] for c in inspect(engine).get_columns("journal_lines")]
    if "reconciliation_id" not in existing:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE journal_lines ADD COLUMN reconciliation_id INTEGER REFERENCES bank_reconciliations(id) ON DELETE SET NULL"
            ))


add_reconciliation_column()

def seed_default_accounts():
    """First start after the chart-of-accounts upgrade: add Zoho-style default accounts once."""
    with engine.begin() as conn:
        has_new_types = conn.execute(text(
            "SELECT 1 FROM accounts WHERE account_type NOT IN ('cogs', 'income', 'asset') LIMIT 1"
        )).first()
        if has_new_types:
            return
        for name, account_type in DEFAULT_ACCOUNTS:
            conn.execute(
                text("INSERT INTO accounts (name, account_type) VALUES (:n, :t)"),
                {"n": name, "t": account_type},
            )


seed_default_accounts()

def seed_tax_accounts():
    """Step 7: the two ledger accounts tax is posted to (added once, only if missing)."""
    with engine.begin() as conn:
        for name, account_type in [("Tax Payable", "current_liability"), ("Input Tax Credits", "other_current_asset")]:
            exists = conn.execute(text("SELECT 1 FROM accounts WHERE name = :n"), {"n": name}).first()
            if not exists:
                conn.execute(
                    text("INSERT INTO accounts (name, account_type) VALUES (:n, :t)"),
                    {"n": name, "t": account_type},
                )


seed_tax_accounts()

def add_created_by_columns():
    """Login system: add a nullable created_by_id to every record type that should remember who made it."""
    tables = [
        "invoices", "payments", "journals", "purchase_bills", "vendor_payments",
        "sales_documents", "credit_notes", "bills", "issued_lists",
    ]
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in tables:
            existing = [c["name"] for c in insp.get_columns(table)]
            if "created_by_id" not in existing:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
                ))


add_created_by_columns()

validate_auth_settings()
seed_system_roles()
bootstrap_owner()


# Category was removed in favor of QuickBooks-style "Subitem of" (parent_id).
# Nothing in the app reads products.category_id or the categories table anymore,
# so they're just harmless leftovers - safe to ignore, no migration needed.
#
# We deliberately do NOT auto-drop them here: SQLite's ALTER TABLE DROP COLUMN
# refuses to drop a column that's part of a FOREIGN KEY constraint (category_id
# REFERENCES categories(id)) - dropping it properly requires SQLite to rebuild
# the whole "products" table, which is a heavier, riskier migration than an
# unused column is worth for a column nothing writes to or reads anymore.

app = FastAPI(
    title="STD OPERATIONS API",
    version="1.0.0",
    # no interactive API docs on the live server
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Allowed browser origins come from CORS_ORIGINS (comma separated). The localhost regex exists only outside production.
_cors_env = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
_live_origin = "https://stdinventorymanagementsystem-production.up.railway.app"
_cors_origins = _cors_env or ([_live_origin] if IS_PRODUCTION else [_live_origin, "http://localhost:8000"])



app.add_middleware(SecurityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # any localhost / 127.0.0.1 port (Vite moves to 5174, 5175... when 5173 is busy) - development only
    allow_origin_regex=None if IS_PRODUCTION else r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def guard(area: str):
    """Every business router gets one of these. With AUTH_REQUIRED=false it lets everything through."""
    return [Depends(require_area(area))]


app.include_router(auth.router)   # login / refresh / logout live here and are NOT guarded by an area
app.include_router(products.router, dependencies=guard("inventory"))
app.include_router(product_import.router, dependencies=guard("inventory"))
app.include_router(stock_movements.router, dependencies=guard("inventory"))
app.include_router(requests.router, dependencies=guard("requests"))
app.include_router(issued.router, dependencies=guard("issued"))
app.include_router(bills.router, dependencies=guard("stock_bills"))
app.include_router(customers.router, dependencies=guard("customers"))
app.include_router(vendors.router, dependencies=guard("vendors"))
app.include_router(sales_documents.router, dependencies=guard("sales_documents"))
app.include_router(invoices.router, dependencies=guard("invoices"))
app.include_router(credit_notes.router, dependencies=guard("credit_notes"))
app.include_router(payments.router, dependencies=guard("payments_in"))
app.include_router(purchase_bills.router, dependencies=guard("purchase_bills"))
app.include_router(vendor_payments.router, dependencies=guard("payments_out"))
app.include_router(accounts.router, dependencies=guard("chart_of_accounts"))
app.include_router(journals.router, dependencies=guard("journals"))
app.include_router(banking.router, dependencies=guard("banking"))
app.include_router(taxes.router, dependencies=guard("taxes"))
app.include_router(reports.router, dependencies=guard("reports"))
app.include_router(dashboard.router, dependencies=guard("reports"))
app.include_router(users.router, dependencies=guard("users"))
app.include_router(users.roles_router, dependencies=guard("users"))
app.include_router(audit_log.router, dependencies=guard("users"))


@app.get("/api/health")
def health():
    return {"status": "ok"}

# ---------------------------------------------------------------------------------------------
# Serve the built React app from THIS server, so the web app and the API share one address.
# (The login cookie is SameSite=Strict, so it only works when both are on the same address.)
# Put the output of "npm run build" (the dist folder) next to the app folder as "frontend_dist",
# or point the FRONTEND_DIR environment variable at it. No folder = API only, as before.
# This block must stay at the very END of the file: it answers every address nothing above matched.
# ---------------------------------------------------------------------------------------------
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR") or Path(__file__).resolve().parent.parent / "frontend_dist")

if (FRONTEND_DIR / "index.html").is_file():
    _web_root = FRONTEND_DIR.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def web_app(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")        # a wrong API address must stay a JSON 404
        clean = full_path.strip("/")
        if clean in ("admin", "admin.html"):                                # same rewrite your serve.json had
            return FileResponse(_web_root / "admin.html", headers={"Cache-Control": "no-cache"})
        if clean:
            candidate = (_web_root / clean).resolve()
            if _web_root in candidate.parents and candidate.is_file():      # real file inside the folder only
                cache = "public, max-age=31536000, immutable" if clean.startswith("assets/") else "no-cache"
                return FileResponse(candidate, headers={"Cache-Control": cache})
            if "." in clean.rsplit("/", 1)[-1]:                             # a missing .js/.png must be a 404, not the app page
                raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(_web_root / "index.html", headers={"Cache-Control": "no-cache"})
else:
    @app.get("/")
    def root():
        return {"message": "STD OPERATIONS API is running"}


