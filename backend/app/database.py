import os
import re
from dotenv import load_dotenv
from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base

load_dotenv()

# Multi-company needs PostgreSQL schemas, so SQLite is no longer supported (not even for local dev).
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):                       # Railway / Heroku style
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
if not DATABASE_URL.startswith("postgresql"):
    raise RuntimeError("DATABASE_URL must be a PostgreSQL URL (multi-company uses one schema per company).")

SHARED_SCHEMA = "public"

# ONE engine = ONE connection pool for every company. A per-company engine is only a cheap wrapper
# around it that carries schema_translate_map, so tables without a schema land in co_<id>.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Base = declarative_base()

_SCHEMA_RE = re.compile(r"^co_[1-9][0-9]{0,8}$")


def schema_for(company_id: int) -> str:
    """co_<integer id>. The id is forced through int(), so user text can never end up in a schema name."""
    return f"co_{int(company_id)}"


def quote_schema(schema: str) -> str:
    """Validates a schema name and returns it double-quoted, ready for an f-string in DDL/SQL."""
    if not isinstance(schema, str) or not _SCHEMA_RE.match(schema):
        raise ValueError(f"Invalid company schema name: {schema!r}")
    return f'"{schema}"'


def company_id_from_schema(schema: str) -> int:
    quote_schema(schema)
    return int(schema[3:])


_company_engines: dict = {}


def company_engine(company_id: int):
    cid = int(company_id)
    eng = _company_engines.get(cid)
    if eng is None:
        quote_schema(schema_for(cid))
        eng = engine.execution_options(schema_translate_map={None: schema_for(cid)})
        _company_engines[cid] = eng
    return eng


def public_session() -> Session:
    """Session WITHOUT a company: only shared tables (schema "public") work. Touching a tenant table fails loudly."""
    return Session(bind=engine, autoflush=False)


def company_session(company_id: int) -> Session:
    """Session locked to one company. Shared tables still work. For background/seed code."""
    db = Session(bind=company_engine(company_id), autoflush=False)
    db.info["company_id"] = int(company_id)
    return db


def current_company_id(db: Session) -> int:
    cid = db.info.get("company_id")
    if cid is None:
        raise RuntimeError("This session is not bound to a company.")
    return cid


def get_public_db():
    """For endpoints that run without a company (login, refresh, logout, /auth/me, later /companies)."""
    db = public_session()
    try:
        yield db
    finally:
        db.close()


def get_db(request: Request):
    """Tenant session for all business endpoints. The company was already decided AND access-checked by
    require_area() / get_current_user(), which run first. If it is missing we fail closed."""
    company_id = getattr(request.state, "company_id", None)
    if company_id is None:
        raise RuntimeError("No company resolved for this request (is the router guarded by require_area?).")
    db = company_session(company_id)
    try:
        yield db
    finally:
        db.close()


def shared_tables():
    return [t for t in Base.metadata.sorted_tables if t.schema == SHARED_SCHEMA]


def tenant_tables():
    return [t for t in Base.metadata.sorted_tables if t.schema is None]