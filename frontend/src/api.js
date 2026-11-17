
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
      // A phone that just woke up often has no network for a moment, so retry before giving up.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch(`${BASE_URL}/auth/refresh`, { method: "POST", credentials: "same-origin" });
          if (res.ok) {
            const session = await res.json();
            accessToken = session.access_token;
            return session;
          }
          if (res.status === 401 || res.status === 403) return null; // the server says: session really is over
        } catch {
          /* network not ready yet */
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
      throw new Error("NETWORK"); // could not reach the server: NOT the same as "logged out"
    };
    const job = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("std-auth-refresh", run)
      : run();
    refreshInFlight = job.finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// The company in my token was deactivated / taken away from me: get a token for another company and reload.
async function handleLostCompany(url, res) {
  if (String(url).includes("/auth/")) return; // /auth/switch-company legitimately answers 403 NO_COMPANY_ACCESS
  const body = await res.clone().json().catch(() => null);
  if (body?.detail !== "NO_COMPANY_ACCESS") return;
  const last = Number(sessionStorage.getItem("std-co-lost") || 0);
  if (Date.now() - last < 10000) return; // never loop
  sessionStorage.setItem("std-co-lost", String(Date.now()));
    const session = await refreshSession().catch(() => undefined); // the server falls back to a company I still have
  if (session === undefined) return; // network problem, do nothing
  if (!session) {
    if (onAuthLost) onAuthLost();
    return;
  }
  window.location.reload();
}


export async function apiFetch(url, options = {}) {
  const send = () => {
    const headers = new Headers(options.headers || {});          // we never set Content-Type, so FormData keeps its boundary
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(url, { ...options, headers, credentials: "same-origin" });
  };

  const res = await send();
  if (res.status === 403) await handleLostCompany(url, res);
  if (res.status !== 401) return res;

  let session;
  try {
    session = await refreshSession();      // try once
  } catch {
    return res;                            // network problem: keep the user signed in, just fail this request
  }
  if (!session) {
    if (onAuthLost) onAuthLost();          // only when the server really said "session over"
    return res;
  }
  return send();                           // retry once with the new token
}