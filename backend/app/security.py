
import os

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse

from app.auth import IS_PRODUCTION

MB = 1024 * 1024


def _env_mb(name: str, default: int) -> int:
    try:
        return int(float(os.getenv(name, "").strip() or default) * MB)
    except ValueError:
        return default * MB


MAX_JSON_BYTES = _env_mb("MAX_JSON_MB", 2)          # normal API requests (invoices, payments ...)
MAX_UPLOAD_BYTES = _env_mb("MAX_UPLOAD_MB", 100)    # one multipart request (pictures / import file)

_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}
# Two policies, because this server now also hands out the React app (see frontend_dist in main.py):
#  - /api/...  returns only JSON / files, so it needs no scripts, frames or images at all.
#  - everything else (the web app) gets the same policy you already had in serve.json. It is "Report-Only":
#    the browser logs problems in the console but blocks nothing. Once the console stays clean, rename the
#    header below to "Content-Security-Policy" to enforce it.
_API_CSP = "default-src 'none'; frame-ancestors 'none'"
_APP_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https://ik.imagekit.io; connect-src 'self' https://ik.imagekit.io; "
    "frame-src 'self' blob:; object-src 'self' blob:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)
if IS_PRODUCTION:
    _HEADERS["Strict-Transport-Security"] = "max-age=31536000"


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        path = scope["path"]
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}

        # Reject oversize bodies before reading them. (A client that sends no Content-Length is not caught here;
        # the per-file checks in upload_checks.py still apply.)
        if scope["method"] in ("POST", "PUT", "PATCH") and "content-length" in headers:
            try:
                length = int(headers["content-length"])
            except ValueError:
                length = -1
            is_upload = headers.get("content-type", "").lower().startswith("multipart/form-data")
            limit = MAX_UPLOAD_BYTES if is_upload else MAX_JSON_BYTES
            if length < 0 or length > limit:
                resp = JSONResponse(
                    status_code=413,
                    content={"detail": f"Request is too large (max {limit // MB} MB)."},
                    headers=_HEADERS,
                )
                return await resp(scope, receive, send)

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                h = MutableHeaders(scope=message)
                for k, v in _HEADERS.items():
                    h.setdefault(k, v)
                if path.startswith("/api/"):
                    h.setdefault("Cache-Control", "no-store")     # never keep money data / tokens in a cache
                if IS_PRODUCTION:
                       h.setdefault("Content-Security-Policy", _API_CSP)
                elif IS_PRODUCTION:
                    h.setdefault("Content-Security-Policy-Report-Only", _APP_CSP)
            await send(message)

        await self.app(scope, receive, send_with_headers)