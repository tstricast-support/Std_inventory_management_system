"""Automatic created_by_id + audit trail, without touching the routers.

SQLAlchemy calls these hooks whenever one of the listed records is inserted / updated / deleted during
a logged-in (or AUTH_REQUIRED=false) web request. require_area() puts the current user into audit.request_ctx.
Scripts and the startup seeds run outside a request, so they are never logged.
Import this module once (main.py does)."""
from sqlalchemy import event, insert

from app import models
from app.audit import request_ctx

# model -> (record_type, label for the summary, attribute holding the human number or None)
AUDITED = {
    models.Invoice: ("invoice", "Invoice", "invoice_number"),
    models.Payment: ("payment", "Payment", "payment_number"),
    models.Journal: ("journal", "Journal", "journal_number"),
    models.PurchaseBill: ("purchase_bill", "Purchase bill", "bill_number"),
    models.VendorPayment: ("vendor_payment", "Vendor payment", "payment_number"),
    models.CreditNote: ("credit_note", "Credit note", "credit_number"),
    models.SalesDocument: ("sales_document", "Sales document", "doc_number"),
    models.Bill: ("bill", "Restock bill", None),
    models.IssuedList: ("issued_list", "Issued list", None),
}


def _stamp_creator(mapper, connection, target):
    ctx = request_ctx.get()
    if ctx and ctx.get("user_id") and getattr(target, "created_by_id", None) is None:
        target.created_by_id = ctx["user_id"]


def _write(action_override):
    def hook(mapper, connection, target):
        ctx = request_ctx.get()
        if not ctx:
            return
        # journals that an invoice/payment/... posts by itself are part of that record, not a separate event
        if isinstance(target, models.Journal) and target.source_type:
            return
        record_type, label, num_attr = AUDITED[type(target)]
        number = getattr(target, num_attr, None) if num_attr else None
        what = f"{label} {number}" if number else f"{label} #{target.id}"

        action = action_override or ctx["action"]
        if action_override == "update" and ctx["action"] == "void":
            action = "void"
        verb = {"create": "Created", "update": "Edited", "void": "Voided", "delete": "Deleted"}[action]
        summary = f"{verb} {what}"
        if action == "update" and ctx["action"] in ("create", "delete"):
            # e.g. posting a payment changes the invoice's amount_paid: say which request did it
            summary += f" (changed by {ctx['method']} {ctx['route']})"

        connection.execute(insert(models.AuditLog.__table__).values(
            user_id=ctx["user_id"], username=ctx["username"], action=action,
            record_type=record_type, record_id=target.id, summary=summary[:2000], ip=ctx["ip"],
        ))
    return hook


for _model in AUDITED:
    event.listen(_model, "before_insert", _stamp_creator)
    event.listen(_model, "after_insert", _write("create"))
    event.listen(_model, "after_update", _write("update"))
    event.listen(_model, "after_delete", _write("delete"))