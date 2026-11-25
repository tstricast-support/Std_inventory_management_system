// src/passkeys.jsx  (NEW FILE)
// Face unlock / fingerprint sign-in (passkeys / WebAuthn). No extra npm package is needed.
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Trash2 } from "lucide-react";
import { BASE_URL, apiFetch } from "./api.js";

// ---------- small helpers ----------
const b64uToBuf = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

const bufToB64u = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// remembers (on THIS device only) that Face unlock was enabled here, so the login page can show its button
const ENROLLED_KEY = "std-passkey-here";
export function passkeyEnrolledHere() {
  try {
    return localStorage.getItem(ENROLLED_KEY) === "1";
  } catch {
    return false;
  }
}
const setEnrolled = (on) => {
  try {
    if (on) localStorage.setItem(ENROLLED_KEY, "1");
    else localStorage.removeItem(ENROLLED_KEY);
  } catch {
    /* private mode: ignore */
  }
};

export function passkeysSupported() {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials &&
    window.isSecureContext
  );
}

async function readError(res, fallback) {
  const err = await res.json().catch(() => null);
  return typeof err?.detail === "string" ? err.detail : fallback;
}

// turns the browser's own errors into something a person can read
function friendly(err) {
  if (err?.name === "NotAllowedError")
    return new Error(
      "Face unlock was cancelled or not recognised. Please try again.",
    );
  if (err?.name === "InvalidStateError")
    return new Error("This device is already registered for Face unlock.");
  if (err?.name === "NotSupportedError" || err?.name === "SecurityError")
    return new Error("Face unlock is not available on this device or browser.");
  return err instanceof Error ? err : new Error("Face unlock failed.");
}

function guessDeviceName() {
  const ua = navigator.userAgent || "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Mac/.test(ua)) return "Mac";
  return "This device";
}

// ---------- sign in with Face unlock (used by the login page) ----------
// Returns the same session object as /auth/login.
export async function loginWithPasskey() {
  if (!passkeysSupported())
    throw new Error("Face unlock is not available in this browser.");
  try {
    const optRes = await fetch(`${BASE_URL}/auth/passkey/login/options`, {
      method: "POST",
      credentials: "same-origin",
    });
    if (!optRes.ok)
      throw new Error(await readError(optRes, "Could not start Face unlock."));
    const { options, state } = await optRes.json();

    const cred = await navigator.credentials.get({
      publicKey: {
        ...options,
        hints: ["client-device"],
        challenge: b64uToBuf(options.challenge),
        allowCredentials: (options.allowCredentials || []).map((c) => ({
          ...c,
          id: b64uToBuf(c.id),
        })),
      },
    });
    if (!cred) throw new Error("Face unlock was cancelled.");

    const res = await fetch(`${BASE_URL}/auth/passkey/login/verify`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        credential: {
          id: cred.id,
          rawId: bufToB64u(cred.rawId),
          type: cred.type,
          authenticatorAttachment: cred.authenticatorAttachment || undefined,
          clientExtensionResults: cred.getClientExtensionResults?.() || {},
          response: {
            clientDataJSON: bufToB64u(cred.response.clientDataJSON),
            authenticatorData: bufToB64u(cred.response.authenticatorData),
            signature: bufToB64u(cred.response.signature),
            userHandle: cred.response.userHandle
              ? bufToB64u(cred.response.userHandle)
              : undefined,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(await readError(res, "Face unlock failed."));
    return await res.json();
  } catch (err) {
    throw friendly(err);
  }
}

// ---------- register this device (user is signed in) ----------
async function registerPasskey(password, deviceName) {
  try {
    const optRes = await apiFetch(`${BASE_URL}/auth/passkey/register/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!optRes.ok)
      throw new Error(
        await readError(optRes, "Could not start Face unlock setup."),
      );
    const { options, state } = await optRes.json();

    const cred = await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: b64uToBuf(options.challenge),
        user: { ...options.user, id: b64uToBuf(options.user.id) },
        excludeCredentials: (options.excludeCredentials || []).map((c) => ({
          ...c,
          id: b64uToBuf(c.id),
        })),
      },
    });
    if (!cred) throw new Error("Face unlock setup was cancelled.");

    const res = await apiFetch(`${BASE_URL}/auth/passkey/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        device_name: deviceName,
        credential: {
          id: cred.id,
          rawId: bufToB64u(cred.rawId),
          type: cred.type,
          authenticatorAttachment: cred.authenticatorAttachment || undefined,
          clientExtensionResults: cred.getClientExtensionResults?.() || {},
          response: {
            clientDataJSON: bufToB64u(cred.response.clientDataJSON),
            attestationObject: bufToB64u(cred.response.attestationObject),
            transports: cred.response.getTransports?.() || [],
          },
        },
      }),
    });
    if (!res.ok)
      throw new Error(await readError(res, "Could not save Face unlock."));
    setEnrolled(true);
  } catch (err) {
    throw friendly(err);
  }
}

// ---------- "Face unlock" block for the My profile pop-up ----------
const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";
const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

export function PasskeySettings() {
  const [list, setList] = useState([]);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(guessDeviceName());
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [busy, setBusy] = useState(false);
  const supported = passkeysSupported();

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/auth/passkey/list`);
      if (res.ok) {
        const data = await res.json();
        setList(data);
        if (data.length === 0) setEnrolled(false);
      }
    } catch {
      /* ignore: the list is only informational */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setMsg({ ok: true, text: "" });
    setBusy(true);
    try {
      await registerPasskey(password, name.trim() || guessDeviceName());
      setPassword("");
      setMsg({ ok: true, text: "Face unlock is now enabled on this device." });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove Face unlock from "${p.device_name}"?`)) return;
    try {
      const res = await apiFetch(`${BASE_URL}/auth/passkey/${p.id}`, {
        method: "DELETE",
      });
      if (!res.ok)
        throw new Error(await readError(res, "Could not remove it."));
      setMsg({ ok: true, text: "Removed." });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Fingerprint size={16} /> Face unlock / fingerprint
      </p>

      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate text-gray-900">
                  {p.device_name}
                </span>
                <span className="block text-[11px] text-gray-500">
                  Added{" "}
                  {p.created_at
                    ? new Date(p.created_at).toLocaleDateString()
                    : "-"}
                  {p.last_used_at
                    ? ` · last used ${new Date(p.last_used_at).toLocaleDateString()}`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Remove ${p.device_name}`}
                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!supported ? (
        <p className="text-sm text-gray-500">
          This browser does not support Face unlock (it needs HTTPS and a recent
          browser).
        </p>
      ) : (
        <form onSubmit={add} className="space-y-2">
          <p className="text-xs text-gray-500">
            Enable it on this device, then sign in with one tap next time. Your
            password still works.
          </p>
          <div>
            <label className={labelCls}>Device name</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className={labelCls}>Confirm your password</label>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || !password}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {busy
              ? "Waiting for Face ID..."
              : "Enable Face unlock on this device"}
          </button>
        </form>
      )}

      {msg.text && (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
