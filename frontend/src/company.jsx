import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Building2, Plus, Trash2, Upload, X } from "lucide-react";
import { BASE_URL, apiFetch, setAccessToken } from "./api.js";
import { useAuth } from "./auth.jsx";
import { clearCompanyProfileCache } from "./pdf.js";

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";

async function readError(res, fallback) {
  const err = await res.json().catch(() => null);
  return typeof err?.detail === "string" ? err.detail : fallback;
}

// ---------------------------------------------------------------------------
// context: the active company's profile + the list of companies I may enter
// ---------------------------------------------------------------------------
const CompanyContext = createContext({
  company: null,
  companies: [],
  reload: async () => {},
  error: "",
});

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }) {
  const { status } = useAuth();
  const ready = status === "authed" || status === "open";
  const [company, setCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  const baseTitle = useRef(document.title);

  const reload = useCallback(async () => {
    clearCompanyProfileCache(); // the PDFs fetch the fresh profile next time
    try {
      const [p, list] = await Promise.all([
        apiFetch(`${BASE_URL}/company/profile`),
        apiFetch(`${BASE_URL}/companies`),
      ]);
      if (!p.ok)
        throw new Error(
          await readError(p, "Could not load the company profile"),
        );
      setCompany(await p.json());
      setCompanies(list.ok ? await list.json() : []);
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the company profile");
    }
  }, []);

  useEffect(() => {
    if (ready) reload();
    else {
      setCompany(null);
      setCompanies([]);
    }
  }, [ready, reload]);

  // browser tab title = company name (index.html keeps a neutral app name until this is loaded)
  useEffect(() => {
    document.title = company?.name || baseTitle.current;
  }, [company?.name]);

  const value = useMemo(
    () => ({ company, companies, reload, error }),
    [company, companies, reload, error],
  );
  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

// Enter another company: new access token for it, then a full reload so no old company data stays in memory.
export async function enterCompany(companyId) {
  const res = await apiFetch(`${BASE_URL}/auth/switch-company`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_id: companyId }),
  });
  if (!res.ok)
    throw new Error(await readError(res, "Could not open the company"));
  const session = await res.json();
  setAccessToken(session.access_token);
  window.location.reload();
}

function useCanManageCompanies() {
  const { openMode, hasRight } = useAuth();
  return !openMode && hasRight("manage_companies");
}

// ---------------------------------------------------------------------------
// sidebar header: logo + company name (+ "+" to create a company, only with manage_companies)
// ---------------------------------------------------------------------------
export function SidebarCompanyHeader() {
  const { company } = useCompany();
  const canManage = useCanManageCompanies();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex items-center gap-2 h-14 px-3 bg-black/20 text-white shrink-0">
      {company?.logo_url ? (
        <img
          src={company.logo_url}
          alt=""
          className="h-8 w-8 rounded bg-white object-contain shrink-0"
        />
      ) : (
        <Building2 size={20} className="shrink-0 text-gray-300" />
      )}
      <span
        className="flex-1 min-w-0 truncate text-sm font-semibold"
        title={company?.name || ""}
      >
        {company?.name || "\u00A0"}
      </span>
      {canManage && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Create company"
          aria-label="Create company"
          className="p-1 rounded hover:bg-white/10 shrink-0"
        >
          <Plus size={18} />
        </button>
      )}
      {creating && <CreateCompanyModal onClose={() => setCreating(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// shared form for "create" and "edit"
// ---------------------------------------------------------------------------
const emptyForm = {
  name: "",
  address_lines: "",
  phone: "",
  email: "",
  invoice_footer: "",
};

function CompanyFields({ form, setForm, disabled }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Company name *</label>
        <input
          className={inputCls}
          value={form.name}
          onChange={set("name")}
          maxLength={150}
          required
          disabled={disabled}
        />
      </div>
      <div>
        <label className={labelCls}>Address (one line per row)</label>
        <textarea
          className={inputCls}
          rows={3}
          value={form.address_lines}
          onChange={set("address_lines")}
          disabled={disabled}
          placeholder={"No 17/A\nHollycross road, Gampaha"}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Phone</label>
          <input
            className={inputCls}
            value={form.phone}
            onChange={set("phone")}
            maxLength={50}
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={set("email")}
            maxLength={150}
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Invoice footer</label>
        <textarea
          className={inputCls}
          rows={2}
          value={form.invoice_footer}
          onChange={set("invoice_footer")}
          disabled={disabled}
          placeholder="e.g. Thank you for your business. Bank: ..."
        />
      </div>
    </div>
  );
}

function LogoPicker({ currentUrl, file, setFile, disabled }) {
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const shown = preview || currentUrl;
  return (
    <div>
      <label className={labelCls}>Logo</label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
          {shown ? (
            <img
              src={shown}
              alt="Logo"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Building2 size={24} className="text-gray-300" />
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <Upload size={14} /> {shown ? "Change logo" : "Choose logo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF or WEBP.</p>
    </div>
  );
}

async function uploadLogo(url, file) {
  const fd = new FormData();
  fd.append("logo", file);
  const res = await apiFetch(url, { method: "POST", body: fd });
  if (!res.ok)
    throw new Error(await readError(res, "The logo could not be uploaded"));
  return res.json();
}

// ---------------------------------------------------------------------------
// "Create company" modal
// ---------------------------------------------------------------------------
export function CreateCompanyModal({ onClose, onCreated }) {
  const { openMode } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { company, logoError }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await apiFetch(`${BASE_URL}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok)
        throw new Error(await readError(res, "Could not create the company"));
      const company = await res.json();
      let logoError = "";
      if (logo) {
        try {
          await uploadLogo(`${BASE_URL}/companies/${company.id}/logo`, logo);
        } catch (err) {
          logoError = err.message; // the company exists; the logo can be added later
        }
      }
      setCreated({ company, logoError });
      onCreated?.(company);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-gray-900">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Create company</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        {created ? (
          <div className="p-5 space-y-3 text-sm">
            <p>
              Company <b>{created.company.name}</b> was created with its own
              empty books.
            </p>
            {created.logoError && (
              <p className="text-amber-700">
                The logo was not saved: {created.logoError} You can add it on
                the Company profile page.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              >
                Stay here
              </button>
              {!openMode && (
                <button
                  onClick={() =>
                    enterCompany(created.company.id).catch((err) =>
                      setError(err.message),
                    )
                  }
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Open this company now
                </button>
              )}
            </div>
            {error && <p className="text-red-600">{error}</p>}
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <CompanyFields form={form} setForm={setForm} disabled={busy} />
            <LogoPicker file={logo} setFile={setLogo} disabled={busy} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !form.name.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Creating..." : "Create company"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Delete company" window: PERMANENT, you must type  delete <company name>
// ---------------------------------------------------------------------------
function DeleteCompanyModal({ target, onClose, onDeleted }) {
  const phrase = `delete ${target.name}`;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = typed.trim() === phrase;

  const submit = async (e) => {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`${BASE_URL}/companies/${target.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      if (!res.ok)
        throw new Error(await readError(res, "Could not delete the company"));
      onDeleted?.(target);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-gray-900">
      <form
        onSubmit={submit}
        className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-red-700">Delete company</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <p className="font-semibold">
              This permanently deletes “{target.name}”.
            </p>
            <p className="mt-1">
              All its items, customers, vendors, quotes, invoices, payments,
              accounts, journals, banking, taxes, audit log and pictures will be
              erased, and nobody can enter it again. This cannot be undone.
            </p>
          </div>
          <p>
            To confirm, type{" "}
            <code className="px-1.5 py-0.5 rounded bg-gray-100 font-mono select-all">
              {phrase}
            </code>
          </p>
          <input
            className={inputCls}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            placeholder={phrase}
          />
          {error && <p className="text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches || busy}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? "Deleting..." : "Delete forever"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company profile page (?view=company)
// ---------------------------------------------------------------------------
export function CompanyProfilePage() {
  const { company, reload, error: loadError } = useCompany();
  const { user } = useAuth();
  const canManage = useCanManageCompanies();
  const [form, setForm] = useState(emptyForm);
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null); // the company in the "Delete company" window
  const [all, setAll] = useState([]);

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name || "",
      address_lines: company.address_lines || "",
      phone: company.phone || "",
      email: company.email || "",
      invoice_footer: company.invoice_footer || "",
    });
  }, [company]);

  const loadAll = useCallback(async () => {
    if (!canManage) return;
    const res = await apiFetch(`${BASE_URL}/companies?include_inactive=true`);
    if (res.ok) setAll(await res.json());
  }, [canManage]);
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const save = async (e) => {
    e.preventDefault();
    setMsg({ ok: true, text: "" });
    setBusy(true);
    try {
      const res = await apiFetch(`${BASE_URL}/company/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not save"));
      if (logo) {
        await uploadLogo(`${BASE_URL}/company/logo`, logo);
        setLogo(null);
      }
      await reload(); // sidebar, page title and the PDFs pick up the change
      await loadAll();
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c) => {
    if (
      c.is_active &&
      !window.confirm(
        `Deactivate "${c.name}"? Nobody can enter it until it is re-activated. No data is deleted.`,
      )
    )
      return;
    setMsg({ ok: true, text: "" });
    try {
      const res = await apiFetch(`${BASE_URL}/companies/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, is_active: !c.is_active }),
      });
      if (!res.ok)
        throw new Error(await readError(res, "Could not change the company"));
      await loadAll();
      await reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  if (!company) {
    return (
      <div className="p-6 text-sm text-gray-500">
        {loadError || "Loading company profile..."}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Company profile</h1>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            <Plus size={14} /> Create company
          </button>
        )}
      </div>

      <form
        onSubmit={save}
        className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
      >
        <CompanyFields
          form={form}
          setForm={setForm}
          disabled={!canManage || busy}
        />
        <LogoPicker
          currentUrl={company.logo_url}
          file={logo}
          setFile={setLogo}
          disabled={!canManage || busy}
        />
        {!canManage && (
          <p className="text-xs text-gray-500">
            Only users with the “Create &amp; manage companies” right can change
            these details.
          </p>
        )}
        {msg.text && (
          <p
            className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}
          >
            {msg.text}
          </p>
        )}
        {canManage && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </form>

      {canManage && all.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="px-5 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200">
            Your companies
          </p>
          <ul className="divide-y divide-gray-100">
            {all.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-5 py-2.5 text-sm"
              >
                <span className="flex-1 min-w-0 truncate text-gray-900">
                  {c.name}
                  {c.id === company.id && (
                    <span className="ml-2 text-xs text-blue-600">current</span>
                  )}
                  {!c.is_active && (
                    <span className="ml-2 text-xs text-gray-400">
                      deactivated
                    </span>
                  )}
                </span>
                {c.is_active && c.id !== company.id && user && (
                  <button
                    onClick={() =>
                      enterCompany(c.id).catch((err) =>
                        setMsg({ ok: false, text: err.message }),
                      )
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Open
                  </button>
                )}
                <button
                  onClick={() => toggleActive(c)}
                  disabled={c.id === company.id}
                  title={
                    c.id === company.id ? "Switch to another company first" : ""
                  }
                  className="text-gray-600 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  {c.is_active ? "Deactivate" : "Re-activate"}
                </button>
                <button
                  onClick={() => setDeleting(c)}
                  disabled={c.id === company.id}
                  title={
                    c.id === company.id
                      ? "Switch to another company first"
                      : "Delete this company forever"
                  }
                  className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating && (
        <CreateCompanyModal
          onClose={() => setCreating(false)}
          onCreated={loadAll}
        />
      )}
      {deleting && (
        <DeleteCompanyModal
          target={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async (c) => {
            setMsg({ ok: true, text: `Company "${c.name}" was deleted.` });
            await loadAll();
            await reload();
          }}
        />
      )}
    </div>
  );
}
