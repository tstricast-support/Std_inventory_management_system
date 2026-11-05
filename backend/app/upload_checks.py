
import io
import os
import re
import zipfile

from fastapi import HTTPException, UploadFile

MB = 1024 * 1024


def _env_mb(name: str, default: float) -> int:
    try:
        return int(float(os.getenv(name, "").strip() or default) * MB)
    except ValueError:
        return int(default * MB)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


MAX_IMAGE_BYTES = _env_mb("MAX_IMAGE_MB", 8)                  # per picture
MAX_IMPORT_BYTES = _env_mb("MAX_IMPORT_MB", 5)                # per Excel / CSV import file
MAX_XLSX_UNPACKED_BYTES = _env_mb("MAX_XLSX_UNPACKED_MB", 100)  # protects against "zip bomb" spreadsheets
MAX_IMAGES_PER_ITEM = _env_int("MAX_IMAGES_PER_ITEM", 20)     # one request on one item
MAX_BULK_IMAGES = _env_int("MAX_BULK_IMAGES", 200)            # one request on the bulk image screen


def _size(f) -> int:
    pos = f.tell()
    f.seek(0, 2)
    n = f.tell()
    f.seek(pos)
    return n


def _image_kind(head: bytes):
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None          # SVG, HTML, PDF, EXE ... are all refused


def safe_filename(name: str | None) -> str:
    """Strips folders and odd characters. The cleaned name is only used for the stored copy."""
    base = os.path.basename((name or "").replace("\\", "/")) or "image"
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:100]


def check_image_count(images, bulk: bool = False) -> None:
    limit = MAX_BULK_IMAGES if bulk else MAX_IMAGES_PER_ITEM
    if len(images) > limit:
        raise HTTPException(400, f"Too many pictures in one go (max {limit}). Upload them in smaller batches.")


def validate_image(upload: UploadFile) -> str:
    """Raises HTTPException if the file is not a real JPG/PNG/GIF/WEBP of acceptable size.
    The file is left rewound, so the caller can still do upload.file.read(). Returns a safe file name."""
    f = upload.file
    f.seek(0)
    shown = upload.filename or "file"
    size = _size(f)
    if size == 0:
        raise HTTPException(400, f'"{shown}" is empty.')
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(413, f'"{shown}" is too big (max {MAX_IMAGE_BYTES // MB} MB per picture).')
    head = f.read(16)
    f.seek(0)
    if _image_kind(head) is None:
        raise HTTPException(400, f'"{shown}" is not a JPG, PNG, GIF or WEBP picture.')
    return safe_filename(upload.filename)


def read_import_file(upload: UploadFile):
    """For the product import. Returns (lower-case file name, bytes) after checking type and size."""
    name = (upload.filename or "").lower()
    if not name.endswith((".csv", ".xlsx", ".xlsm")):
        raise HTTPException(400, "Please upload an .xlsx or .csv file")
    f = upload.file
    f.seek(0)
    if _size(f) > MAX_IMPORT_BYTES:
        raise HTTPException(413, f"The file is too big (max {MAX_IMPORT_BYTES // MB} MB).")
    data = f.read()
    if not data:
        raise HTTPException(400, "The file is empty")
    if name.endswith(".csv"):
        if b"\x00" in data[:8192]:
            raise HTTPException(400, "This does not look like a CSV text file.")
    else:
        if not data.startswith(b"PK\x03\x04"):
            raise HTTPException(400, "This is not a real .xlsx file. Please use the template.")
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                unpacked = sum(i.file_size for i in z.infolist())
        except zipfile.BadZipFile:
            raise HTTPException(400, "Could not read this Excel file. Please use the .xlsx template.")
        if unpacked > MAX_XLSX_UNPACKED_BYTES:
            raise HTTPException(400, "This spreadsheet is too large once unpacked.")
    return name, data