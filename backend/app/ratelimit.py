
import os
import threading
import time
from collections import defaultdict, deque


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


# Login attempts per 5 minutes. A whole office can share one public IP, so the per-IP number is generous;
# the per-IP+username number is the strict one that stops password guessing.
LOGIN_WINDOW_SECONDS = 300
LOGIN_MAX_PER_IP = _env_int("LOGIN_MAX_PER_IP", 30)
LOGIN_MAX_PER_IP_USER = _env_int("LOGIN_MAX_PER_IP_USER", 10)


class SlidingWindowLimiter:
    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_prune = time.monotonic()

    def check(self, key: str, limit: int, window: int) -> int:
        """Records one attempt. Returns 0 if it is allowed, otherwise the seconds to wait.
        Blocked attempts are NOT recorded, so hammering the endpoint does not extend the block."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                return max(1, int(q[0] + window - now) + 1)
            q.append(now)
            if now - self._last_prune > 300:        # forget keys nobody has used for an hour
                self._last_prune = now
                for k in [k for k, v in self._hits.items() if not v or v[-1] < now - 3600]:
                    del self._hits[k]
            return 0


login_limiter = SlidingWindowLimiter()


def login_wait_seconds(ip: str, username: str) -> int:
    """0 = go ahead. Otherwise how many seconds this person must wait before trying to log in again."""
    a = login_limiter.check(f"ip:{ip}", LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS)
    b = login_limiter.check(f"ipu:{ip}:{username}", LOGIN_MAX_PER_IP_USER, LOGIN_WINDOW_SECONDS)
    return max(a, b)