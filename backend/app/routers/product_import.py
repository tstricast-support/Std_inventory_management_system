import csv
import io
import re
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from sqlalchemy.orm import Session, joinedload

from .. import models
from ..database import get_db
from ..imagekit_client import upload_image, delete_image
from ..upload_checks import check_image_count, read_import_file, validate_image

router = APIRouter(prefix="/api/product-import", tags=["product-import"])

ITEM_TYPES = ["Inventory Part", "Non-Inventory Part", "Service", "Inventory Assembly"]

# (header shown in Excel, internal key)
COLUMNS = [
    ("Name*", "name"),
    ("SKU", "sku"),
    ("Item Type", "item_type"),
    ("Description", "description"),
    ("Purchase Description", "purchase_description"),
    ("Quantity", "quantity"),
    ("Sales Price", "price"),
    ("Cost", "cost"),
    ("Manufacturer Part Number", "manufacturer_part_number"),
    ("Reorder Min", "reorder_min"),
    ("Reorder Max", "reorder_max"),
    ("Subitem Of (name or SKU)", "parent"),
    ("Income Account", "income_account"),
    ("COGS Account", "cogs_account"),
    ("Asset Account", "asset_account"),
    ("Preferred Vendor", "vendor"),
]
HEADER_TO_KEY = {h.lower().replace("*", "").strip(): k for h, k in COLUMNS}
# also accept the bare key / a few friendly aliases
for _h, _k in COLUMNS:
    HEADER_TO_KEY.setdefault(_k.replace("_", " "), _k)
HEADER_TO_KEY.update({
    "item name": "name", "product name": "name", "product": "name", "item": "name",
    "price": "price", "unit price": "price", "qty": "quantity", "stock": "quantity",
    "subitem of": "parent", "parent": "parent", "parent item": "parent",
    "mpn": "manufacturer_part_number", "vendor": "vendor",
})


def _clean(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _to_decimal(v, field):
    s = _clean(v)
    if s is None:
        return Decimal("0")
    try:
        d = Decimal(s.replace(",", ""))
    except InvalidOperation:
        raise ValueError(f"{field} '{s}' is not a number")
    if d < 0:
        raise ValueError(f"{field} cannot be negative")
    return d


def _to_int(v, field, allow_blank=False):
    s = _clean(v)
    if s is None:
        return None if allow_blank else 0
    try:
        n = int(Decimal(s.replace(",", "")))  # Excel often gives 10.0
    except InvalidOperation:
        raise ValueError(f"{field} '{s}' is not a whole number")
    if n < 0:
        raise ValueError(f"{field} cannot be negative")
    return n


def _read_rows(upload: UploadFile) -> List[dict]:
    """Returns [{'_row': excel_row_number, key: raw_value, ...}] using the header row."""
    name, data = read_import_file(upload)   
    if name.endswith(".csv"):
        text = data.decode("utf-8-sig", errors="replace")
        raw = list(csv.reader(io.StringIO(text)))
    elif name.endswith((".xlsx", ".xlsm")):
        try:
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(400, "Could not read this Excel file. Please use the .xlsx template.")
        raw = [list(r) for r in wb.active.iter_rows(values_only=True)]
    else:
        raise HTTPException(400, "Please upload an .xlsx or .csv file")

    # first non-empty row is the header
    header_idx = next((i for i, r in enumerate(raw) if any(_clean(c) for c in r)), None)
    if header_idx is None:
        raise HTTPException(400, "The file has no data")
    keys = []
    for cell in raw[header_idx]:
        label = (_clean(cell) or "").lower().replace("*", "").strip()
        keys.append(HEADER_TO_KEY.get(label))
    if "name" not in keys:
        raise HTTPException(400, "Missing the required 'Name' column. Download the template to see the layout.")

    rows = []
    for i in range(header_idx + 1, len(raw)):
        r = raw[i]
        if not any(_clean(c) for c in r):
            continue  # skip blank lines
        row = {"_row": i + 1}
        for key, cell in zip(keys, r):
            if key:
                row[key] = cell
        rows.append(row)
    return rows


@router.get("/template")
def download_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "Items"
    ws.append([h for h, _ in COLUMNS])
    ws.append([
        "Canon A4 Photo Paper", "PP-A4-001", "Inventory Part", "A4 glossy photo paper, 100 sheets",
        "", 25, 1500, 1100, "", 5, 50, "", "", "", "", "",
    ])
    ws.append([
        "Photo Paper 4x6", "PP-4X6-001", "Inventory Part", "", "", 40, 600, 420, "", "", "",
        "Canon A4 Photo Paper", "", "", "", "",
    ])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 22

    notes = wb.create_sheet("Notes")
    for line in [
        "Only 'Name' is required.",
        "Item Type: " + ", ".join(ITEM_TYPES) + " (blank = Inventory Part).",
        "Quantity is used only when a NEW item is created. Existing items keep their current stock.",
        "Subitem Of: type the name or SKU of the parent item. The parent can be earlier in this same file.",
        "Income / COGS / Asset Account and Preferred Vendor: type the exact name already in your system.",
        "Rows with an existing SKU are skipped, or updated if you tick 'Update existing items'.",
        "Images are added afterwards (Bulk image upload): name each file after the SKU, e.g. PP-A4-001.jpg",
    ]:
        notes.append([line])
    notes.column_dimensions["A"].width = 110

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="item-import-template.xlsx"'},
    )


@router.post("/")
def import_products(
    file: UploadFile = File(...),
    update_existing: bool = Form(False),
    dry_run: bool = Form(False),
    db: Session = Depends(get_db),
):
    rows = _read_rows(file)
    if not rows:
        raise HTTPException(400, "No item rows found under the header")
    if len(rows) > 5000:
        raise HTTPException(400, "Too many rows (max 5000 per file)")

    accounts = {a.name.strip().lower(): a for a in db.query(models.Account).all()}
    vendors = {v.name.strip().lower(): v for v in db.query(models.Vendor).all()}
    by_sku = {p.sku.strip().lower(): p for p in db.query(models.Product).filter(models.Product.sku.isnot(None)).all()}
    by_name = {}
    for p in db.query(models.Product).all():
        by_name.setdefault(p.name.strip().lower(), p)

    errors, results = [], []
    created = updated = skipped = 0

    def find_account(label, value):
        if not value:
            return None
        acc = accounts.get(value.lower())
        if not acc:
            raise ValueError(f"{label} '{value}' not found")
        return acc.id

    def find_parent(value):
        v = value.lower()
        parent = by_sku.get(v) or by_name.get(v)
        return parent

    pending = list(rows)
    # Several passes so a subitem can follow its parent even if the parent row comes later in the file.
    for _ in range(5):
        if not pending:
            break
        deferred, progress = [], False
        for row in pending:
            rn = row["_row"]
            try:
                name = _clean(row.get("name"))
                if not name:
                    raise ValueError("Name is required")
                sku = _clean(row.get("sku"))
                item_type = _clean(row.get("item_type")) or "Inventory Part"
                match = next((t for t in ITEM_TYPES if t.lower() == item_type.lower()), None)
                if not match:
                    raise ValueError(f"Item Type '{item_type}' is not valid")

                parent_ref = _clean(row.get("parent"))
                parent = None
                if parent_ref:
                    parent = find_parent(parent_ref)
                    if not parent:
                        deferred.append(row)  # maybe the parent is created later in this file
                        continue

                vendor = None
                vname = _clean(row.get("vendor"))
                if vname:
                    vendor = vendors.get(vname.lower())
                    if not vendor:
                        raise ValueError(f"Vendor '{vname}' not found")

                values = dict(
                    name=name,
                    sku=sku,
                    item_type=match,
                    description=_clean(row.get("description")),
                    purchase_description=_clean(row.get("purchase_description")),
                    price=_to_decimal(row.get("price"), "Sales Price"),
                    cost=_to_decimal(row.get("cost"), "Cost"),
                    manufacturer_part_number=_clean(row.get("manufacturer_part_number")),
                    reorder_min=_to_int(row.get("reorder_min"), "Reorder Min", allow_blank=True),
                    reorder_max=_to_int(row.get("reorder_max"), "Reorder Max", allow_blank=True),
                    parent_id=parent.id if parent else None,
                    income_account_id=find_account("Income Account", _clean(row.get("income_account"))),
                    cogs_account_id=find_account("COGS Account", _clean(row.get("cogs_account"))),
                    asset_account_id=find_account("Asset Account", _clean(row.get("asset_account"))),
                    preferred_vendor_id=vendor.id if vendor else None,
                )
                quantity = _to_int(row.get("quantity"), "Quantity")

                existing = by_sku.get(sku.lower()) if sku else None
                if existing:
                    if not update_existing:
                        skipped += 1
                        results.append({"row": rn, "name": name, "sku": sku, "action": "skipped (SKU exists)"})
                        progress = True
                        continue
                    if parent and parent.id == existing.id:
                        raise ValueError("An item cannot be a subitem of itself")
                    # blank cells do not wipe existing data; quantity is never touched on update
                    blank_ok = {"price": "price", "cost": "cost", "item_type": "item_type"}
                    for k, v in values.items():
                        if k in blank_ok and _clean(row.get(blank_ok[k])) is None:
                            continue  # blank price / cost / type cell = keep what is already saved
                        if k == "name" or v not in (None, ""):
                            setattr(existing, k, v)
                    updated += 1
                    results.append({"row": rn, "name": name, "sku": sku, "action": "updated"})
                else:
                    product = models.Product(quantity=quantity, **values)
                    db.add(product)
                    db.flush()  # gives it an id so later subitem rows can find it
                    by_name.setdefault(name.lower(), product)
                    if sku:
                        by_sku[sku.lower()] = product
                    created += 1
                    results.append({"row": rn, "name": name, "sku": sku, "action": "created"})
                progress = True
            except ValueError as e:
                errors.append({"row": rn, "name": _clean(row.get("name")), "message": str(e)})
                progress = True
        pending = deferred
        if not progress:
            break

    for row in pending:
        errors.append({
            "row": row["_row"], "name": _clean(row.get("name")),
            "message": f"Parent item '{_clean(row.get('parent'))}' not found",
        })

    results.sort(key=lambda r: r["row"])
    errors.sort(key=lambda e: e["row"])

    # All-or-nothing: if any row has an error nothing is saved, so the user can fix the file and re-upload.
    if dry_run or errors:
        db.rollback()
        saved = False
    else:
        db.commit()
        saved = True

    return {
        "saved": saved,
        "dry_run": dry_run,
        "total_rows": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "preview": results[:50],
    }


# ---------- Bulk image upload: file name = SKU (or item name) ----------
_SUFFIX = re.compile(r"^(.*?)[\s_-]+\d+$")  # PP-A4-001_2 -> PP-A4-001


@router.post("/images")
def bulk_upload_images(
    images: List[UploadFile] = File(...),
    replace_existing: bool = Form(False),
    db: Session = Depends(get_db),
):
    check_image_count(images, bulk=True)
    products = db.query(models.Product).options(joinedload(models.Product.images)).all()
    by_sku = {p.sku.strip().lower(): p for p in products if p.sku}
    by_name = {}
    for p in products:
        by_name.setdefault(p.name.strip().lower(), p)

    def find(filename):
        stem = filename.rsplit(".", 1)[0].strip().lower()
        candidates = [stem]
        m = _SUFFIX.match(stem)
        if m:
            candidates.append(m.group(1))
        for c in candidates:
            if c in by_sku:
                return by_sku[c]
            if c in by_name:
                return by_name[c]
        return None

    matched, unmatched, failed = [], [], []
    cleared = set()
    for img in images:
        fname = img.filename or ""
        try:
            safe_name = validate_image(img)
        except HTTPException as e:
            failed.append({"file": fname, "message": e.detail})
            continue
        product = find(fname)
        if not product:
            unmatched.append(fname)
            continue
        try:
            if replace_existing and product.id not in cleared:
                for old in list(product.images):
                    try:
                        delete_image(old.file_id)
                    except Exception:
                        pass
                    db.delete(old)
                db.flush()
                product.images = []
                cleared.add(product.id)
            url, file_id = upload_image(img.file.read(), safe_name)
            has_primary = any(i.is_primary for i in product.images)
            new_img = models.ProductImage(
                product_id=product.id, image_url=url, file_id=file_id, is_primary=not has_primary,
            )
            db.add(new_img)
            db.flush()
            product.images.append(new_img)
            matched.append({"file": fname, "item": product.name, "sku": product.sku})
        except Exception as e:
            failed.append({"file": fname, "message": str(e)[:150]})
    db.commit()
    return {"matched": matched, "unmatched": unmatched, "failed": failed}