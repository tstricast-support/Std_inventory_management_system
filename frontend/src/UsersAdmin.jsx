import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Copy, Check } from "lucide-react";
import { BASE_URL, apiFetch } from "./api.js";
import { useAuth } from "./auth.jsx";

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";
const btnPrimary =
  "bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60";
const btnGhost =
  "border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60";
const linkBtn = "text-xs text-blue-600 hover:underline disabled:opacity-50";
const dangerLink = "text-xs text-red-600 hover:underline disabled:opacity-50";

const LEVEL_TEXT = {
  none: "None",
  view: "View",
  create: "Create",
  full: "Full",
};

// One small JSON helper: sends the token through apiFetch and turns server errors into readable messages.
export async function call(path, { method = "GET", body } = {}) {
  const res = await apiFetch(`${BASE_URL}${path}`, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data?.detail;
    throw new Error(
      typeof d === "string"
        ? d
        : Array.isArray(d)
          ? d.map((x) => x.msg).join("; ")
          : `Request failed (${res.status})`,
    );
  }
  return data;
}

// the server stores UTC without a timezone marker
export function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d) ? "—" : d.toLocaleString();
}

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200`}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// ======================================================================================
// Users & Roles page
// ======================================================================================
export function UsersAdminPage() {
  const [tab, setTab] = useState("users");
  const tabCls = (on) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
      on
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-800"
    }`;
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-gray-900">Users &amp; Roles</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Create staff logins and decide what each role may see and do.
      </p>
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        <button
          className={tabCls(tab === "users")}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          className={tabCls(tab === "roles")}
          onClick={() => setTab("roles")}
        >
          Roles
        </button>
      </div>
      {tab === "users" ? <UsersTab /> : <RolesTab />}
    </div>
  );
}

// ---------------------------------------- USERS ----------------------------------------
function UsersTab() {
  const { user: me, reloadUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]); // companies I may hand out
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(null); // null | "new" | a user row
  const [tempPw, setTempPw] = useState(null); // { username, password }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [u, r, c] = await Promise.all([
        call("/users/"),
        call("/roles/"),
        call("/companies"),
      ]);
      setUsers(u);
      setRoles(r);
      setCompanies(c);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (u, doneText, run, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(u.id);
    setError("");
    setNotice("");
    try {
      const res = await run();
      setNotice(doneText);
      if (res?.temporary_password)
        setTempPw({ username: u.username, password: res.temporary_password });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{users.length} user(s)</p>
        <button
          onClick={() => setForm("new")}
          className={`${btnPrimary} flex items-center gap-1.5`}
        >
          <Plus size={15} /> Add user
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-3 text-sm text-green-700">{notice}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Companies</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last login</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {users.map((u) => {
              const busy = busyId === u.id;
              const isMe = me?.id === u.id;
              return (
                <tr
                  key={u.id}
                  className={u.is_active ? "" : "bg-gray-50 text-gray-500"}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {u.full_name}{" "}
                      {isMe && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{u.username}</p>
                  </td>
                  <td className="px-4 py-3">{u.role?.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.companies || []).map((c) => (
                        <Badge key={c.id} tone="blue">
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 space-x-1 whitespace-nowrap">
                    {u.is_active ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="red">Inactive</Badge>
                    )}
                    {u.locked && <Badge tone="amber">Locked</Badge>}
                    {u.must_change_password && (
                      <Badge tone="blue">Must change password</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {fmtTime(u.last_login)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <button
                        className={linkBtn}
                        disabled={busy}
                        onClick={() => setForm(u)}
                      >
                        Edit
                      </button>
                      <button
                        className={linkBtn}
                        disabled={busy}
                        onClick={() =>
                          act(
                            u,
                            `Password reset for ${u.username}.`,
                            () =>
                              call(`/users/${u.id}/reset-password`, {
                                method: "PUT",
                                body: {},
                              }),
                            `Reset the password for ${u.username}? They will be signed out everywhere and must choose a new password.`,
                          )
                        }
                      >
                        Reset password
                      </button>
                      {u.locked && (
                        <button
                          className={linkBtn}
                          disabled={busy}
                          onClick={() =>
                            act(u, `${u.username} unlocked.`, () =>
                              call(`/users/${u.id}/unlock`, { method: "PUT" }),
                            )
                          }
                        >
                          Unlock
                        </button>
                      )}
                      <button
                        className={linkBtn}
                        disabled={busy}
                        onClick={() =>
                          act(
                            u,
                            `${u.username} signed out of all devices.`,
                            () =>
                              call(`/users/${u.id}/sign-out-all`, {
                                method: "PUT",
                              }),
                            `Sign ${u.username} out of all devices? (An open page can keep working for up to 30 minutes. Deactivate the user to block them at once.)`,
                          )
                        }
                      >
                        Sign out all
                      </button>
                      {u.is_active ? (
                        !isMe && (
                          <button
                            className={dangerLink}
                            disabled={busy}
                            onClick={() =>
                              act(
                                u,
                                `${u.username} deactivated.`,
                                () =>
                                  call(`/users/${u.id}/deactivate`, {
                                    method: "PUT",
                                  }),
                                `Deactivate ${u.username}? They are blocked on their very next request. Their history stays.`,
                              )
                            }
                          >
                            Deactivate
                          </button>
                        )
                      ) : (
                        <button
                          className={linkBtn}
                          disabled={busy}
                          onClick={() =>
                            act(u, `${u.username} activated.`, () =>
                              call(`/users/${u.id}/activate`, {
                                method: "PUT",
                              }),
                            )
                          }
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Users are never deleted - deactivate them instead, so the audit history
        stays complete.
      </p>

      {form && (
        <UserFormModal
          user={form === "new" ? null : form}
          roles={roles}
          companies={companies}
          onClose={() => setForm(null)}
          onSaved={async (result, created) => {
            setForm(null);
            if (result?.id === me?.id) reloadUser().catch(() => {}); // my own company list may have changed
            setNotice(
              created ? `User ${result.username} created.` : "User updated.",
            );
            if (created && result.temporary_password)
              setTempPw({
                username: result.username,
                password: result.temporary_password,
              });
            await load();
          }}
        />
      )}
      {tempPw && (
        <TempPasswordModal info={tempPw} onClose={() => setTempPw(null)} />
      )}
    </div>
  );
}

function UserFormModal({ user, roles, companies, onClose, onSaved }) {
  const isNew = !user;
  const { user: me } = useAuth();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [roleId, setRoleId] = useState(user?.role?.id || roles[0]?.id || "");
  const [tempPassword, setTempPassword] = useState("");
  // new user: start with the company I am working in; edit: the companies the user has now
  const [companyIds, setCompanyIds] = useState(() =>
    isNew
      ? me?.company_id
        ? [me.company_id]
        : []
      : (user.companies || []).map((c) => c.id),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleCompany = (id) =>
    setCompanyIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (companyIds.length === 0)
      return setError("Choose at least one company for this user.");
    setBusy(true);
    try {
      if (isNew) {
        const created = await call("/users/", {
          method: "POST",
          body: {
            username,
            full_name: fullName,
            role_id: Number(roleId),
            temp_password: tempPassword || null,
            company_ids: companyIds,
          },
        });
        await onSaved(created, true);
      } else {
        const updated = await call(`/users/${user.id}`, {
          method: "PUT",
          body: {
            full_name: fullName,
            role_id: Number(roleId),
            company_ids: companyIds,
          },
        });
        await onSaved(updated, false);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Add user" : `Edit ${user.username}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        {isNew && (
          <div>
            <label className={labelCls}>Username</label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">
              3-50 characters: letters, numbers, dot, dash or underscore. Not
              case sensitive.
            </p>
          </div>
        )}
        <div>
          <label className={labelCls}>Full name</label>
          <input
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus={!isNew}
          />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <select
            className={inputCls}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            required
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            One role applies in every company this user can enter.
          </p>
        </div>
        <div>
          <label className={labelCls}>Companies this user can access *</label>
          <div className="border border-gray-300 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {(companies || []).map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-900 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={companyIds.includes(c.id)}
                  onChange={() => toggleCompany(c.id)}
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            At least one. You can only choose companies you can enter yourself.
            Removing a company blocks the user on their very next request.
          </p>
        </div>
        {isNew && (
          <div>
            <label className={labelCls}>Temporary password (optional)</label>
            <input
              className={inputCls}
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              autoComplete="off"
              placeholder="Leave empty to generate one"
            />
            <p className="text-xs text-gray-400 mt-1">
              At least 10 characters. The user must replace it at first login.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Saving..." : isNew ? "Create user" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TempPasswordModal({ info, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.password);
      setCopied(true);
    } catch {
      /* clipboard blocked: the password is on screen, they can copy by hand */
    }
  };
  return (
    <Modal title="Temporary password" onClose={onClose}>
      <p className="text-sm text-gray-700">
        Give this to <b>{info.username}</b>. It is shown <b>only once</b> and is
        not stored anywhere in plain text. They must choose their own password
        at first sign-in.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-base tracking-wider select-all break-all">
          {info.password}
        </code>
        <button
          onClick={copy}
          className={`${btnGhost} flex items-center gap-1.5`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={onClose} className={btnPrimary}>
          Done
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------- ROLES ----------------------------------------
function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | a role

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([call("/roles/"), call("/roles/meta")]);
      setRoles(r);
      setMeta(m);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (role) => {
    if (!window.confirm(`Delete the role "${role.name}"?`)) return;
    setError("");
    setNotice("");
    try {
      await call(`/roles/${role.id}`, { method: "DELETE" });
      setNotice(`Role "${role.name}" deleted.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{roles.length} role(s)</p>
        <button
          onClick={() => setEditing("new")}
          disabled={!meta}
          className={`${btnPrimary} flex items-center gap-1.5`}
        >
          <Plus size={15} /> New role
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-3 text-sm text-green-700">{notice}</p>}

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {loading && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            Loading...
          </p>
        )}
        {roles.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <div className="flex-1 min-w-[200px]">
              <p className="font-medium text-gray-900">
                {r.name} {r.is_system && <Badge tone="blue">Preset</Badge>}
              </p>
              {r.description && (
                <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
              )}
            </div>
            <p className="text-xs text-gray-500 w-20">{r.user_count} user(s)</p>
            <div className="flex gap-3">
              <button
                className={linkBtn}
                disabled={!meta}
                onClick={() => setEditing(r)}
              >
                {r.is_system && r.name === "Admin" ? "View" : "Edit"}
              </button>
              {!r.is_system && (
                <button className={dangerLink} onClick={() => remove(r)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Preset roles cannot be deleted or renamed. The Admin role always has
        full access and is read-only, so you can never lock yourself out.
      </p>

      {editing && meta && (
        <RoleEditorModal
          meta={meta}
          roles={roles}
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            setNotice(text);
            await load();
          }}
        />
      )}
    </div>
  );
}

function RoleEditorModal({ meta, roles, role, onClose, onSaved }) {
  const isNew = !role;
  const readOnly = !!role && role.is_system && role.name === "Admin";
  const nameLocked = !!role && role.is_system;

  const emptyGrid = useMemo(
    () => Object.fromEntries(meta.areas.map((a) => [a.key, "none"])),
    [meta],
  );
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [perms, setPerms] = useState({
    ...emptyGrid,
    ...(role?.permissions || {}),
  });
  const [rights, setRights] = useState(role?.rights || []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const copyFrom = (id) => {
    const src = roles.find((r) => String(r.id) === String(id));
    if (!src) return;
    setPerms({ ...emptyGrid, ...src.permissions });
    setRights([...src.rights]);
  };
  const toggleRight = (key) =>
    setRights((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );

  const submit = async (e) => {
    e.preventDefault();
    if (readOnly) return onClose();
    setError("");
    setBusy(true);
    try {
      const body = { name, description, permissions: perms, rights };
      if (isNew) await call("/roles/", { method: "POST", body });
      else await call(`/roles/${role.id}`, { method: "PUT", body });
      await onSaved(
        isNew ? `Role "${name}" created.` : `Role "${name}" saved.`,
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={
        isNew
          ? "New role"
          : readOnly
            ? `${role.name} (read-only)`
            : `Edit role: ${role.name}`
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Role name</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={nameLocked}
              required
              minLength={2}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        {isNew && (
          <div>
            <label className={labelCls}>
              Start from an existing role (optional)
            </label>
            <select
              className={inputCls}
              defaultValue=""
              onChange={(e) => copyFrom(e.target.value)}
            >
              <option value="">Blank - no access</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Area</th>
                {meta.levels.map((l) => (
                  <th key={l} className="px-3 py-2 text-center">
                    {LEVEL_TEXT[l] || l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meta.areas.map((a) => (
                <tr key={a.key}>
                  <td className="px-3 py-1.5 text-gray-800">{a.label}</td>
                  {meta.levels.map((l) => (
                    <td key={l} className="px-3 py-1.5 text-center">
                      <input
                        type="radio"
                        name={`lvl-${a.key}`}
                        checked={perms[a.key] === l}
                        disabled={readOnly}
                        onChange={() => setPerms((p) => ({ ...p, [a.key]: l }))}
                        aria-label={`${a.label}: ${LEVEL_TEXT[l] || l}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          View = look only. Create = view + add new. Full = view + add + edit.
          Voiding and deleting always need the special rights below, even with
          Full.
        </p>

        <div>
          <p className={labelCls}>Special rights</p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {meta.rights.map((r) => (
              <label
                key={r.key}
                className="flex items-center gap-2 text-sm text-gray-800"
              >
                <input
                  type="checkbox"
                  checked={rights.includes(r.key)}
                  disabled={readOnly}
                  onChange={() => toggleRight(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "Saving..." : "Save role"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ======================================================================================
// "My profile" pop-up. Opened from anywhere with: window.dispatchEvent(new Event("app:profile"))
// ======================================================================================
export function ProfileModal() {
  const { user, openMode } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("app:profile", show);
    return () => window.removeEventListener("app:profile", show);
  }, []);
  if (!open || openMode || !user) return null;
  return <ProfileBody onClose={() => setOpen(false)} />;
}

function ProfileBody({ onClose }) {
  const { user, reloadUser, changePassword, logout } = useAuth();
  const [name, setName] = useState(user.full_name);
  const [nameMsg, setNameMsg] = useState({ ok: true, text: "" });
  const [nameBusy, setNameBusy] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [pwMsg, setPwMsg] = useState({ ok: true, text: "" });
  const [pwBusy, setPwBusy] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setNameMsg({ ok: true, text: "" });
    setNameBusy(true);
    try {
      await call("/auth/profile", { method: "PUT", body: { full_name: name } });
      await reloadUser();
      setNameMsg({ ok: true, text: "Name saved." });
    } catch (err) {
      setNameMsg({ ok: false, text: err.message });
    } finally {
      setNameBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ ok: true, text: "" });
    if (next.length < 10)
      return setPwMsg({
        ok: false,
        text: "The new password must be at least 10 characters.",
      });
    if (next.trim().toLowerCase() === user.username.toLowerCase())
      return setPwMsg({
        ok: false,
        text: "The password must not be the same as the username.",
      });
    if (next !== again)
      return setPwMsg({
        ok: false,
        text: "The two new passwords do not match.",
      });
    setPwBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setAgain("");
      setPwMsg({
        ok: true,
        text: "Password changed. Your other devices were signed out.",
      });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setPwBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out of every device, including this one?"))
      return;
    try {
      await apiFetch(`${BASE_URL}/auth/logout-all`, { method: "POST" });
    } catch {
      /* even if the call fails, sign out here */
    }
    await logout();
  };

  return (
    <Modal title="My profile" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className={labelCls}>Username</p>
          <p className="text-gray-900">{user.username}</p>
        </div>
        <div>
          <p className={labelCls}>Role</p>
          <p className="text-gray-900">{user.role?.name}</p>
        </div>
      </div>

      <form
        onSubmit={saveName}
        className="space-y-2 pb-4 border-b border-gray-200"
      >
        <label className={labelCls}>Full name</label>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={nameBusy || name.trim() === user.full_name}
            className={btnPrimary}
          >
            Save
          </button>
        </div>
        {nameMsg.text && (
          <p
            className={`text-sm ${nameMsg.ok ? "text-green-700" : "text-red-600"}`}
          >
            {nameMsg.text}
          </p>
        )}
      </form>

      <form onSubmit={savePassword} className="space-y-3 pt-4">
        <p className="text-sm font-semibold text-gray-900">Change password</p>
        <div>
          <label className={labelCls}>Current password</label>
          <input
            type="password"
            className={inputCls}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className={labelCls}>New password (min 10 characters)</label>
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
          <label className={labelCls}>Repeat new password</label>
          <input
            type="password"
            className={inputCls}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {pwMsg.text && (
          <p
            className={`text-sm ${pwMsg.ok ? "text-green-700" : "text-red-600"}`}
          >
            {pwMsg.text}
          </p>
        )}
        <button type="submit" disabled={pwBusy} className={btnPrimary}>
          {pwBusy ? "Saving..." : "Change password"}
        </button>
      </form>

      <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
        <button onClick={signOutEverywhere} className={dangerLink}>
          Sign out of all devices
        </button>
        <button onClick={onClose} className={btnGhost}>
          Close
        </button>
      </div>
    </Modal>
  );
}
