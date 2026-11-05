
export const BASE_URL = import.meta.env.VITE_API_URL || "/api";

let accessToken = null;
let onAuthLost = null; // AuthProvider sets this so a failed refresh sends the user to the login page

export function setAccessToken(token) {
  accessToken = token || null;
}
export function setAuthLostHandler(fn) {
  onAuthLost = fn;
}

// ---- refresh (shared, so several requests - or React StrictMode - never refresh twice at once) ----
let refreshInFlight = null;

export function refreshSession() {
  if (!refreshInFlight) {
    const run = async () => {
      const res = await fetch(`${BASE_URL}/auth/refresh`, { method: "POST", credentials: "same-origin" });
      if (!res.ok) return null;
      const session = await res.json();
      accessToken = session.access_token;
      return session;
    };
    // Web Locks makes two browser TABS take turns: the 2nd tab then sends the NEW cookie, not the used one.
    const job = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("std-auth-refresh", run)
      : run();
    refreshInFlight = job.catch(() => null).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// Drop-in replacement for fetch(): same arguments, same return value (a Response).
export async function apiFetch(url, options = {}) {
  const send = () => {
    const headers = new Headers(options.headers || {});          // we never set Content-Type, so FormData keeps its boundary
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(url, { ...options, headers, credentials: "same-origin" });
  };

  const res = await send();
  if (res.status !== 401) return res;

  const session = await refreshSession();     // try once
  if (!session) {
    if (onAuthLost) onAuthLost();
    return res;
  }
  return send();                               // retry once with the new token
}