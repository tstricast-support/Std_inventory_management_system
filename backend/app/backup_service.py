"""Company backup & restore (pure Python - no pg_dump / psql needed on the server).

WHAT A BACKUP IS
  One gzip-compressed text file (JSON lines) holding
    - the company's profile row (public.companies),
    - the list of users who could enter it (public.user_company_access),
    - EVERY table of its schema co_<id> (invoices, items, customers, journals, audit log ...).
  It does NOT hold users / roles / passwords: those are shared by all companies and are not company data.
  Pictures stay in ImageKit; the backup keeps their links.

WHERE IT IS KEPT
  In the table public.company_backups (no foreign key to companies, so deleting a company keeps its
  backups). It can also be downloaded as a file and restored from a file - keep a copy off the server too.

RESTORE
  ONE database transaction: drop the company's schema -> rebuild empty tables -> load every row -> fix the id
  counters. If anything fails, the transaction rolls back and the current data is left exactly as it was.
  A safety backup of the current data is taken first (kind 'pre_restore').

AUTOMATIC BACKUPS
  start_scheduler() runs a small background thread. Every few minutes it looks for schedules that are due.
  Several server workers may run it at once; each due run is "claimed" with one UPDATE, so it happens once.
"""
import base64
import calendar
import gzip
import hashlib
import io
import json
import logging
import os
import threading
import time
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text, update
from sqlalchemy.exc import OperationalError

from app.database import Base, engine, public_session, quote_schema, schema_for, tenant_tables
from app.models import Company, CompanyBackup, CompanyBackupSetting, User, UserCompanyAccess

log = logging.getLogger(__name__)

FORMAT = "std-company-backup"
VERSION = 1

KINDS = ("manual", "scheduled", "pre_delete", "pre_restore")
DEFAULT_KEEP = 8                 # newest manual + scheduled backups kept per company (changeable per company)
KEEP_PRE_RESTORE = 3             # safety backups taken just before a restore
CHUNK_ROWS = 500
MAX_LINE_BYTES = 64 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = int(float(os.getenv("BACKUP_MAX_UNCOMPRESSED_MB", "2000")) * 1024 * 1024)
SCHEDULER_TICK_SECONDS = 300


class BackupError(Exception):
    """A problem that is safe to show to the user as-is."""


class BackupBusy(BackupError):
    """Someone is working in the company, so the schema could not be locked."""


def utcnow() -> datetime:
    """Naive UTC (the TIMESTAMP columns carry no timezone)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------------------------
# value <-> JSON
# ---------------------------------------------------------------------------------------------
def _enc(v):
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray, memoryview)):
        return {"$b64": base64.b64encode(bytes(v)).decode("ascii")}
    raise TypeError(f"cannot back up a value of type {type(v).__name__}")


def _dec(col, v):
    """JSON value -> the Python type the column wants."""
    if v is None:
        return None
    if isinstance(v, dict) and "$b64" in v:
        return base64.b64decode(v["$b64"])
    try:
        py = col.type.python_type
    except NotImplementedError:
        return v
    if py is Decimal:
        return Decimal(str(v))
    if py is datetime:
        return datetime.fromisoformat(v)
    if py is date:
        return date.fromisoformat(v)
    return v


def _line(obj) -> bytes:
    return json.dumps(obj, default=_enc, separators=(",", ":")).encode("utf-8") + b"\n"


# ---------------------------------------------------------------------------------------------
# making a backup
# ---------------------------------------------------------------------------------------------
def _schema_tables(conn, schema: str) -> set:
    rows = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = :s"),
                        {"s": schema})
    return {r[0] for r in rows}


def schema_has_data_tables(company_id: int) -> bool:
    with engine.connect() as c:
        return bool(_schema_tables(c, schema_for(company_id)))


def _company_dict(c: Company) -> dict:
    return {
        "id": c.id, "name": c.name, "address_lines": c.address_lines, "phone": c.phone, "email": c.email,
        "logo_url": c.logo_url, "logo_file_id": c.logo_file_id, "invoice_footer": c.invoice_footer,
        "is_active": bool(c.is_active),
    }


def _build(company_id: int):
    """Reads one company and returns (compressed bytes, {table: row count}, company dict, [access user ids]).
    Everything is read in ONE REPEATABLE READ transaction, so all tables come from the same moment."""
    schema = schema_for(company_id)
    with closing(public_session()) as db:
        company_row = db.get(Company, company_id)
        if company_row is None:
            raise BackupError("Company not found.")
        company = _company_dict(company_row)
        rows = (db.query(UserCompanyAccess.user_id, User.username).join(User, User.id == UserCompanyAccess.user_id)
                .filter(UserCompanyAccess.company_id == company_id).order_by(UserCompanyAccess.user_id).all())
        access = [r[0] for r in rows]
        company["access_usernames"] = [r[1] for r in rows]

    raw = io.BytesIO()
    counts: dict = {}
    with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6) as gz:
        with engine.connect() as conn:
            conn = conn.execution_options(isolation_level="REPEATABLE READ",
                                          schema_translate_map={None: schema}, stream_results=True)
            have = _schema_tables(conn, schema)
            tables = [t for t in tenant_tables() if t.name in have]     # tenant_tables() is in foreign-key order
            if not tables:
                raise BackupError("This company has no data tables to back up.")
            gz.write(_line({
                "format": FORMAT, "version": VERSION, "created_at": utcnow().isoformat(),
                "company": company, "access_user_ids": access, "tables": [t.name for t in tables],
            }))
            for t in tables:
                n = 0
                order_by = list(t.primary_key.columns)
                stmt = select(t).order_by(*order_by) if order_by else select(t)
                for part in conn.execute(stmt).partitions(CHUNK_ROWS):
                    rows = [{c.name: r._mapping[c] for c in t.c} for r in part]
                    gz.write(_line({"t": t.name, "rows": rows}))
                    n += len(rows)
                counts[t.name] = n
            conn.rollback()
        gz.write(_line({"end": True, "counts": counts}))
    return raw.getvalue(), counts, company, access


_running_lock = threading.Lock()
_running: set = set()


def create_backup(company_id: int, kind: str = "manual", user_id=None, user_name=None, note=None) -> dict:
    """Takes a backup NOW, stores it in public.company_backups, applies the retention rule. Returns its summary."""
    if kind not in KINDS:
        raise ValueError("bad backup kind")
    with _running_lock:
        if company_id in _running:
            raise BackupError("A backup of this company is already running. Try again in a moment.")
        _running.add(company_id)
    try:
        data, counts, company, access = _build(company_id)
        with closing(public_session()) as db:
            row = CompanyBackup(
                company_id=company_id, company_name=company["name"], kind=kind, created_at=utcnow(),
                created_by_id=user_id, created_by_name=(user_name or None),
                size_bytes=len(data), row_count=sum(counts.values()),
                table_counts=json.dumps(counts), sha256=hashlib.sha256(data).hexdigest(),
                access_user_ids=json.dumps(access), note=note, data=data,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            summary = backup_to_json(row)
        try:
            prune_backups(company_id)
        except Exception:
            log.exception("could not prune old backups of company %s", company_id)
        return summary
    finally:
        with _running_lock:
            _running.discard(company_id)


def backup_to_json(b: CompanyBackup) -> dict:
    return {
        "id": b.id, "company_id": b.company_id, "company_name": b.company_name, "kind": b.kind,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "created_by_name": b.created_by_name, "size_bytes": b.size_bytes, "row_count": b.row_count,
        "note": b.note,
    }


def prune_backups(company_id: int) -> None:
    """manual + scheduled: keep the newest `keep_count`. pre_restore: keep the newest 3.
    pre_delete is NEVER removed automatically (it may be the only copy of a deleted company)."""
    with closing(public_session()) as db:
        s = db.get(CompanyBackupSetting, company_id)
        keep = s.keep_count if s else DEFAULT_KEEP
        for kinds, limit in ((("manual", "scheduled"), keep), (("pre_restore",), KEEP_PRE_RESTORE)):
            ids = [r[0] for r in db.query(CompanyBackup.id)
                   .filter(CompanyBackup.company_id == company_id, CompanyBackup.kind.in_(kinds))
                   .order_by(CompanyBackup.created_at.desc(), CompanyBackup.id.desc())]
            for old in ids[max(1, limit):]:
                db.query(CompanyBackup).filter(CompanyBackup.id == old).delete(synchronize_session=False)
        db.commit()


# ---------------------------------------------------------------------------------------------
# reading a backup file
# ---------------------------------------------------------------------------------------------
def read_header(data: bytes) -> dict:
    """Checks that `data` is one of our backup files and returns its first line (company, date, tables)."""
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(data), mode="rb") as gz:
            first = gz.readline(MAX_LINE_BYTES)
        header = json.loads(first)
    except (OSError, EOFError, ValueError):
        raise BackupError("This is not a valid backup file.")
    if not isinstance(header, dict) or header.get("format") != FORMAT:
        raise BackupError("This is not a backup file made by this system.")
    if int(header.get("version", 0)) > VERSION:
        raise BackupError("This backup was made by a newer version of the system. Update the system first.")
    company = header.get("company") or {}
    try:
        cid = int(company["id"])
        str(company["name"])
    except (KeyError, TypeError, ValueError):
        raise BackupError("This backup file is damaged (no company information).")
    if not 1 <= cid <= 99_999:
        raise BackupError("This backup file is damaged (invalid company number).")
    return header


# ---------------------------------------------------------------------------------------------
# restoring
# ---------------------------------------------------------------------------------------------
def _load_plan():
    """Which columns must be loaded in a second pass, and which point at shared (public) tables."""
    tables = {t.name: t for t in tenant_tables()}
    position = {t.name: i for i, t in enumerate(tenant_tables())}
    deferred: dict = {n: set() for n in tables}      # nullable foreign keys to the same / a LATER table
    public_fk: dict = {n: {} for n in tables}        # column -> shared table name (public.users ...)
    for t in tables.values():
        for fk in t.foreign_keys:
            target = fk.column.table
            if target.schema is None and target.name in position:
                if position[target.name] >= position[t.name] and fk.parent.nullable:
                    deferred[t.name].add(fk.parent.name)
            elif target.schema is not None:
                public_fk[t.name][fk.parent.name] = (target.schema, target.name, fk.column.name)
    return tables, deferred, public_fk


def restore_company(data: bytes, acting_user_id=None, acting_user_name=None) -> dict:
    """Replaces ALL data of the backed-up company with the contents of `data` (see the module note).
    The company id is the one inside the backup. If that company no longer exists it is created again."""
    header = read_header(data)
    comp = header["company"]
    company_id = int(comp["id"])
    schema = schema_for(company_id)
    S = quote_schema(schema)
    stage = f"restore_tmp_{company_id}"          # temporary schema: built and filled first, swapped in at the very end
    ST = f'"{stage}"'

    # safety net: keep what is there now, in case the person restores the wrong file
    safety_id = None
    with closing(public_session()) as db:
        company_exists = db.get(Company, company_id) is not None
    if company_exists and schema_has_data_tables(company_id):
        try:
            safety_id = create_backup(company_id, "pre_restore", acting_user_id, acting_user_name,
                                      note="Automatic copy taken just before a restore")["id"]
        except Exception as e:
            log.exception("safety backup before restore failed (company %s)", company_id)
            raise BackupError("The current data could not be backed up first, so nothing was changed. "
                              f"({e if isinstance(e, BackupError) else 'see the server log'})")

    tables, deferred, public_fk = _load_plan()
    inserted: dict = {}
    notes: list = []
    skipped_tables, dropped_cols = set(), set()
    deferred_updates: dict = {}
    total_bytes = 0
    footer = None

    try:
        with engine.begin() as conn:
            conn.execute(text("SET LOCAL lock_timeout = '15s'"))

            # shared ids that may have disappeared since the backup (a user was deleted): such links become empty
            valid: dict = {}
            for tname, cols in public_fk.items():
                for col, (sch, tbl, refcol) in cols.items():
                    key = (sch, tbl, refcol)
                    if key not in valid:
                        valid[key] = {r[0] for r in conn.execute(text(f'SELECT "{refcol}" FROM {sch}."{tbl}"'))}

            # 1) fresh, empty TEMPORARY schema built from the CURRENT models (the live schema is not touched yet)
            conn.execute(text(f"DROP SCHEMA IF EXISTS {ST} CASCADE"))
            conn.execute(text(f"CREATE SCHEMA {ST}"))
            conn = conn.execution_options(schema_translate_map={None: stage})
            Base.metadata.create_all(bind=conn, tables=list(tables.values()))

            # 2) rows
            with gzip.GzipFile(fileobj=io.BytesIO(data), mode="rb") as gz:
                gz.readline(MAX_LINE_BYTES)                      # header, already checked
                for raw in gz:
                    total_bytes += len(raw)
                    if total_bytes > MAX_UNCOMPRESSED_BYTES:
                        raise BackupError("The backup is too large to restore (BACKUP_MAX_UNCOMPRESSED_MB).")
                    obj = json.loads(raw)
                    if obj.get("end"):
                        footer = obj
                        continue
                    name = obj.get("t")
                    t = tables.get(name)
                    if t is None:
                        skipped_tables.add(str(name))
                        continue
                    cols = {c.name: c for c in t.c}
                    pk_cols = [c.name for c in t.primary_key.columns]
                    out_rows = []
                    for row in obj.get("rows", []):
                        out = {}
                        for k, v in row.items():
                            col = cols.get(k)
                            if col is None:
                                dropped_cols.add(f"{name}.{k}")
                                continue
                            v = _dec(col, v)
                            if v is not None and k in public_fk[name]:
                                if v not in valid[public_fk[name][k]]:
                                    v = None
                            if v is not None and k in deferred[name] and len(pk_cols) == 1:
                                deferred_updates.setdefault((name, k), []).append((row[pk_cols[0]], v))
                                v = None
                            out[k] = v
                        out_rows.append(out)
                    if out_rows:
                        conn.execute(t.insert(), out_rows)
                    inserted[name] = inserted.get(name, 0) + len(out_rows)
            if footer is None:
                raise BackupError("The backup file is incomplete (it was cut off). Nothing was changed.")

            # every table must have exactly the number of rows the backup says it had
            for name, expected in (footer.get("counts") or {}).items():
                if name in tables and inserted.get(name, 0) != expected:
                    raise BackupError(f"The backup file is damaged (table '{name}': expected {expected} rows, "
                                      f"found {inserted.get(name, 0)}). Nothing was changed.")

            # 3) links to rows of the same table / a later table (parent items, sub-accounts ...)
            # (plain SQL on purpose: a Core update() would also fire columns such as products.updated_at
            #  "onupdate=now()" and change the restored values)
            for (tname, col), items in deferred_updates.items():
                pk = tables[tname].primary_key.columns.keys()[0]
                conn.execute(text(f'UPDATE {ST}."{tname}" SET "{col}" = :_val WHERE "{pk}" = :_pk'),
                             [{"_pk": p, "_val": v} for p, v in items])

            # 4) id counters, so new records continue after the restored ones
            for t in tables.values():
                pks = list(t.primary_key.columns)
                if len(pks) == 1 and pks[0].type.python_type is int:
                    pk = pks[0].name
                    conn.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{ST}.\"{t.name}\"', '{pk}'), GREATEST(m, 1), m IS NOT NULL) "
                        f"FROM (SELECT MAX(\"{pk}\") AS m FROM {ST}.\"{t.name}\") x"))
            conn = conn.execution_options(schema_translate_map=None)

            # 4b) SWAP: only now is the live schema dropped and the new one renamed into its place. The exclusive
            #     lock this needs is held only until the commit, a few milliseconds, instead of the whole load.
            conn.execute(text(f"DROP SCHEMA IF EXISTS {S} CASCADE"))
            conn.execute(text(f"ALTER SCHEMA {ST} RENAME TO {S}"))

            # 5) the company row itself + who may enter it
            recreated = _restore_company_row(conn, comp, header.get("access_user_ids") or [], acting_user_id)
    except BackupError:
        raise
    except (EOFError, OSError, ValueError, KeyError, TypeError, AttributeError):
        log.exception("backup file of company %s could not be read", company_id)
        raise BackupError("The backup file is damaged or incomplete. Nothing was changed.")
    except OperationalError as e:
        if "lock timeout" in str(e).lower() or "LockNotAvailable" in type(e.orig).__name__:
            raise BackupBusy("Someone is still working in this company. Ask them to leave it, "
                             "then try again. Nothing was changed.")
        log.exception("restore of company %s failed", company_id)
        raise BackupError("The restore failed and was cancelled. Nothing was changed.")
    except Exception:
        log.exception("restore of company %s failed", company_id)
        raise BackupError("The restore failed and was cancelled. Nothing was changed.")

    if skipped_tables:
        notes.append("Tables in the backup that this version no longer has were skipped: "
                     + ", ".join(sorted(skipped_tables)))
    if dropped_cols:
        notes.append("Columns that this version no longer has were skipped: " + ", ".join(sorted(dropped_cols)))
    return {
        "company_id": company_id, "company_name": comp["name"], "rows": sum(inserted.values()),
        "tables": inserted, "company_recreated": recreated, "safety_backup_id": safety_id, "notes": notes,
    }


def _restore_company_row(conn, comp: dict, access_user_ids: list, acting_user_id) -> bool:
    """Creates (or updates) public.companies and the access rows. Returns True if the company had to be re-created."""
    cid = int(comp["id"])
    name = (comp.get("name") or "Restored company")[:150]
    clash = conn.execute(text("SELECT 1 FROM public.companies WHERE lower(name) = lower(:n) AND id <> :i"),
                         {"n": name, "i": cid}).first()
    if clash:                                          # another company took the name meanwhile
        name = f"{name[:140]} (restored)"
    params = {
        "i": cid, "n": name, "a": comp.get("address_lines"), "p": comp.get("phone"), "e": comp.get("email"),
        "lu": comp.get("logo_url"), "lf": comp.get("logo_file_id"), "f": comp.get("invoice_footer"),
    }
    exists = conn.execute(text("SELECT 1 FROM public.companies WHERE id = :i"), {"i": cid}).first()
    if exists:
        conn.execute(text(
            "UPDATE public.companies SET name=:n, address_lines=:a, phone=:p, email=:e, logo_url=:lu, "
            "logo_file_id=:lf, invoice_footer=:f, is_active=true WHERE id=:i"), params)
    else:
        conn.execute(text(
            "INSERT INTO public.companies (id, name, address_lines, phone, email, logo_url, logo_file_id, "
            "invoice_footer, is_active) VALUES (:i,:n,:a,:p,:e,:lu,:lf,:f,true)"), params)
        # explicit ids do not move the counter: make sure the next NEW company never reuses an id
        seq = conn.execute(text("SELECT pg_get_serial_sequence('public.companies', 'id')")).scalar()
        if seq:
            conn.execute(text(f"SELECT setval('{seq}', GREATEST((SELECT MAX(id) FROM public.companies), "
                              f"(SELECT last_value FROM {seq})), true)"))
    names = [n for n in (comp.get("access_usernames") or []) if isinstance(n, str)]
    if names:                                          # match people by USERNAME (ids differ between databases)
        wanted = {r[0] for r in conn.execute(text("SELECT id FROM public.users WHERE username = ANY(:n)"), {"n": names})}
    else:                                              # old backup files without usernames
        wanted = {int(u) for u in access_user_ids if isinstance(u, int)}
    if acting_user_id:
        wanted.add(int(acting_user_id))
    for uid in wanted:                                 # only users that still exist
        conn.execute(text(
            "INSERT INTO public.user_company_access (user_id, company_id) "
            "SELECT id, :c FROM public.users WHERE id = :u ON CONFLICT DO NOTHING"), {"c": cid, "u": uid})
    return not exists


# ---------------------------------------------------------------------------------------------
# schedule
# ---------------------------------------------------------------------------------------------
def _tz():
    """Time zone the schedule is read in (BACKUP_TIMEZONE, default Asia/Colombo). Falls back to UTC if the
    server has no time-zone database (then add `tzdata` to requirements.txt)."""
    from zoneinfo import ZoneInfo
    name = os.getenv("BACKUP_TIMEZONE", "Asia/Colombo").strip() or "Asia/Colombo"
    try:
        return ZoneInfo(name), name
    except Exception:
        log.warning("time zone %r not found (pip install tzdata) - backups are scheduled in UTC", name)
        return timezone.utc, "UTC"


def timezone_name() -> str:
    return _tz()[1]


def compute_next_run(frequency: str, weekday: int, month_day: int, run_hour: int, after=None):
    """The next run strictly after `after` (naive UTC, default now), as naive UTC. None for 'off'."""
    if frequency not in ("weekly", "monthly"):
        return None
    tz, _ = _tz()
    now = (after or utcnow()).replace(tzinfo=timezone.utc).astimezone(tz)
    if frequency == "weekly":
        cand = now.replace(hour=run_hour, minute=0, second=0, microsecond=0) + timedelta(days=(weekday - now.weekday()) % 7)
        if cand <= now:
            cand += timedelta(days=7)
    else:
        def make(y, m):
            return datetime(y, m, min(month_day, calendar.monthrange(y, m)[1]), run_hour, tzinfo=tz)
        cand = make(now.year, now.month)
        if cand <= now:
            y, m = (now.year + 1, 1) if now.month == 12 else (now.year, now.month + 1)
            cand = make(y, m)
    return cand.astimezone(timezone.utc).replace(tzinfo=None)


def run_due_backups() -> None:
    """One scheduler pass: back up every company whose schedule is due."""
    now = utcnow()
    with closing(public_session()) as db:
        due = [(s.company_id, s.next_run_at, s.frequency, s.weekday, s.month_day, s.run_hour)
               for s in db.query(CompanyBackupSetting)
               .filter(CompanyBackupSetting.frequency != "off", CompanyBackupSetting.next_run_at.isnot(None),
                       CompanyBackupSetting.next_run_at <= now)]
    for cid, old_next, freq, wd, md, hr in due:
        with closing(public_session()) as db:      # claim it: only the worker whose UPDATE matches 1 row runs it
            res = db.execute(update(CompanyBackupSetting)
                             .where(CompanyBackupSetting.company_id == cid, CompanyBackupSetting.next_run_at == old_next)
                             .values(next_run_at=compute_next_run(freq, wd, md, hr)))
            db.commit()
            if res.rowcount != 1:
                continue
            active = db.query(Company.id).filter(Company.id == cid, Company.is_active == True).first()  # noqa: E712
        if not active:
            continue                                # deleted / deactivated company: nothing to back up
        status, error = "ok", None
        try:
            create_backup(cid, "scheduled", note=f"Automatic {freq} backup")
        except Exception as e:
            log.exception("scheduled backup of company %s failed", cid)
            status, error = "failed", (str(e) if isinstance(e, BackupError) else "see the server log")[:500]
        with closing(public_session()) as db:
            db.query(CompanyBackupSetting).filter(CompanyBackupSetting.company_id == cid).update(
                {"last_run_at": utcnow(), "last_status": status, "last_error": error})
            db.commit()


def _scheduler_loop() -> None:
    time.sleep(60)                                  # let the server finish starting
    while True:
        try:
            run_due_backups()
        except Exception:
            log.exception("backup scheduler pass failed")
        time.sleep(SCHEDULER_TICK_SECONDS)


_scheduler_started = False


def start_scheduler() -> None:
    """Called once from main.py at startup. Set BACKUP_SCHEDULER=false to switch it off in a process."""
    global _scheduler_started
    if _scheduler_started or os.getenv("BACKUP_SCHEDULER", "true").strip().lower() in ("0", "false", "no", "off"):
        return
    _scheduler_started = True
    threading.Thread(target=_scheduler_loop, name="backup-scheduler", daemon=True).start()