import os
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.auth import IS_PRODUCTION, require_area, validate_auth_settings
from app.security import SecurityMiddleware
import app.audit_events  
from app.company_init import run_startup
from app.routers import products, requests, stock_movements, bills, issued, vendors, accounts, customers, journals, invoices,payments,purchase_bills,vendor_payments,sales_documents,credit_notes,taxes,banking,reports,dashboard,product_import,auth,users,audit_log,companies
validate_auth_settings()
run_startup()      # shared tables + every company schema (create tables, column upgrades, seeds) + roles + first Owner


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


app.include_router(auth.router)   # login / refresh / logout / switch-company live here and are NOT guarded by an area
app.include_router(companies.router)
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