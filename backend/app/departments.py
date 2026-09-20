from fastapi import HTTPException

# Must match the slugs used in the frontend (and the logo file names
# in frontend/public/logos/<slug>.png)
DEPARTMENTS = ["dd-engineering", "i-lab", "i-lab-std"]

# Existing products (created before departments existed) are placed here.
DEFAULT_DEPARTMENT = "i-lab-std"


def validate_department(value: str) -> str:
    if value not in DEPARTMENTS:
        raise HTTPException(400, f'Unknown department "{value}"')
    return value