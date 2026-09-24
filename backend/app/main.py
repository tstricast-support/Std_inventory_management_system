from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.departments import DEFAULT_DEPARTMENT
from app.database import Base, engine
from app.routers import products, requests, stock_movements, bills, issued, vendors, accounts
Base.metadata.create_all(bind=engine) 

def add_department_column():
    """create_all() never alters existing tables, so add the new column by hand."""
    columns = [c["name"] for c in inspect(engine).get_columns("products")]
    if "department" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                f"ALTER TABLE products ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT '{DEFAULT_DEPARTMENT}'"
            ))


add_department_column() # creates tables on startup if they don't exist

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

def merge_photobook_into_i_lab():
    """I Photobook was merged into I Lab: move any products still using the old department."""
    with engine.begin() as conn:
        conn.execute(text("UPDATE products SET department = 'i-lab' WHERE department = 'i-photobook'"))


merge_photobook_into_i_lab()
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
    title="STD Stock Manager API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "https://stdinventorymanagementsystem-production.up.railway.app",
],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(requests.router)
app.include_router(stock_movements.router)
app.include_router(bills.router)
app.include_router(issued.router)
app.include_router(vendors.router)
app.include_router(accounts.router)


@app.get("/")
def root():
    return {"message": "STD Stock Manager API is running"}


@app.get("/api/test")
def test():
    return {"message": "Backend connection successful!"}