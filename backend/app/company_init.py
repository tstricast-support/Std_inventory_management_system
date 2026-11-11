"""Startup / schema building for the multi-company layout.

  init_shared_schema()          tables in schema "public" (users, roles, companies, ...) + their column upgrades
  init_company_schema(schema)   ONE company's tables, column upgrades and seeds  (also used by POST /companies)
  run_startup()                 what main.py calls once at start

Every statement here is schema-qualified with a validated, quoted name (quote_schema) - nothing relies on
search_path, so nothing can slip into the wrong company.
"""
import os
from contextlib import closing

from sqlalchemy import inspect, text

from app.account_types import DEFAULT_ACCOUNTS
from app.database import (
    Base, SHARED_SCHEMA, company_id_from_schema, engine, quote_schema, schema_for, shared_tables, tenant_tables,
)

_STARTUP_LOCK_ID = 727_001   # so two workers starting together do not build/alter the same tables at once


# ---------------------------------------------------------------------------------------------
# shared schema (public)
# ---------------------------------------------------------------------------------------------
def init_shared_schema(conn=None) -> None:
    """Creates the shared tables and adds the new shared columns. Pass `conn` to run inside a caller's transaction."""
    if conn is None:
        with engine.begin() as c:
            return init_shared_schema(c)
    Base.metadata.create_all(bind=conn, tables=shared_tables())
    # create_all() never alters existing tables, so new columns on already-existing shared tables are added by hand
    conn.execute(text(
        f"ALTER TABLE {SHARED_SCHEMA}.users ADD COLUMN IF NOT EXISTS last_company_id INTEGER "
        f"REFERENCES {SHARED_SCHEMA}.companies(id) ON DELETE SET NULL"))
    conn.execute(text(
        f"ALTER TABLE {SHARED_SCHEMA}.refresh_tokens ADD COLUMN IF NOT EXISTS company_id INTEGER "
        f"REFERENCES {SHARED_SCHEMA}.companies(id) ON DELETE SET NULL"))


# ---------------------------------------------------------------------------------------------
# one company schema
# ---------------------------------------------------------------------------------------------
def _add_columns(conn, S: str, table: str, columns: dict) -> None:
    """create_all() never alters existing tables, so add missing columns by hand (S = quoted schema)."""
    for col, ddl in columns.items():
        conn.execute(text(f'ALTER TABLE {S}."{table}" ADD COLUMN IF NOT EXISTS {col} {ddl}'))


def _column_upgrades(conn, S: str) -> None:
    _add_columns(conn, S, "products", {
        "item_type": "VARCHAR(30) NOT NULL DEFAULT 'Inventory Part'",
        "purchase_description": "TEXT",
        "cost": "NUMERIC(10,2) NOT NULL DEFAULT 0",
        "manufacturer_part_number": "VARCHAR(100)",
        "reorder_min": "INTEGER",
        "reorder_max": "INTEGER",
        "parent_id": f"INTEGER REFERENCES {S}.products(id) ON DELETE CASCADE",
        "cogs_account_id": f"INTEGER REFERENCES {S}.accounts(id) ON DELETE SET NULL",
        "income_account_id": f"INTEGER REFERENCES {S}.accounts(id) ON DELETE SET NULL",
        "asset_account_id": f"INTEGER REFERENCES {S}.accounts(id) ON DELETE SET NULL",
        "preferred_vendor_id": f"INTEGER REFERENCES {S}.vendors(id) ON DELETE SET NULL",
    })
    _add_columns(conn, S, "accounts", {
        "account_code": "VARCHAR(30)",
        "description": "TEXT",
        "parent_id": f"INTEGER REFERENCES {S}.accounts(id) ON DELETE SET NULL",
    })
    _add_columns(conn, S, "journals", {"source_type": "VARCHAR(30)", "source_id": "INTEGER"})
    _add_columns(conn, S, "journal_lines", {
        "reconciliation_id": f"INTEGER REFERENCES {S}.bank_reconciliations(id) ON DELETE SET NULL"})
    _add_columns(conn, S, "invoices", {
        "discount_type": "VARCHAR(10) NOT NULL DEFAULT 'amount'",
        "discount_value": "NUMERIC(12,2) NOT NULL DEFAULT 0",
        "discount_amount": "NUMERIC(12,2) NOT NULL DEFAULT 0",
    })
    for table in ("invoices", "payments", "journals", "purchase_bills", "vendor_payments",
                  "sales_documents", "credit_notes", "bills", "issued_lists"):
        _add_columns(conn, S, table, {
            "created_by_id": f"INTEGER REFERENCES {SHARED_SCHEMA}.users(id) ON DELETE SET NULL"})


def _seed_default_accounts(conn, S: str) -> None:
    """Zoho-style default accounts, added once (same rule as before)."""
    has_new_types = conn.execute(text(
        f"SELECT 1 FROM {S}.accounts WHERE account_type NOT IN ('cogs', 'income', 'asset') LIMIT 1")).first()
    if has_new_types:
        return
    for name, account_type in DEFAULT_ACCOUNTS:
        conn.execute(text(f"INSERT INTO {S}.accounts (name, account_type) VALUES (:n, :t)"),
                     {"n": name, "t": account_type})


def _seed_tax_accounts(conn, S: str) -> None:
    """The two ledger accounts tax is posted to (added once, only if missing)."""
    for name, account_type in [("Tax Payable", "current_liability"), ("Input Tax Credits", "other_current_asset")]:
        if not conn.execute(text(f"SELECT 1 FROM {S}.accounts WHERE name = :n"), {"n": name}).first():
            conn.execute(text(f"INSERT INTO {S}.accounts (name, account_type) VALUES (:n, :t)"),
                         {"n": name, "t": account_type})


def init_company_schema(schema: str, conn=None) -> None:
    """Create/upgrade everything inside ONE company schema. Safe to run on every start.
    With no `conn` it runs in ONE transaction: it either all happens or nothing does (PostgreSQL DDL is
    transactional) - POST /companies relies on that. Pass `conn` to join a caller's transaction."""
    S = quote_schema(schema)                         # raises on anything that is not co_<integer>
    if conn is None:
        with engine.begin() as c:
            return init_company_schema(schema, c)
    conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {S}"))
    # tenant tables have no schema; this connection translates "no schema" -> this company's schema
    routed = conn.execution_options(schema_translate_map={None: schema})
    Base.metadata.create_all(bind=routed, tables=tenant_tables())
    conn.execution_options(schema_translate_map=None)   # the caller's connection must not keep the routing
    _column_upgrades(conn, S)
    _seed_default_accounts(conn, S)
    _seed_tax_accounts(conn, S)


# ---------------------------------------------------------------------------------------------
# startup
# ---------------------------------------------------------------------------------------------
def legacy_tables_in_public(conn) -> list:
    """Tenant tables still sitting in public = the database has not been migrated yet."""
    have = set(inspect(conn).get_table_names(schema=SHARED_SCHEMA))
    return [t.name for t in tenant_tables() if t.name in have]


def _ensure_default_company(conn) -> None:
    """Brand-new database only: create company 1. An un-migrated old database is NEVER touched here."""
    from app.models import Company

    if conn.execute(text(f"SELECT 1 FROM {SHARED_SCHEMA}.companies LIMIT 1")).first():
        return
    if legacy_tables_in_public(conn):
        if os.getenv("MIGRATE_TO_MULTICOMPANY", "").strip().lower() == "i_have_a_backup":
            from app.migrate_to_multicompany import migrate
            migrate(conn, dry_run=False)
            return
        raise RuntimeError(
            "\n" + "=" * 70 +
            "\nThis database still has the OLD single-company layout (tables in schema 'public')."
            "\n1) Take a backup:   pg_dump --format=custom --file=backup_before_multicompany.dump \"$DATABASE_URL\""
            "\n2) Preview:        python -m app.migrate_to_multicompany --dry-run"
            "\n3) Run it:         python -m app.migrate_to_multicompany --i-have-a-backup"
            "\n   (or set MIGRATE_TO_MULTICOMPANY=i_have_a_backup once and restart; remove it afterwards)"
            "\n" + "=" * 70 + "\n")
    name = os.getenv("DEFAULT_COMPANY_NAME", "").strip() or "My Company"
    conn.execute(text(f"INSERT INTO {SHARED_SCHEMA}.companies (name, is_active) VALUES (:n, true)"), {"n": name})


def run_startup() -> None:
    """Everything main.py used to do at import time, now per company."""
    from app.auth_setup import bootstrap_owner, seed_system_roles
    from app.database import public_session
    from app.models import Company

    # one worker at a time (session-level advisory lock on its own connection)
    with engine.connect() as lock_conn:
        lock_conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": _STARTUP_LOCK_ID})
        try:
            with engine.begin() as conn:
                init_shared_schema(conn)
                _ensure_default_company(conn)
            with closing(public_session()) as db:
                companies = db.query(Company.id).filter(Company.is_active == True).order_by(Company.id).all()  # noqa: E712
            for (cid,) in companies:
                init_company_schema(schema_for(cid))
            seed_system_roles()
            bootstrap_owner()
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _STARTUP_LOCK_ID})
            lock_conn.commit()