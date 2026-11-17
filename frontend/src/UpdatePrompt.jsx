import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// Shows a "New version available" window in the middle of the screen.
// How it knows: every build gives the main script a new file name (/assets/index-XXXX.js).
// We re-download the page's HTML (never from cache) and compare that script name with the one
// this tab is running. Different = a new version was deployed.
// Works in the browser tab AND in the installed app. No service worker needed.

const CHECK_EVERY_MS = 2 * 60 * 1000; // look for a new version every 2 minutes
const SNOOZE_MS = 15 * 60 * 1000; // "Later" hides the window for 15 minutes

const entryUrl = () =>
  window.location.pathname.startsWith("/admin") ? "/admin.html" : "/";

const runningScript = () =>
  document.querySelector('script[type="module"][src]')?.getAttribute("src") ||
  "";

async function latestScript() {
  const res = await fetch(`${entryUrl()}?_=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) return "";
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (
    doc.querySelector('script[type="module"][src]')?.getAttribute("src") || ""
  );
}

export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const snoozeUntil = useRef(0);
  const current = useRef(runningScript());

  useEffect(() => {
    if (import.meta.env.DEV || !current.current) return; // dev server: nothing to check

    let stopped = false;
    const check = async () => {
      if (stopped || Date.now() < snoozeUntil.current) return;
      try {
        const latest = await latestScript();
        if (!stopped && latest && latest !== current.current) setReady(true);
      } catch {
        /* offline or server restarting: try again next time */
      }
    };

    const first = setTimeout(check, 10 * 1000);
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  const update = async () => {
    setBusy(true);
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  const later = () => {
    snoozeUntil.current = Date.now() + SNOOZE_MS;
    setReady(false);
  };

  if (!ready) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 text-gray-900">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="upd-title"
        className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-gray-200 p-6 text-center"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <RefreshCw size={24} />
        </div>
        <h2 id="upd-title" className="text-lg font-semibold">
          New update available
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          A new version of the system is ready. Please save your current work,
          then click Update. The system will restart by itself.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={later}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            Later
          </button>
          <button
            onClick={update}
            disabled={busy}
            autoFocus
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Updating..." : "Update now"}
          </button>
        </div>
      </div>
    </div>
  );
}
