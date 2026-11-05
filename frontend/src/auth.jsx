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
import { LayoutGrid, LogOut } from "lucide-react";
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

  const loadProfile = useCallback(async () => {
    const res = await apiFetch(`${BASE_URL}/auth/me`);
    if (!res.ok) throw new Error("Could not load your profile");
    setUser(await res.json());
    setStatus("authed");
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
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
      await loadProfile();
    },
    [loadProfile],
  );

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
      openMode: status === "open",
      can,
      hasRight,
      login,
      logout,
      changePassword,
      reloadUser: loadProfile,
    }),
    [status, user, can, hasRight, login, logout, changePassword,loadProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------- shows login / forced password change / the app ----------
export function AuthGate({ children }) {
  const { status, user } = useAuth();
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
  return (
    <>
      {children}
      {status === "authed" && <IdleWatcher />}
    </>
  );
}

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-[#1f2640] mb-4">
          
                    <img src="/YAVERO.png" alt="YAVERO" className="h-8 w-8 object-contain" />
        </div>
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
    <AuthCard title="Sign in" subtitle="Enter your username and password.">
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
