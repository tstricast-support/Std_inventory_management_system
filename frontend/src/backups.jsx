import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { BASE_URL, apiFetch } from "./api.js";
import { useAuth } from "./auth.jsx";
import { useCompany } from "./company.jsx";
import { Badge, call, fmtTime } from "./UsersAdmin.jsx";

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";
const btn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60";
const btnPrimary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`;
const linkBtn = "text-sm text-blue-600 hover:underline disabled:opacity-50";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const KIND = {
  manual: { label: "Manual", tone: "blue" },
  scheduled: { label: "Automatic", tone: "green" },
  pre_delete: { label: "Before company was deleted", tone: "amber" },
  pre_restore: { label: "Before a restore", tone: "gray" },
};

function fmtSize(n) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
const pad = (n) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// "type the name to confirm" window, used for both kinds of restore
// ---------------------------------------------------------------------------
function RestoreModal({ title, lines, confirmText, onRun, onClose }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setDone(await onRun(typed.trim()));
    } catch (e) {
      setError(e.message || "The restore failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-gray-900">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold">{title}</h2>
          {!busy && (
            <button
              onClick={() => onClose(!!done, done)}
              aria-label="Close"
              className="p-1 rounded hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {done ? (
          <div className="p-5 space-y-3 text-sm">
            <p className="flex items-start gap-2 text-green-700">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>
                <b>{done.company_name}</b> was restored ({done.rows} records).
              </span>
            </p>
            {done.company_recreated && (
              <p className="text-gray-600">
                The company had been deleted, so it was created again. Open it
                from the company switcher.
              </p>
            )}
            {done.notes?.map((n, i) => (
              <p key={i} className="text-amber-700">
                {n}
              </p>
            ))}
            {done.is_current && (
              <p className="text-gray-600">
                The page will reload so you see the restored data.
              </p>
            )}
            <div className="flex justify-end pt-2">
              <button
                className={btnPrimary}
                onClick={() => onClose(true, done)}
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                {lines.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>
                To confirm, type exactly:{" "}
                <span className="normal-case font-mono text-gray-800">
                  {confirmText}
                </span>
              </label>
              <input
                className={inputCls}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            </div>
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className={btnGhost}
                onClick={() => onClose(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className={`${btn} bg-red-600 text-white hover:bg-red-700`}
                disabled={busy || typed.trim() !== confirmText}
                onClick={run}
              >
                <RotateCcw size={14} />
                {busy ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the page
// ---------------------------------------------------------------------------
export function BackupsPage() {
  const { openMode, hasRight } = useAuth();
  const { company, reload: reloadCompanies } = useCompany();
  const allowed = !openMode && hasRight("manage_companies");

  const [form, setForm] = useState(null); // schedule being edited
  const [info, setInfo] = useState(null); // schedule as saved (next run, last run ...)
  const [backups, setBackups] = useState([]);
  const [deleted, setDeleted] = useState([]); // backups of companies that no longer exist
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [restoring, setRestoring] = useState(null); // { title, lines, confirmText, run }
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        call("/backups/settings"),
        call("/backups"),
      ]);
      setInfo(s);
      setForm((f) => f || s);
      setBackups(l.backups || []);
      setDeleted(l.deleted_companies || []);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load, company?.id]);

  if (!allowed) {
    return (
      <div className="p-6 text-sm text-gray-600">
        Backup &amp; Restore needs the special right{" "}
        <b>Create &amp; manage companies</b>.
      </div>
    );
  }

  const say = (ok, text) => setMsg({ ok, text });
  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: k === "frequency" ? e.target.value : Number(e.target.value),
    }));

  const saveSchedule = async () => {
    setBusy("save");
    say(true, "");
    try {
      const saved = await call("/backups/settings", {
        method: "PUT",
        body: {
          frequency: form.frequency,
          weekday: Number(form.weekday),
          month_day: Number(form.month_day),
          run_hour: Number(form.run_hour),
          keep_count: Number(form.keep_count),
        },
      });
      setInfo(saved);
      setForm(saved);
      say(
        true,
        saved.frequency === "off"
          ? "Automatic backups are off."
          : "Schedule saved.",
      );
    } catch (e) {
      say(false, e.message);
    } finally {
      setBusy("");
    }
  };

  const backupNow = async () => {
    setBusy("now");
    say(true, "");
    try {
      await call("/backups", { method: "POST" });
      await load();
      say(true, "Backup created.");
    } catch (e) {
      say(false, e.message);
    } finally {
      setBusy("");
    }
  };

  const download = async (b) => {
    setBusy(`dl${b.id}`);
    say(true, "");
    try {
      const res = await apiFetch(`${BASE_URL}/backups/${b.id}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          typeof err?.detail === "string" ? err.detail : "Download failed",
        );
      }
      const name =
        /filename="?([^";]+)"?/.exec(
          res.headers.get("Content-Disposition") || "",
        )?.[1] || `backup-${b.id}.stdbackup.gz`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      say(false, e.message);
    } finally {
      setBusy("");
    }
  };

  const remove = async (b) => {
    if (
      !window.confirm(
        `Delete this backup (${fmtTime(b.created_at)})? This cannot be undone.`,
      )
    )
      return;
    setBusy(`rm${b.id}`);
    try {
      await call(`/backups/${b.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      say(false, e.message);
    } finally {
      setBusy("");
    }
  };

  const finishRestore = async (changed, result) => {
    setRestoring(null);
    if (!changed) return;
    if (result?.is_current) {
      window.location.reload(); // no old company data may stay in memory
      return;
    }
    await reloadCompanies();
    await load();
  };

  const startRestore = (b) =>
    setRestoring({
      title: `Restore “${b.company_name}”`,
      lines: [
        `ALL current data of ${b.company_name} will be replaced by the data as it was on ${fmtTime(b.created_at)}.`,
        "Anything entered after that moment is lost. A safety copy of the current data is saved first, so this step can itself be undone.",
      ],
      confirmText: `restore ${b.company_name}`,
      run: (typed) =>
        call(`/backups/${b.id}/restore`, {
          method: "POST",
          body: { confirm: typed },
        }),
    });

  const pickFile = async (file) => {
    if (!file) return;
    say(true, "");
    setBusy("file");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(`${BASE_URL}/backups/inspect-upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Could not read the file",
        );
      setRestoring({
        title: `Restore from file`,
        lines: [
          `This file is a backup of “${data.company_name}” (company #${data.company_id}) made on ${fmtTime(data.created_at)}.`,
          data.exists_now
            ? `ALL current data of “${data.current_name}” will be replaced by the contents of this file.`
            : "That company does not exist any more. It will be created again with the contents of this file.",
        ],
        confirmText: data.confirm_text,
        run: async (typed) => {
          const f2 = new FormData();
          f2.append("file", file);
          f2.append("confirm", typed);
          const r = await apiFetch(`${BASE_URL}/backups/restore-upload`, {
            method: "POST",
            body: f2,
          });
          const d = await r.json().catch(() => null);
          if (!r.ok)
            throw new Error(
              typeof d?.detail === "string" ? d.detail : "The restore failed",
            );
          return d;
        },
      });
    } catch (e) {
      say(false, e.message);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const renderRow = (b, showCompany) => {
    const k = KIND[b.kind] || { label: b.kind, tone: "gray" };
    return (
      <tr key={b.id} className="border-t border-gray-100">
        <td className="px-4 py-3 whitespace-nowrap">{fmtTime(b.created_at)}</td>
        {showCompany && <td className="px-4 py-3">{b.company_name}</td>}
        <td className="px-4 py-3">
          <Badge tone={k.tone}>{k.label}</Badge>
        </td>
        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
          {b.row_count} records · {fmtSize(b.size_bytes)}
        </td>
        <td className="px-4 py-3 text-gray-600">
          {b.created_by_name || "System"}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <button
              className={linkBtn}
              disabled={!!busy}
              onClick={() => startRestore(b)}
            >
              Restore
            </button>
            <button
              className={linkBtn}
              disabled={!!busy}
              onClick={() => download(b)}
            >
              Download
            </button>
            <button
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
              disabled={!!busy}
              onClick={() => remove(b)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const th =
    "px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase";

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6 text-gray-900">
      <div className="flex items-center gap-2">
        <Archive size={22} className="text-gray-500" />
        <h1 className="text-xl font-semibold">Backup &amp; Restore</h1>
      </div>

      {msg.text && (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}

      {/* ---- schedule ---- */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold">
            Automatic backups of {company?.name}
          </h2>
          <p className="text-sm text-gray-500">
            Saves a complete copy of this company: items, customers, invoices,
            payments, journals, banking, taxes, audit log and settings.
          </p>
        </div>
        {form && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>How often</label>
                <select
                  className={inputCls}
                  value={form.frequency}
                  onChange={set("frequency")}
                >
                  <option value="off">Off</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
              </div>
              {form.frequency === "weekly" && (
                <div>
                  <label className={labelCls}>On</label>
                  <select
                    className={inputCls}
                    value={form.weekday}
                    onChange={set("weekday")}
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.frequency === "monthly" && (
                <div>
                  <label className={labelCls}>Day of the month</label>
                  <select
                    className={inputCls}
                    value={form.month_day}
                    onChange={set("month_day")}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.frequency !== "off" && (
                <div>
                  <label className={labelCls}>At ({info?.timezone})</label>
                  <select
                    className={inputCls}
                    value={form.run_hour}
                    onChange={set("run_hour")}
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>
                        {pad(h)}:00
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Keep the newest</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className={inputCls}
                  value={form.keep_count}
                  onChange={set("keep_count")}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className={btnPrimary}
                disabled={!!busy}
                onClick={saveSchedule}
              >
                {busy === "save" ? "Saving…" : "Save schedule"}
              </button>
              <span className="text-sm text-gray-500">
                {info?.frequency !== "off" && info?.next_run_at
                  ? `Next automatic backup: ${fmtTime(info.next_run_at)}`
                  : "No automatic backup is scheduled."}
              </span>
            </div>
            {info?.last_run_at && (
              <p
                className={`text-sm ${info.last_status === "failed" ? "text-red-600" : "text-gray-500"}`}
              >
                Last automatic backup: {fmtTime(info.last_run_at)} —{" "}
                {info.last_status === "ok"
                  ? "done"
                  : `FAILED${info.last_error ? ` (${info.last_error})` : ""}`}
              </p>
            )}
          </>
        )}
      </section>

      {/* ---- saved backups of this company ---- */}
      <section className="bg-white border border-gray-200 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <h2 className="font-semibold">Saved backups</h2>
          <button className={btnPrimary} disabled={!!busy} onClick={backupNow}>
            <Archive size={14} />
            {busy === "now" ? "Backing up…" : "Back up now"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Type</th>
                <th className={th}>Size</th>
                <th className={th}>By</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    No backups yet. Press “Back up now”.
                  </td>
                </tr>
              )}
              {backups.map((b) => renderRow(b, false))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- deleted companies ---- */}
      {deleted.length > 0 && (
        <section className="bg-white border border-amber-300 rounded-xl">
          <div className="p-5 pb-3">
            <h2 className="font-semibold">Deleted companies</h2>
            <p className="text-sm text-gray-500">
              These companies no longer exist, but their backups do. Restoring
              creates the company again.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Company</th>
                  <th className={th}>Type</th>
                  <th className={th}>Size</th>
                  <th className={th}>By</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>{deleted.map((b) => renderRow(b, true))}</tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- from a file ---- */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
        <h2 className="font-semibold">Restore from a file</h2>
        <p className="text-sm text-gray-500">
          Use a backup file you downloaded earlier (
          <span className="font-mono">.stdbackup.gz</span>). This also works
          after the whole database was lost.
        </p>
        <button
          className={btnGhost}
          disabled={!!busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={14} />{" "}
          {busy === "file" ? "Reading…" : "Choose backup file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".gz,.stdbackup,application/gzip"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </section>

      <section className="text-xs text-gray-500 space-y-1">
        <p>
          • Backups are kept inside the system database.{" "}
          <b>Download a copy now and then</b> and keep it somewhere else (your
          computer or a cloud drive), so a problem with the database cannot take
          the backups with it.
        </p>
        <p>
          • A backup holds the company’s data only. User accounts, passwords and
          roles are shared by all companies and are not part of it. Pictures
          stay on ImageKit; the backup keeps their links.
        </p>
        <p>
          • Deleting a company always saves a last backup first, shown above
          under “Deleted companies”.
        </p>
      </section>

      {restoring && (
        <RestoreModal
          title={restoring.title}
          lines={restoring.lines}
          confirmText={restoring.confirmText}
          onRun={restoring.run}
          onClose={finishRestore}
        />
      )}
    </div>
  );
}
