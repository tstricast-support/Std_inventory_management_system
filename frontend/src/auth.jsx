// src/auth.jsx  (NEW FILE)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Building2, LayoutGrid, LogOut } from "lucide-react";
import {
  BASE_URL,
  apiFetch,
  refreshSession,
  setAccessToken,
  setAuthLostHandler,
} from "./api.js";

const LEVEL_RANK = { none: 0, view: 1, create: 2, full: 3 };

// "Accounting areas" = the ones that make the Zoho-style admin screens useful (same list as permissions.py)
export const ACCOUNTING_AREAS = [
  "sales_documents",
  "invoices",
  "credit_notes",
  "payments_in",
  "purchase_bills",
  "payments_out",
  "chart_of_accounts",
  "journals",
  "banking",
  "taxes",
  "reports",
  "customers",
  "vendors",
];

const IDLE_LIMIT_MS = 30 * 60 * 1000; // sign out after 30 minutes without activity
const IDLE_WARN_MS = 28 * 60 * 1000; // warn at 28 minutes

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

async function readError(res, fallback) {
  const err = await res.json().catch(() => null);
  return typeof err?.detail === "string" ? err.detail : fallback;
}

// status: "loading" | "open" (AUTH_REQUIRED=false on the server) | "anon" | "authed"
export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  // true right after a fresh sign-in when the user may enter several companies -> show the company picker once
  const [needsPick, setNeedsPick] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await apiFetch(`${BASE_URL}/auth/me`);
    if (!res.ok) throw new Error("Could not load your profile");
    const data = await res.json();
    setUser(data);
    setStatus("authed");
    return data;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setNeedsPick(false);
    setStatus("anon");
  }, []);

  useEffect(() => {
    setAuthLostHandler(clearSession);
    return () => setAuthLostHandler(null);
  }, [clearSession]);

  // on page load: is login enforced? if yes, is there still a valid session cookie?
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const cfg = await fetch(`${BASE_URL}/auth/config`, {
          credentials: "same-origin",
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cfg && cfg.auth_required === false) {
          if (!dead) setStatus("open");
          return;
        }
        const session = await refreshSession();
        if (session) await loadProfile();
        else if (!dead) setStatus("anon");
      } catch {
        if (!dead) setStatus("anon");
      }
    })();
    return () => {
      dead = true;
    };
  }, [loadProfile]);

  const login = useCallback(
    async (username, password) => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(await readError(res, "Login failed"));
      const session = await res.json();
      setAccessToken(session.access_token);
      // decided BEFORE the app is shown, so there is no flash of the wrong company
      setNeedsPick((session.companies || []).length > 1);
      await loadProfile();
    },
    [loadProfile],
  );

  // Enter another company: the server checks access and returns a NEW token for it, then a full reload so
  // no data of the old company stays in memory (the refresh cookie remembers the company across the reload).
  const switchCompany = useCallback(async (companyId) => {
    const res = await apiFetch(`${BASE_URL}/auth/switch-company`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId }),
    });
    if (!res.ok)
      throw new Error(await readError(res, "Could not open that company"));
    const session = await res.json();
    setAccessToken(session.access_token);
    window.location.reload();
  }, []);

  const finishPick = useCallback(() => setNeedsPick(false), []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* offline: still clear the screen */
    }
    clearSession();
  }, [clearSession]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const res = await apiFetch(`${BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok)
        throw new Error(await readError(res, "Could not change the password"));
      const session = await res.json();
      setAccessToken(session.access_token);
      await loadProfile();
    },
    [loadProfile],
  );

  // convenience only - the server enforces everything again
  const can = useCallback(
    (area, level = "view") => {
      if (status === "open") return true;
      const have = user?.permissions?.[area] || "none";
      return (LEVEL_RANK[have] || 0) >= (LEVEL_RANK[level] ?? 99);
    },
    [status, user],
  );

  const hasRight = useCallback(
    (right) => status === "open" || !!user?.rights?.includes(right),
    [status, user],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      needsPick,
      finishPick,
      switchCompany,
      openMode: status === "open",
      can,
      hasRight,
      login,
      logout,
      changePassword,
      reloadUser: loadProfile,
    }),
    [
      status,
      user,
      needsPick,
      finishPick,
      switchCompany,
      can,
      hasRight,
      login,
      logout,
      changePassword,
      loadProfile,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------- shows login / forced password change / the app ----------
export function AuthGate({ children }) {
  const { status, user, needsPick } = useAuth();
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading...
      </div>
    );
  }
  if (status === "anon") return <LoginPage />;
  if (status === "authed" && user?.must_change_password)
    return <ChangePasswordPage forced />;
  if (status === "authed" && needsPick && (user?.companies?.length || 0) > 1)
    return <CompanyPickerPage />;
  return (
    <>
      {children}
      {status === "authed" && <IdleWatcher />}
    </>
  );
}

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

// Login hero: full-width uppercase heading with a light sweep, accent line, and rotating module names.
function AuthHero() {
  const words = ["Invoicing", "Inventory", "Accounting", "Reports"];
  return (
    <div className="text-center mb-6">
      <h2 className="auth-hero-title text-[22px] sm:text-2xl font-extrabold uppercase tracking-wider leading-tight">
        Manage your business
      </h2>
      <div className="auth-hero-line mx-auto mt-3 h-[3px] w-full rounded-full" />
      <div className="relative h-5 mt-3" aria-hidden="true">
        {words.map((w, i) => (
          <span
            key={w}
            className="auth-hero-word absolute inset-0 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500"
            style={{ animationDelay: `${i * 2}s` }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function AuthCard({ title, subtitle, hero, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-6">
        {hero && <AuthHero />}
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1 mb-4">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-4" />}
        {children}
      </div>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || "Login failed");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      hero
      title="Sign in"
      subtitle="Enter your username and password."
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Username
          </label>
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Password
          </label>
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}

// ---------- company picker (shown once after sign-in when the user has several companies) ----------
function CompanyPickerPage() {
  const { user, switchCompany, finishPick, logout } = useAuth();
  const [selected, setSelected] = useState(user.company_id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setError("");
    if (selected === user.company_id) return finishPick(); // already in it (it was the last-used one)
    setBusy(true);
    try {
      await switchCompany(selected); // reloads the page on success
    } catch (err) {
      setError(err.message || "Could not open that company");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a company"
      subtitle={`Welcome, ${user.full_name}. Which company do you want to work in?`}
    >
      <div className="space-y-2">
        {user.companies.map((c) => (
          <label
            key={c.id}
            className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${
              selected === c.id
                ? "border-blue-600 bg-blue-50"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="company"
              checked={selected === c.id}
              onChange={() => setSelected(c.id)}
            />
            <Building2 size={16} className="text-gray-400 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-gray-900">
              {c.name}
            </span>
            {c.id === user.company_id && (
              <span className="text-[11px] text-gray-500">Last used</span>
            )}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "Opening..." : "Continue"}
      </button>
      <button
        type="button"
        onClick={logout}
        className="w-full mt-2 text-sm text-gray-500 hover:text-gray-800"
      >
        Sign out
      </button>
    </AuthCard>
  );
}

// ---------- company switcher (only drawn when the user may enter 2+ companies) ----------
export function CompanySwitcher({ light = false }) {
  const { user, switchCompany } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = user?.companies || [];
  if (list.length < 2) return null;

  const onChange = async (e) => {
    const id = Number(e.target.value);
    if (id === user.company_id) return;
    setBusy(true);
    setError("");
    try {
      await switchCompany(id); // reloads the page on success
    } catch (err) {
      setError(err.message || "Could not open that company");
      setBusy(false);
    }
  };

  return (
    <div className={light ? "" : "mt-2"}>
      <select
        value={user.company_id}
        onChange={onChange}
        disabled={busy}
        aria-label="Switch company"
        title="Switch company"
        className={
          light
            ? "border border-gray-300 bg-white text-gray-700 text-xs rounded-full px-2 py-1.5 shadow max-w-[11rem]"
            : "w-full rounded bg-white/10 text-white text-xs px-2 py-1.5 border border-white/10 [&>option]:text-gray-900"
        }
      >
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function ChangePasswordPage({ forced = false }) {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next.length < 10)
      return setError("The new password must be at least 10 characters.");
    if (next.trim().toLowerCase() === (user?.username || "").toLowerCase())
      return setError("The password must not be the same as the username.");
    if (next !== again) return setError("The two new passwords do not match.");
    setBusy(true);
    try {
      await changePassword(current, next);
    } catch (err) {
      setError(err.message || "Could not change the password");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={
        forced
          ? "You must set your own password before you continue."
          : "Enter your current password and a new one."
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Current (temporary) password
          </label>
          <input
            type="password"
            className={inputCls}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            New password (min 10 characters)
          </label>
          <input
            type="password"
            className={inputCls}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            New password again
          </label>
          <input
            type="password"
            className={inputCls}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save new password"}
        </button>
        <button
          type="button"
          onClick={logout}
          className="w-full text-sm text-gray-500 hover:text-gray-800"
        >
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}

// ---------- idle timeout: warn at 28 min, sign out at 30 ----------
function IdleWatcher() {
  const { logout } = useAuth();
  const lastActive = useRef(Date.now());
  const warning = useRef(false);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const bump = () => {
      if (!warning.current) lastActive.current = Date.now();
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((ev) =>
      window.addEventListener(ev, bump, { passive: true }),
    );
    const timer = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= IDLE_LIMIT_MS) {
        clearInterval(timer);
        logout();
      } else if (idle >= IDLE_WARN_MS) {
        warning.current = true;
        setShowWarning(true);
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS - idle) / 1000));
      }
    }, 1000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      clearInterval(timer);
    };
  }, [logout]);

  const stay = () => {
    lastActive.current = Date.now();
    warning.current = false;
    setShowWarning(false);
  };

  if (!showWarning) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 text-gray-900">
        <h2 className="text-lg font-semibold">Still there?</h2>
        <p className="text-sm text-gray-600 mt-1">
          You will be signed out in {Math.floor(secondsLeft / 60)}:
          {String(secondsLeft % 60).padStart(2, "0")} because of inactivity.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={stay}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Stay signed in
          </button>
          <button
            onClick={logout}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- small UI pieces used by App.jsx ----------
// Wrap a button / block: <Gate right="void_transactions">...</Gate>  or  <Gate area="invoices" level="create">...</Gate>
export function Gate({
  area,
  level = "view",
  right,
  children,
  fallback = null,
}) {
  const { can, hasRight } = useAuth();
  if (area && !can(area, level)) return fallback;
  if (right && !hasRight(right)) return fallback;
  return children;
}

export function SidebarUser() {
  const { user, logout, openMode } = useAuth();
  if (openMode || !user) return null;
  return (
    <div className="mx-2 mb-1 px-3 py-2 rounded-md bg-white/5 text-xs">
      <p className="truncate text-white font-medium">{user.full_name}</p>
      <p className="truncate text-gray-400">{user.role?.name}</p>
      <CompanySwitcher />
      <div className="mt-2 flex items-center gap-4">
        <button
          onClick={() => window.dispatchEvent(new Event("app:profile"))}
          className="text-gray-300 hover:text-white"
        >
          My profile
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-gray-300 hover:text-white"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

export function HeaderSignOut() {
  const { user, logout, openMode } = useAuth();
  if (openMode || !user) return null;
  return (
    <button
      onClick={logout}
      aria-label="Sign out"
      title={`Sign out (${user.username})`}
      className="ml-auto p-1 rounded hover:bg-white/10"
    >
      <LogOut size={20} />
    </button>
  );
}

export function FloatingSignOut() {
  const { user, logout, openMode } = useAuth();
  if (openMode || !user) return null;
  return (
    <div className="fixed bottom-3 left-3 z-40 flex items-center gap-2">
      <CompanySwitcher light />
      <button
        onClick={() => window.dispatchEvent(new Event("app:profile"))}
        title={`Signed in as ${user.full_name}`}
        className="bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded-full shadow hover:bg-gray-50"
      >
        My profile
      </button>
      <button
        onClick={logout}
        className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded-full shadow hover:bg-gray-50"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}
