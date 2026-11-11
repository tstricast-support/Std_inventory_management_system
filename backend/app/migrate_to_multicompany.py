"""ONE-TIME migration: old single-company database -> multi-company layout.

    python -m app.migrate_to_multicompany --dry-run              (only prints the plan, changes nothing)
    python -m app.migrate_to_multicompany --i-have-a-backup      (does it)

TAKE A BACKUP FIRST:   pg_dump --format=custom --file=backup_before_multicompany.dump "$DATABASE_URL"

ONE transaction (all or nothing): creates shared tables, company 1 "STD" + schema co_1, moves every existing
business table from public to co_1 (ALTER TABLE ... SET SCHEMA; id sequences move with their tables), gives ALL
existing users access to company 1, then checks row counts / sequences - any mismatch rolls EVERYTHING back.
A second run is refused.
"""
import sys

from sqlalchemy import inspect, text

from app.database import SHARED_SCHEMA, engine, quote_schema, schema_for, tenant_tables

COMPANY_ID = 1
COMPANY_NAME = "STD"
LEGACY_EXTRA_TABLES = ["categories"]   # old leftover (products.category_id points at it); moves with the rest


class MigrationRefused(Exception):
    pass


def _q(conn, name: str) -> str:
    return conn.dialect.identifier_preparer.quote(name)


def _count(conn, schema_q: str, table: str) -> int:
    return conn.execute(text(f"SELECT count(*) FROM {schema_q}.{_q(conn, table)}")).scalar()


def plan(conn) -> list:
    insp = inspect(conn)
    schema = schema_for(COMPANY_ID)
    if insp.has_table("companies", schema=SHARED_SCHEMA) and conn.execute(
            text(f"SELECT 1 FROM {SHARED_SCHEMA}.companies LIMIT 1")).first():
        raise MigrationRefused("Companies already exist: this database is already migrated. Nothing to do.")
    if conn.execute(text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"), {"s": schema}).first():
        raise MigrationRefused(f"Schema {schema} already exists. Refusing to run (check manually).")
    in_public = set(insp.get_table_names(schema=SHARED_SCHEMA))
    names = [t.name for t in tenant_tables() if t.name in in_public]
    names += [t for t in LEGACY_EXTRA_TABLES if t in in_public]
    if not names:
        raise MigrationRefused("No business tables found in schema public. This looks like a new database - just start the app.")
    return names


def migrate(conn, dry_run: bool = False, log=print) -> None:
    """Runs inside the caller's transaction (the caller commits)."""
    from app.company_init import init_shared_schema

    names = plan(conn)
    S = quote_schema(schema_for(COMPANY_ID))
    users = conn.execute(text(f"SELECT count(*) FROM {SHARED_SCHEMA}.users")).scalar() if inspect(conn).has_table(
        "users", schema=SHARED_SCHEMA) else 0
    before = {n: _count(conn, SHARED_SCHEMA, n) for n in names}

    log(f"Plan: create company {COMPANY_ID} '{COMPANY_NAME}' with schema {schema_for(COMPANY_ID)}")
    log(f"      move {len(names)} tables from public to {schema_for(COMPANY_ID)}:")
    for n in names:
        log(f"        {n:30s} {before[n]:>8} rows")
    log(f"      give all {users} existing user(s) access to company {COMPANY_ID}")
    if dry_run:
        log("DRY RUN: nothing was changed.")
        return

    init_shared_schema(conn)
    conn.execute(text(f"INSERT INTO {SHARED_SCHEMA}.companies (id, name, is_active) VALUES (:i, :n, true)"),
                 {"i": COMPANY_ID, "n": COMPANY_NAME})
    conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{SHARED_SCHEMA}.companies', 'id'), :i, true)"), {"i": COMPANY_ID})
    conn.execute(text(f"CREATE SCHEMA {S}"))
    for n in names:
        conn.execute(text(f"ALTER TABLE {SHARED_SCHEMA}.{_q(conn, n)} SET SCHEMA {S}"))
    conn.execute(text(
        f"INSERT INTO {SHARED_SCHEMA}.user_company_access (user_id, company_id) "
        f"SELECT id, :c FROM {SHARED_SCHEMA}.users"), {"c": COMPANY_ID})

    # ---- verification: any problem raises, and the caller rolls the whole transaction back ----
    schema = schema_for(COMPANY_ID)
    after = {n: _count(conn, S, n) for n in names}
    if after != before:
        bad = {n: (before[n], after[n]) for n in names if before[n] != after[n]}
        raise RuntimeError(f"Row counts changed, rolling back: {bad}")
    left = set(inspect(conn).get_table_names(schema=SHARED_SCHEMA)) & set(names)
    if left:
        raise RuntimeError(f"Tables still in public, rolling back: {sorted(left)}")
    for n in names:
        has_id = conn.execute(text(
            "SELECT 1 FROM information_schema.columns WHERE table_schema=:s AND table_name=:t AND column_name='id'"),
            {"s": schema, "t": n}).first()
        if not has_id:
            continue
        seq = conn.execute(text("SELECT pg_get_serial_sequence(:t, 'id')"), {"t": f"{S}.{_q(conn, n)}"}).scalar()
        if seq is None or not seq.startswith(f"{schema}."):
            raise RuntimeError(f"The id sequence of {n} did not move with the table (got {seq}), rolling back.")
    moved_users = conn.execute(text(
        f"SELECT count(*) FROM {SHARED_SCHEMA}.user_company_access WHERE company_id = :c"), {"c": COMPANY_ID}).scalar()
    if moved_users != users:
        raise RuntimeError("User access rows do not match the number of users, rolling back.")
    log(f"OK: {len(names)} tables moved, row counts identical, sequences moved, {moved_users} user(s) given access.")


def main(argv) -> int:
    dry = "--dry-run" in argv
    if not dry and "--i-have-a-backup" not in argv:
        print(__doc__)
        print("Refusing to run without --i-have-a-backup (or use --dry-run to only look).")
        return 2
    try:
        if dry:
            with engine.connect() as conn:
                migrate(conn, dry_run=True)
        else:
            print("Make sure the app is STOPPED (or only this script is using the database).")
            with engine.begin() as conn:
                conn.execute(text("SET LOCAL lock_timeout = '30s'"))
                migrate(conn)
            print("Committed. Now start the app: it will upgrade/seed co_1 and keep working as before.")
    except MigrationRefused as exc:
        print(f"REFUSED: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    import app.models  # noqa: F401  (registers every table)
    sys.exit(main(sys.argv[1:]))