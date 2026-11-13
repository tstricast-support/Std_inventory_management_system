from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from .invoices import _get_or_create_account, STOCK_TRACKED_TYPE

router = APIRouter(prefix="/api/purchase-bills", tags=["purchase-bills"])

CENT = Decimal("0.01")
# accounts a plain "expense" line on a bill can be charged to
EXPENSE_LINE_TYPES = {"expense", "other_expense", "cogs", "fixed_asset", "other_current_asset"}


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, ROUND_HALF_UP)


def _options():
    return (
        joinedload(models.PurchaseBill.vendor),
        joinedload(models.PurchaseBill.items)
        .joinedload(models.PurchaseBillItem.product)
        .joinedload(models.Product.images),
    )


def _next_number(db: Session) -> str:
    last = db.query(models.PurchaseBill).order_by(models.PurchaseBill.id.desc()).first()
    return f"PB-{(last.id if last else 0) + 1:04d}"


def _payable_account(db: Session) -> models.Account:
    account = (
        db.query(models.Account)
        .filter(models.Account.account_type == "accounts_payable")
        .order_by(models.Account.id)
        .first()
    )
    return account or _get_or_create_account(db, "Accounts Payable", "accounts_payable")


@router.get("/", response_model=list[schemas.PurchaseBillOut])
def list_purchase_bills(vendor_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.PurchaseBill).options(*_options())
    if vendor_id:
        query = query.filter(models.PurchaseBill.vendor_id == vendor_id)
    return query.order_by(models.PurchaseBill.bill_date.desc(), models.PurchaseBill.id.desc()).all()


@router.get("/{bill_id}", response_model=schemas.PurchaseBillOut)
def get_purchase_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(models.PurchaseBill).options(*_options()).filter(models.PurchaseBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    return bill


@router.post("/", response_model=schemas.PurchaseBillOut)
def create_purchase_bill(payload: schemas.PurchaseBillCreate, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).get(payload.vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    if not payload.items:
        raise HTTPException(400, "Add at least one line")

    due_date = payload.due_date or payload.bill_date
    if due_date < payload.bill_date:
        raise HTTPException(400, "Due date can't be before the bill date")

    # ---- check every line, and collect which items / accounts it uses ----
    product_ids: set[int] = set()
    account_ids: set[int] = set()
    for line in payload.items:
        if bool(line.product_id) == bool(line.account_id):
            raise HTTPException(400, "Every line needs either an item or an expense account (not both, not neither)")
        if line.quantity <= 0:
            raise HTTPException(400, "Every quantity must be greater than 0")
        if line.rate < 0:
            raise HTTPException(400, "A rate can't be negative")
        if line.product_id:
            product_ids.add(line.product_id)
        else:
            account_ids.add(line.account_id)

    products = {}
    if product_ids:
        products = {
            p.id: p
            for p in db.query(models.Product).filter(models.Product.id.in_(product_ids)).with_for_update().all()
        }
        missing = [pid for pid in product_ids if pid not in products]
        if missing:
            raise HTTPException(404, f"Item(s) not found: {missing}")
        for p in products.values():
            if p.subitems:
                raise HTTPException(400, f"{p.name} is a parent item. Pick one of its subitems.")

    accounts = {}
    if account_ids:
        accounts = {a.id: a for a in db.query(models.Account).filter(models.Account.id.in_(account_ids)).all()}
        for aid in account_ids:
            if aid not in accounts:
                raise HTTPException(404, f"Account {aid} not found")
            if accounts[aid].account_type not in EXPENSE_LINE_TYPES:
                raise HTTPException(400, f"{accounts[aid].name} can't be used on a bill line. Pick an expense account.")

    # ---- build the bill lines and work out what to post to the ledger ----
    number = _next_number(db)
    bill_lines = []
    total = Decimal("0")
    debits: dict[int, Decimal] = {}          # account -> amount to debit (stock asset, COGS or expense)
    bought: dict[int, list] = {}             # tracked item -> [quantity bought, what it cost]

    for line in payload.items:
        rate = _money(line.rate)
        amount = (rate * line.quantity).quantize(CENT, ROUND_HALF_UP)
        total += amount

        if line.product_id:
            product = products[line.product_id]
            name = product.name
            if product.item_type == STOCK_TRACKED_TYPE:
                debit_id = product.asset_account_id or _get_or_create_account(db, "Inventory Asset", "asset").id
                entry = bought.setdefault(product.id, [0, Decimal("0")])
                entry[0] += line.quantity
                entry[1] += amount
            else:   # service / non-inventory part: no stock, it is simply a cost
                debit_id = product.cogs_account_id or _get_or_create_account(db, "Cost of Goods Sold", "cogs").id
        else:
            product = None
            name = accounts[line.account_id].name
            debit_id = line.account_id

        debits[debit_id] = debits.get(debit_id, Decimal("0")) + amount
        bill_lines.append(models.PurchaseBillItem(
            product_id=product.id if product else None,
            account_id=line.account_id if not product else None,
            item_name=name,
            description=(line.description or "").strip() or None,
            quantity=line.quantity,
            rate=rate,
            amount=amount,
        ))

    if total <= 0:
        raise HTTPException(400, "The bill total must be greater than 0")

    # ---- one transaction: bill + stock + journal are all saved, or none ----
    bill = models.PurchaseBill(
        bill_number=number,
        vendor_id=vendor.id,
        vendor_ref=(payload.vendor_ref or "").strip() or None,
        bill_date=payload.bill_date,
        due_date=due_date,
        notes=(payload.notes or "").strip() or None,
        status="open",
        total=total,
        amount_paid=0,
        items=bill_lines,
    )
    db.add(bill)
    db.flush()

    for pid, (qty, cost) in bought.items():
        product = products[pid]
        old_qty, old_cost = product.quantity or 0, _money(product.cost)
        # the item's cost becomes the weighted average of what is on the shelf and what was just bought.
        # (If the shelf is empty or the old cost was never set, the new purchase price simply becomes the cost.)
        if old_qty > 0 and old_cost > 0:
            product.cost = ((old_cost * old_qty + cost) / (old_qty + qty)).quantize(CENT, ROUND_HALF_UP)
        else:
            product.cost = (cost / qty).quantize(CENT, ROUND_HALF_UP)
        product.quantity = old_qty + qty
        # also log it so it shows in the existing Stock History tab
        db.add(models.StockMovement(
            product_id=pid, quantity=qty, movement_type="restock",
            note=f"Purchase bill {number}",
        ))

    journal_lines = [
        models.JournalLine(account_id=account_id, debit=amount, credit=0, description=f"Bill {number} - {vendor.name}")
        for account_id, amount in debits.items() if amount > 0
    ]
    journal_lines.append(models.JournalLine(
        account_id=_payable_account(db).id, debit=0, credit=total,
        description=f"Bill {number} - {vendor.name}",
    ))
    db.add(models.Journal(
        journal_number=number,
        journal_date=payload.bill_date,
        reference=vendor.name,
        notes=f"Purchase bill {number}",
        source_type="purchase_bill",
        source_id=bill.id,
        lines=journal_lines,
    ))
    db.commit()
    return db.query(models.PurchaseBill).options(*_options()).filter(models.PurchaseBill.id == bill.id).one()


@router.put("/{bill_id}/void", response_model=schemas.PurchaseBillOut)
def void_purchase_bill(bill_id: int, db: Session = Depends(get_db)):
    """Cancels a bill: takes the stock back off the shelf and removes its ledger entry. The bill stays on record as Void."""
    bill = db.query(models.PurchaseBill).options(*_options()).filter(models.PurchaseBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    if bill.status == "void":
        raise HTTPException(400, "This bill is already void")
    if float(bill.amount_paid or 0) > 0:
        raise HTTPException(400, "This bill has payments. Delete the payments first.")

    # how much stock this bill added, per item
    added: dict[int, int] = {}
    for line in bill.items:
        if line.product_id and line.product and line.product.item_type == STOCK_TRACKED_TYPE:
            added[line.product_id] = added.get(line.product_id, 0) + line.quantity

    if added:
        locked = {
            p.id: p
            for p in db.query(models.Product).filter(models.Product.id.in_(added.keys())).with_for_update().all()
        }
        short = [
            f"{locked[pid].name} (bill added {qty}, only {locked[pid].quantity} in stock now)"
            for pid, qty in added.items()
            if pid in locked and locked[pid].quantity < qty
        ]
        if short:
            raise HTTPException(400, "Can't void: some of this stock is already gone. " + "; ".join(short))
        for pid, qty in added.items():
            if pid in locked:
                locked[pid].quantity -= qty

    # take its rows out of Stock History
    db.query(models.StockMovement).filter(models.StockMovement.note == f"Purchase bill {bill.bill_number}").delete()

    # delete through the ORM (not a bulk delete) so the journal's lines go with it
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "purchase_bill", models.Journal.source_id == bill.id
    ).all():
        db.delete(journal)

    bill.status = "void"
    db.commit()
    return db.query(models.PurchaseBill).options(*_options()).filter(models.PurchaseBill.id == bill_id).one()

@router.delete("/{bill_id}")
def delete_purchase_bill(bill_id: int, db: Session = Depends(get_db)):
    """Permanently deletes a VOID bill (its stock and ledger entry were already reversed when it was voided)."""
    bill = db.query(models.PurchaseBill).filter(models.PurchaseBill.id == bill_id).with_for_update().first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    if bill.status != "void":
        raise HTTPException(400, "Only a void bill can be deleted. Void it first.")
    if db.query(models.VendorPaymentAllocation).filter(models.VendorPaymentAllocation.bill_id == bill.id).first():
        raise HTTPException(400, "This bill still has vendor payments linked to it. Remove the payments first.")

    # leftover ledger entries from this bill (normally already removed by void)
    for journal in db.query(models.Journal).filter(
        models.Journal.source_type == "purchase_bill", models.Journal.source_id == bill.id
    ).all():
        db.delete(journal)

    # leftover Stock History rows (normally already removed by void)
    db.query(models.StockMovement).filter(models.StockMovement.note == f"Purchase bill {bill.bill_number}").delete()

    db.delete(bill)   # its lines go with it
    db.commit()
    return {"message": "Deleted"}