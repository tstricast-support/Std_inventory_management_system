
import { useEffect, useState } from "react";
import { useSearchParams } from "./windows.jsx";
import { History } from "lucide-react";
import { useAuth } from "./auth.jsx";
import { call, fmtTime, Badge } from "./UsersAdmin.jsx";

const PAGE_SIZE = 50;

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";

const EMPTY = {
  user_id: "",
  record_type: "",
  record_id: "",
  action: "",
  date_from: "",
  date_to: "",
  q: "",
};

const pretty = (s) => (s || "").replace(/_/g, " ");

// colour the action so trouble (red) and money changes (amber/green/blue) stand out
function actionTone(action = "") {
  if (/failed|locked|blocked|reuse/.test(action)) return "red";
  if (/void|delete|deactivat/.test(action)) return "amber";
  if (/create|activated|unlocked/.test(action)) return "green";
  if (/update|edit|reset|changed|profile/.test(action)) return "blue";
  return "gray";
}

function buildQuery(filters, offset) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === "" || v == null) return;
    if (k === "record_id" && !/^\d+$/.test(String(v))) return;
    p.set(k, v);
  });
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(offset));
  return p.toString();
}

export function AuditLogPage() {
  const [params] = useSearchParams();
  // arriving from a record's "History" link pre-fills these two
  const first = {
    ...EMPTY,
    record_type: params.get("record_type") || "",
    record_id: params.get("record_id") || "",
  };
  const [draft, setDraft] = useState(first);
  const [applied, setApplied] = useState(first);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ total: 0, items: [] });
  const [options, setOptions] = useState({
    record_types: [],
    actions: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    call("/audit/filters")
      .then(setOptions)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    call(`/audit/?${buildQuery(applied, offset)}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError("");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied, offset]);

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const apply = (e) => {
    e?.preventDefault();
    setApplied(draft);
    setOffset(0);
  };
  const reset = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setOffset(0);
  };
  const showRecord = (r) => {
    const next = {
      ...EMPTY,
      record_type: r.record_type,
      record_id: String(r.record_id),
    };
    setDraft(next);
    setApplied(next);
    setOffset(0);
  };

  const types =
    options.record_types.includes(draft.record_type) || !draft.record_type
      ? options.record_types
      : [draft.record_type, ...options.record_types];
  const from = data.total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, data.total);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Who did what, and when. Entries cannot be edited or deleted.
      </p>

      <form
        onSubmit={apply}
        className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>User</label>
            <select
              className={inputCls}
              value={draft.user_id}
              onChange={set("user_id")}
            >
              <option value="">All users</option>
              {options.users.map((u) => (
                <option
                  key={`${u.id}-${u.username}`}
                  value={u.id ?? ""}
                  disabled={u.id == null}
                >
                  {u.username}
                  {u.id == null ? " (unknown / failed login)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Record type</label>
            <select
              className={inputCls}
              value={draft.record_type}
              onChange={set("record_type")}
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {pretty(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Action</label>
            <select
              className={inputCls}
              value={draft.action}
              onChange={set("action")}
            >
              <option value="">All actions</option>
              {options.actions.map((a) => (
                <option key={a} value={a}>
                  {pretty(a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Record ID</label>
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="e.g. 12"
              value={draft.record_id}
              onChange={set("record_id")}
            />
          </div>
          <div>
            <label className={labelCls}>From date</label>
            <input
              type="date"
              className={inputCls}
              value={draft.date_from}
              onChange={set("date_from")}
            />
          </div>
          <div>
            <label className={labelCls}>To date</label>
            <input
              type="date"
              className={inputCls}
              value={draft.date_to}
              onChange={set("date_to")}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Search the summary</label>
            <input
              className={inputCls}
              placeholder="e.g. INV-0012"
              value={draft.q}
              onChange={set("q")}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={reset}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Dates are matched against UTC time, as stored by the server.
        </p>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Record</th>
              <th className="px-4 py-2">Summary</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No entries match these filters.
                </td>
              </tr>
            )}
            {data.items.map((r) => (
              <tr key={r.id} className={loading ? "opacity-60" : ""}>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                  {fmtTime(r.created_at)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.username || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <Badge tone={actionTone(r.action)}>{pretty(r.action)}</Badge>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.record_type && r.record_id != null ? (
                    <button
                      onClick={() => showRecord(r)}
                      title="Show only this record's history"
                      className="text-blue-600 hover:underline"
                    >
                      {pretty(r.record_type)} #{r.record_id}
                    </button>
                  ) : (
                    <span className="text-gray-400">
                      {pretty(r.record_type) || "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 min-w-[240px]">{r.summary}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                  {r.ip || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
        <span>
          {from}-{to} of {data.total}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Newer
          </button>
          <button
            disabled={offset + PAGE_SIZE >= data.total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Older
          </button>
        </div>
      </div>
    </div>
  );
}

// Put this on any record: <HistoryLink type="invoice" id={inv.id} />
// Shows nothing for people who may not open the audit log.
export function HistoryLink({ type, id, className }) {
  const { openMode, can, hasRight } = useAuth();
  const [, setParams] = useSearchParams();
  if (openMode || !can("users", "view") || !hasRight("manage_users"))
    return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setParams({ view: "audit", record_type: type, record_id: String(id) });
      }}
      className={
        className ||
        "inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
      }
    >
      <History size={14} /> History
    </button>
  );
}
