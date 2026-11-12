
import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  Fragment,
} from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import {
  MultiWindow,
  useSearchParams,
  useWindows,
  useWindowActive,
  useWindowFloating,
  useWindowState,
  isShown,
} from "./windows.jsx";
import {
  Pencil,
  Trash2,
  Copy,
  PackagePlus,
  History,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  LayoutGrid,
  Tag,
  Search,
  Receipt,
  Plus,
  Star,
  Check,
  ClipboardList,
  Landmark,
  Truck,
  CornerDownRight,
  Bell,
  Menu,
  Settings,
  MoreVertical,
  Users,
  BookOpen,
  FileText,
  Wallet,
  ShoppingCart,
  CreditCard,
  FileSignature,
  ClipboardCheck,
  RotateCcw,
  Download,
  MessageCircle,
  Percent,
  Banknote,
  TrendingUp,
  LayoutDashboard,
  Home,
  Palette,
  Upload,
  ShieldCheck,
  ScrollText,
  X,
  Printer,
  Building2,
} from "lucide-react";
import "./index.css";
import { BASE_URL, apiFetch } from "./api.js";
import {
  AuthProvider,
  AuthGate,
  useAuth,
  Gate,
  SidebarUser,
  HeaderSignOut,
  FloatingSignOut,
  CompanySwitcher,
  ACCOUNTING_AREAS,
} from "./auth.jsx";
import { UsersAdminPage, ProfileModal } from "./UsersAdmin.jsx";
import { AuditLogPage, HistoryLink } from "./AuditLogPage.jsx";
import {
  CompanyProvider,
  CompanyProfilePage,
  SidebarCompanyHeader,
  useCompany,
} from "./company.jsx";

// const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ---------- API helpers ----------
async function getProducts() {
  const res = await apiFetch(`${BASE_URL}/products/`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

// ---------- Vendors ----------
async function getVendors() {
  const res = await apiFetch(`${BASE_URL}/vendors/`);
  if (!res.ok) throw new Error("Failed to fetch vendors");
  return res.json();
}

async function createVendor(payload) {
  const res = await apiFetch(`${BASE_URL}/vendors/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to create vendor",
    );
  }
  return res.json();
}

async function updateVendor(id, payload) {
  const res = await apiFetch(`${BASE_URL}/vendors/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to update vendor",
    );
  }
  return res.json();
}

async function deleteVendor(id) {
  const res = await apiFetch(`${BASE_URL}/vendors/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to delete vendor",
    );
  }
  return res.json();
}

// ---------- Customers ----------
async function customerRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/customers/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getCustomers = () =>
  customerRequest("", "GET", null, "Failed to fetch customers");
const createCustomer = (payload) =>
  customerRequest("", "POST", payload, "Failed to create customer");
const updateCustomer = (id, payload) =>
  customerRequest(String(id), "PUT", payload, "Failed to update customer");
const deleteCustomer = (id) =>
  customerRequest(String(id), "DELETE", null, "Failed to delete customer");

// ---------- Taxes ----------
async function taxRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/taxes/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getTaxes = () => taxRequest("", "GET", null, "Failed to fetch taxes");
const createTax = (payload) =>
  taxRequest("", "POST", payload, "Failed to save tax");
const updateTax = (id, payload) =>
  taxRequest(String(id), "PUT", payload, "Failed to update tax");
const deleteTax = (id) =>
  taxRequest(String(id), "DELETE", null, "Failed to delete tax");

// ---------- Banking ----------
async function bankRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/banking/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getBankAccounts = () =>
  bankRequest("accounts", "GET", null, "Failed to fetch bank accounts");
const createBankAccount = (payload) =>
  bankRequest("accounts", "POST", payload, "Failed to save account");
const getBankTransactions = (id, from, to) => {
  const q = new URLSearchParams();
  if (from) q.set("date_from", from);
  if (to) q.set("date_to", to);
  const qs = q.toString();
  return bankRequest(
    `accounts/${id}/transactions${qs ? `?${qs}` : ""}`,
    "GET",
    null,
    "Failed to fetch transactions",
  );
};
const createBankTransaction = (payload) =>
  bankRequest("transactions", "POST", payload, "Failed to save transaction");
const deleteBankTransaction = (journalId) =>
  bankRequest(
    `transactions/${journalId}`,
    "DELETE",
    null,
    "Failed to delete transaction",
  );

// step 8B: reconciliation
const getReconcileLines = (id, statementDate) =>
  bankRequest(
    `accounts/${id}/reconcile?statement_date=${statementDate}`,
    "GET",
    null,
    "Failed to load transactions",
  );
const finishReconciliation = (id, payload) =>
  bankRequest(
    `accounts/${id}/reconcile`,
    "POST",
    payload,
    "Failed to save reconciliation",
  );
const getReconciliations = (id) =>
  bankRequest(
    `accounts/${id}/reconciliations`,
    "GET",
    null,
    "Failed to fetch reconciliations",
  );
const undoReconciliation = (recId) =>
  bankRequest(
    `reconciliations/${recId}`,
    "DELETE",
    null,
    "Failed to undo reconciliation",
  );

// ---------- Reports ----------
async function reportRequest(path, failMsg) {
  const res = await apiFetch(`${BASE_URL}/reports/${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getProfitLoss = (from, to) =>
  reportRequest(
    `profit-and-loss?date_from=${from}&date_to=${to}`,
    "Failed to load Profit & Loss",
  );
const getBalanceSheet = (asOf, showZero = false) =>
  reportRequest(
    `balance-sheet?as_of=${asOf}&show_zero=${showZero}`,
    "Failed to load Balance Sheet",
  );
const getAccountTransactions = (accountId, to, own, from) =>
  reportRequest(
    `account-transactions?account_id=${accountId}&include_children=${!own}` +
      (from ? `&date_from=${from}` : "") +
      (to ? `&date_to=${to}` : ""),
    "Failed to load transactions",
  );
const getSalesSummary = (from, to) =>
  reportRequest(
    `sales-summary?date_from=${from}&date_to=${to}&top=10`,
    "Failed to load Sales Summary",
  );

const getDailyReport = (from, to) =>
  reportRequest(
    `daily-sales-collection?date_from=${from}&date_to=${to}`,
    "Failed to load the daily report",
  );
const getDailyDetail = (day) =>
  reportRequest(
    `daily-sales-collection/detail?day=${day}`,
    "Failed to load the day's transactions",
  );

const getAgeing = (kind, asOf) =>
  reportRequest(
    `${kind}-ageing?as_of=${asOf}`,
    "Failed to load the ageing report",
  );

const getDashboard = async (year) => {
  const res = await apiFetch(
    `${BASE_URL}/dashboard${year ? `?year=${year}` : ""}`,
  );
  if (!res.ok) throw new Error("Failed to load the dashboard");
  return res.json();
};

// ---------- Invoices ----------
async function invoiceRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/invoices/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getInvoices = () =>
  invoiceRequest("", "GET", null, "Failed to fetch invoices");
const createInvoice = (payload) =>
  invoiceRequest("", "POST", payload, "Failed to save invoice");
const updateInvoice = (id, payload) =>
  invoiceRequest(String(id), "PUT", payload, "Failed to update invoice");
const voidInvoice = (id) =>
  invoiceRequest(`${id}/void`, "PUT", null, "Failed to void invoice");

const getNextInvoiceNumber = () =>
  invoiceRequest(
    "next-number",
    "GET",
    null,
    "Failed to get the next invoice number",
  );

const deleteInvoice = (id) =>
  invoiceRequest(String(id), "DELETE", null, "Failed to delete invoice");
// ---------- Quotes + Sales orders (step 6: no stock or ledger effect until they become an invoice) ----------
const SALES_DOC_INFO = {
  quote: {
    title: "Quote",
    tab: "quotes",
    dateLabel: "Quote date",
    endLabel: "Expiry date",
    empty: "No quotes yet.",
  },
  sales_order: {
    title: "Sales Order",
    tab: "salesorders",
    dateLabel: "Order date",
    endLabel: "Expected shipment",
    empty: "No sales orders yet.",
  },
};

function salesDocStatus(doc) {
  const fixed = {
    invoiced: ["Invoiced", "bg-green-100 text-green-700"],
    converted: ["Converted", "bg-purple-100 text-purple-700"],
    accepted: ["Accepted", "bg-green-100 text-green-700"],
    declined: ["Declined", "bg-red-100 text-red-700"],
    open: ["Open", "bg-blue-100 text-blue-700"],
  };
  if (fixed[doc.status])
    return { label: fixed[doc.status][0], cls: fixed[doc.status][1] };
  if (doc.expiry_date && doc.expiry_date < toISODate(new Date()))
    return { label: "Expired", cls: "bg-amber-100 text-amber-700" };
  if (doc.status === "sent")
    return { label: "Sent", cls: "bg-blue-100 text-blue-700" };
  return { label: "Draft", cls: "bg-gray-100 text-gray-500" };
}

function SalesDocumentsPage({ isAdmin, go, docType }) {
  const info = SALES_DOC_INFO[docType];
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);
  const [invoiceFor, setInvoiceFor] = useState(null); // the quote / sales order being turned into an invoice
  const [editFor, setEditFor] = useState(null); // the quote / sales order being edited

  const load = async () => {
    try {
      setDocs(await getSalesDocs(docType));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [docType]);

  const run = async (action) => {
    try {
      await action();
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = (doc) => {
    if (!window.confirm(`Delete ${doc.doc_number}?`)) return;
    run(() => deleteSalesDoc(doc.id));
  };

  const handleToSalesOrder = (doc) => {
    if (!window.confirm(`Create a sales order from ${doc.doc_number}?`)) return;
    run(() => quoteToSalesOrder(doc.id));
  };

  const q = search.trim().toLowerCase();
  const shown = docs.filter(
    (d) =>
      !q ||
      [d.doc_number, d.customer_name, d.reference].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
  );

  const btn =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active={info.tab}
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <div className="flex-1">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={`Search ${info.title.toLowerCase()}s...`}
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + New {info.title}
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-center py-16">{info.empty}</p>
        ) : (
          <div className="space-y-2">
            {shown.map((doc) => {
              const st = salesDocStatus(doc);
              const open = expandedId === doc.id;
              const canInvoice = ["draft", "sent", "accepted", "open"].includes(
                doc.status,
              );
              const canConvert =
                doc.doc_type === "quote" &&
                ["draft", "sent", "accepted"].includes(doc.status);
              const canDelete = true;
              const canEdit = !["invoiced", "converted"].includes(doc.status);
              return (
                <div
                  key={doc.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : doc.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {doc.doc_number}{" "}
                        <span className="text-gray-400 font-normal">
                          · {doc.customer_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(doc.doc_date)}
                        {doc.expiry_date &&
                          ` · ${info.endLabel} ${formatJournalDate(doc.expiry_date)}`}
                        {doc.reference && ` · Ref ${doc.reference}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900">
                        {formatRs(doc.total)}
                      </p>
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    {open ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {doc.items.map((l) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <ItemThumb product={l.product} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {l.item_name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {l.quantity} × {formatRs(l.rate)}
                              {l.description && ` · ${l.description}`}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-gray-900 shrink-0">
                            {formatRs(l.amount)}
                          </span>
                        </div>
                      ))}

                      {doc.notes && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                          {doc.notes}
                        </p>
                      )}
                      {doc.source_id && (
                        <p className="text-xs text-gray-400">
                          Created from a quote.
                        </p>
                      )}
                      {doc.invoice_number && (
                        <p className="text-xs text-gray-400">
                          Invoiced as {doc.invoice_number}.
                        </p>
                      )}

                      <div className="border-t border-gray-100 pt-2 text-sm flex justify-between font-semibold">
                        <span>Total</span>
                        <span>{formatRs(doc.total)}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {doc.doc_type === "quote" && doc.status === "draft" && (
                          <button
                            onClick={() =>
                              run(() => setSalesDocStatus(doc.id, "sent"))
                            }
                            className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                          >
                            Mark as sent
                          </button>
                        )}
                        {doc.doc_type === "quote" &&
                          ["draft", "sent"].includes(doc.status) && (
                            <>
                              <button
                                onClick={() =>
                                  run(() =>
                                    setSalesDocStatus(doc.id, "accepted"),
                                  )
                                }
                                className={`${btn} border border-green-200 text-green-700 hover:bg-green-50`}
                              >
                                <Check size={14} /> Accepted
                              </button>
                              <button
                                onClick={() =>
                                  run(() =>
                                    setSalesDocStatus(doc.id, "declined"),
                                  )
                                }
                                className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                              >
                                Declined
                              </button>
                            </>
                          )}
                        {canConvert && (
                          <button
                            onClick={() => handleToSalesOrder(doc)}
                            className={`${btn} border border-blue-200 text-blue-600 hover:bg-blue-50`}
                          >
                            Convert to sales order
                          </button>
                        )}
                        {canInvoice && (
                          <button
                            onClick={() => setInvoiceFor(doc)}
                            className={`${btn} bg-green-600 text-white hover:bg-green-700`}
                          >
                            <FileText size={14} /> Convert to invoice
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => setEditFor(doc)}
                            className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        <button
                          onClick={() => downloadPdf("salesdoc", doc)}
                          className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                        >
                          <Download size={14} /> PDF
                        </button>

                        <button
                          onClick={() => sendWhatsApp("salesdoc", doc)}
                          className={`${btn} bg-green-600 text-white hover:bg-green-700`}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => handleDelete(doc)}
                            className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <SalesDocumentForm
          docType={docType}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}

      {editFor && (
        <SalesDocumentForm
          docType={docType}
          editDoc={editFor}
          onClose={() => setEditFor(null)}
          onSaved={load}
        />
      )}

      {invoiceFor && (
        <InvoiceForm
          fromDoc={invoiceFor}
          onClose={() => setInvoiceFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function SalesDocumentForm({ docType, editDoc = null, onClose, onSaved }) {
  const fromDoc = editDoc;
  const info = SALES_DOC_INFO[docType];
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [customerId, setCustomerId] = useState(
    fromDoc ? fromDoc.customer_id : "",
  );
  const [date, setDate] = useState(fromDoc?.doc_date || toISODate(new Date()));
  const [endDate, setEndDate] = useState(fromDoc?.expiry_date || "");
  const [reference, setReference] = useState(fromDoc?.reference || "");
  const [notes, setNotes] = useState(fromDoc?.notes || "");
  const [lines, setLines] = useState(
    fromDoc && fromDoc.items.some((l) => l.product_id)
      ? fromDoc.items
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: l.product_id,
            description: l.description || "",
            quantity: String(l.quantity),
            rate: String(l.rate),
          }))
      : [blankInvoiceLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()])
      .then(([c, p]) => {
        setCustomers(
          c.filter((x) => x.is_active || x.id === fromDoc?.customer_id),
        );
        setItems(flattenParents(p).filter((x) => !(x.subitems?.length > 0)));
      })
      .catch((err) => setError(err.message));
  }, []);

  const itemById = Object.fromEntries(items.map((p) => [p.id, p]));
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.display_name,
    hint: c.payment_terms,
    search: `${c.display_name} ${c.company_name || ""}`,
  }));
  const itemOptions = items.map((p) => ({
    value: p.id,
    label: p.label,
    hint:
      p.item_type === STOCK_TRACKED_TYPE
        ? `${p.quantity} in stock`
        : p.item_type,
    search: `${p.label} ${p.sku || ""}`,
  }));

  const setLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  const pickItem = (i, productId) => {
    const p = itemById[productId];
    setLine(i, {
      product_id: productId,
      description: p?.description || "",
      rate: p ? String(p.price ?? 0) : "",
    });
  };

  const filled = lines.filter((l) => l.product_id);
  const lineCents = (l) => (Number(l.quantity) || 0) * toCents(l.rate);
  const totalCents = filled.reduce((s, l) => s + lineCents(l), 0);
  const canSave =
    Boolean(customerId) &&
    filled.length > 0 &&
    filled.every(
      (l) =>
        Number.isInteger(Number(l.quantity)) &&
        Number(l.quantity) > 0 &&
        toCents(l.rate) >= 0,
    ) &&
    totalCents > 0 &&
    (!endDate || endDate >= date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        customer_id: customerId,
        doc_date: date,
        expiry_date: endDate || null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        items: filled.map((l) => ({
          product_id: l.product_id,
          description: l.description.trim() || null,
          quantity: Number(l.quantity),
          rate: Number(l.rate) || 0,
        })),
      };
      if (editDoc) await updateSalesDoc(editDoc.id, payload);
      else await createSalesDoc({ doc_type: docType, ...payload });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {editDoc ? `Edit ${editDoc.doc_number}` : `New ${info.title}`}
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Customer</FieldLabel>
            <SearchSelect
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder="Select a customer..."
              searchPlaceholder="Search customers..."
              emptyText="No customers found"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">
              {info.dateLabel}
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              {info.endLabel} (optional)
              <input
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Reference #
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>

          <div className="space-y-3">
            <FieldLabel>Items</FieldLabel>
            {lines.map((l, i) => {
              const p = itemById[l.product_id];
              return (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <ItemThumb product={p} size={56} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <SearchSelect
                        value={l.product_id}
                        onChange={(v) => pickItem(i, v)}
                        options={itemOptions}
                        placeholder="Select an item..."
                        searchPlaceholder="Search items..."
                        emptyText="No items found"
                      />
                      <input
                        placeholder="Description (optional)"
                        value={l.description}
                        onChange={(e) =>
                          setLine(i, { description: e.target.value })
                        }
                        className={cls}
                      />
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        title="Remove line"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 border border-gray-300 rounded-lg p-2 text-gray-500 hover:bg-gray-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-gray-500">
                      Qty
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          setLine(i, { quantity: e.target.value })
                        }
                        className={cls + " mt-1"}
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Rate
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        className={cls + " mt-1"}
                      />
                    </label>
                    <div className="text-xs text-gray-500">
                      Amount
                      <p className="mt-1 py-2 text-sm font-medium text-gray-900">
                        {formatRs(lineCents(l) / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, blankInvoiceLine()])}
              className="text-sm text-blue-600 font-medium inline-flex items-center gap-1"
            >
              <Plus size={14} /> Add another line
            </button>
          </div>

          <textarea
            rows={2}
            placeholder="Notes for the customer"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cls}
          />

          <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatRs(totalCents / 100)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : editDoc
                  ? "Save changes"
                  : `Save ${info.title}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Payments received ----------
async function paymentRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/payments/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getPayments = () =>
  paymentRequest("", "GET", null, "Failed to fetch payments");
const createPayment = (payload) =>
  paymentRequest("", "POST", payload, "Failed to save payment");
const deletePayment = (id) =>
  paymentRequest(String(id), "DELETE", null, "Failed to delete payment");
// ---------- Purchase bills (what you owe vendors) ----------
async function purchaseBillRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/purchase-bills/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getPurchaseBills = () =>
  purchaseBillRequest("", "GET", null, "Failed to fetch bills");
const createPurchaseBill = (payload) =>
  purchaseBillRequest("", "POST", payload, "Failed to save bill");
const voidPurchaseBill = (id) =>
  purchaseBillRequest(`${id}/void`, "PUT", null, "Failed to void bill");

// ---------- Vendor payments (payments made) ----------
async function vendorPaymentRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/vendor-payments/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getVendorPayments = () =>
  vendorPaymentRequest("", "GET", null, "Failed to fetch vendor payments");
const createVendorPayment = (payload) =>
  vendorPaymentRequest("", "POST", payload, "Failed to save vendor payment");
const deleteVendorPayment = (id) =>
  vendorPaymentRequest(
    String(id),
    "DELETE",
    null,
    "Failed to delete vendor payment",
  );

// ---------- Quotes + Sales orders ----------
async function salesDocRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/sales-documents/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getSalesDocs = (docType) =>
  salesDocRequest(
    `?doc_type=${docType}`,
    "GET",
    null,
    "Failed to fetch documents",
  );
const createSalesDoc = (payload) =>
  salesDocRequest("", "POST", payload, "Failed to save document");
const updateSalesDoc = (id, payload) =>
  salesDocRequest(String(id), "PUT", payload, "Failed to update document");
const setSalesDocStatus = (id, status) =>
  salesDocRequest(`${id}/status`, "PUT", { status }, "Failed to change status");
const quoteToSalesOrder = (id) =>
  salesDocRequest(
    `${id}/to-sales-order`,
    "POST",
    null,
    "Failed to convert quote",
  );
const deleteSalesDoc = (id) =>
  salesDocRequest(String(id), "DELETE", null, "Failed to delete");

// builds + downloads a PDF (the PDF code is only loaded when a button is pressed)
async function downloadPdf(kind, record) {
  try {
    const [pdf, customers] = await Promise.all([
      import("./pdf.js"),
      getCustomers().catch(() => []),
    ]);
    const customer = customers.find((c) => c.id === record.customer_id);
    if (kind === "invoice") await pdf.downloadInvoicePdf(record, customer);
    else if (kind === "credit")
      await pdf.downloadCreditNotePdf(record, customer);
    else await pdf.downloadSalesDocPdf(record, customer);
  } catch (err) {
    alert(err.message || "Could not create the PDF");
  }
}

// ---------- Send a PDF by WhatsApp ----------
const WHATSAPP_COUNTRY_CODE = "94"; // used when a customer's number starts with 0. Change it to your country code.

function whatsappNumber(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return WHATSAPP_COUNTRY_CODE + digits.slice(1);
  return digits;
}

async function sendWhatsApp(kind, record) {
  // phones: the share sheet can attach the PDF directly
  const canShareFiles =
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({
      files: [new File(["x"], "t.pdf", { type: "application/pdf" })],
    });
  // computers: open the tab now, before the slow PDF work, so the browser doesn't block it
  const tab = canShareFiles ? null : window.open("about:blank", "_blank");
  try {
    const [pdf, customers] = await Promise.all([
      import("./pdf.js"),
      getCustomers().catch(() => []),
    ]);
    const customer = customers.find((c) => c.id === record.customer_id);
    const file =
      kind === "invoice"
        ? await pdf.downloadInvoicePdf(record, customer, true)
        : await pdf.downloadSalesDocPdf(record, customer, true);
    const label =
      kind === "invoice"
        ? "invoice"
        : record.doc_type === "quote"
          ? "quote"
          : "sales order";
    const number = record.invoice_number || record.doc_number;
    const text = `Hello ${record.customer_name}, please find your ${label} ${number}.`;

    if (canShareFiles && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return; // you closed the share sheet
        // anything else: fall through to the download + WhatsApp chat route below
      }
    }

    // fallback: download the PDF, open the customer's WhatsApp chat
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    const num = whatsappNumber(customer?.phone);
    const link = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
    if (tab) tab.location.href = link;
    else window.open(link, "_blank");
    alert(
      num
        ? `${file.name} was downloaded. Attach it in the WhatsApp chat that just opened.`
        : `${file.name} was downloaded. This customer has no phone number saved, so choose the contact in WhatsApp and attach the file.`,
    );
  } catch (err) {
    if (tab) tab.close();
    alert(err.message || "Could not send by WhatsApp");
  }
}

// ---------- Credit notes ----------
async function creditNoteRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/credit-notes/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getCreditNotes = () =>
  creditNoteRequest("", "GET", null, "Failed to fetch credit notes");
const createCreditNote = (payload) =>
  creditNoteRequest("", "POST", payload, "Failed to save credit note");
const applyCreditNote = (id, payload) =>
  creditNoteRequest(`${id}/apply`, "POST", payload, "Failed to apply credit");
const removeCreditApplication = (id, appId) =>
  creditNoteRequest(
    `${id}/applications/${appId}`,
    "DELETE",
    null,
    "Failed to remove credit",
  );
const voidCreditNote = (id) =>
  creditNoteRequest(`${id}/void`, "PUT", null, "Failed to void credit note");
const deleteCreditNote = (id) =>
  creditNoteRequest(String(id), "DELETE", null, "Failed to delete credit note");

// ---------- Accounts (chart of accounts) ----------
async function getAccounts(accountType) {
  const url = accountType
    ? `${BASE_URL}/accounts/?account_type=${accountType}`
    : `${BASE_URL}/accounts/`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to fetch accounts");
  return res.json();
}

async function createAccount(payload) {
  const res = await apiFetch(`${BASE_URL}/accounts/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to create account",
    );
  }
  return res.json();
}

async function updateAccount(id, payload) {
  const res = await apiFetch(`${BASE_URL}/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to update account",
    );
  }
  return res.json();
}

async function deleteAccount(id) {
  const res = await apiFetch(`${BASE_URL}/accounts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete account");
  return res.json();
}

// every account + its total value (Accounting list page)
async function getAccountsSummary() {
  const res = await apiFetch(`${BASE_URL}/accounts/summary`);
  if (!res.ok) throw new Error("Failed to fetch accounts");
  return res.json();
}

// one account + the items that make up its value (Account detail page)
async function getAccountDetail(id) {
  const res = await apiFetch(`${BASE_URL}/accounts/${id}/detail`);
  if (!res.ok)
    throw new Error(
      res.status === 404
        ? "This account no longer exists."
        : "Failed to fetch account",
    );
  return res.json();
}

// ---------- Journals ----------
async function journalRequest(path, method, payload, failMsg) {
  const res = await apiFetch(`${BASE_URL}/journals/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : failMsg);
  }
  return res.json();
}
const getJournals = () =>
  journalRequest("", "GET", null, "Failed to fetch journals");
const createJournal = (payload) =>
  journalRequest("", "POST", payload, "Failed to save journal");
const deleteJournal = (id) =>
  journalRequest(String(id), "DELETE", null, "Failed to delete journal");
const getTrialBalance = () =>
  journalRequest("trial-balance", "GET", null, "Failed to fetch trial balance");

async function createProduct(formValues, imageFiles) {
  const formData = new FormData();
  formData.append("name", formValues.name);
  formData.append("sku", formValues.sku || "");
  formData.append("description", formValues.description || "");
  formData.append(
    "purchase_description",
    formValues.purchase_description || "",
  );
  formData.append("quantity", formValues.quantity || 0);
  formData.append("price", formValues.price || 0);
  formData.append("cost", formValues.cost || 0);
  formData.append("item_type", formValues.item_type || "Inventory Part");
  formData.append(
    "manufacturer_part_number",
    formValues.manufacturer_part_number || "",
  );

  if (formValues.parent_id) formData.append("parent_id", formValues.parent_id);
  if (formValues.cogs_account_id)
    formData.append("cogs_account_id", formValues.cogs_account_id);
  if (formValues.income_account_id)
    formData.append("income_account_id", formValues.income_account_id);
  if (formValues.asset_account_id)
    formData.append("asset_account_id", formValues.asset_account_id);
  if (formValues.preferred_vendor_id)
    formData.append("preferred_vendor_id", formValues.preferred_vendor_id);
  if (formValues.reorder_min !== "" && formValues.reorder_min != null)
    formData.append("reorder_min", formValues.reorder_min);
  if (formValues.reorder_max !== "" && formValues.reorder_max != null)
    formData.append("reorder_max", formValues.reorder_max);

  imageFiles.forEach((file) => formData.append("images", file));

  const res = await apiFetch(`${BASE_URL}/products/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to create product",
    );
  }
  return res.json();
}

async function updateProduct(id, updates) {
  const res = await apiFetch(`${BASE_URL}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to update product",
    );
  }
  return res.json();
}

async function deleteProduct(id) {
  const res = await apiFetch(`${BASE_URL}/products/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete product");
  return res.json();
}

async function getRequests(status) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();
  const res = await apiFetch(`${BASE_URL}/requests/${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

async function createRequest(payload) {
  const res = await apiFetch(`${BASE_URL}/requests/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to create request");
  }
  return res.json();
}

async function approveRequest(id) {
  const res = await apiFetch(`${BASE_URL}/requests/${id}/approve`, {
    method: "PUT",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to approve request");
  }
  return res.json();
}

async function rejectRequest(id) {
  const res = await apiFetch(`${BASE_URL}/requests/${id}/reject`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Failed to reject request");
  return res.json();
}

async function restockProduct(id, quantity, note) {
  const res = await apiFetch(`${BASE_URL}/products/${id}/restock`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: Number(quantity), note: note || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to restock product");
  }
  return res.json();
}

async function getStockMovements() {
  const res = await apiFetch(`${BASE_URL}/stock-movements/`);
  if (!res.ok) throw new Error("Failed to fetch stock history");
  return res.json();
}

async function addProductImages(id, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));
  const res = await apiFetch(`${BASE_URL}/products/${id}/images`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to upload images",
    );
  }
  return res.json();
}

async function setPrimaryImage(id, imageId) {
  const res = await apiFetch(
    `${BASE_URL}/products/${id}/images/${imageId}/primary`,
    { method: "PUT" },
  );
  if (!res.ok) throw new Error("Failed to set main image");
  return res.json();
}

async function deleteProductImage(id, imageId) {
  const res = await apiFetch(`${BASE_URL}/products/${id}/images/${imageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete image");
  return res.json();
}

// ---------- Excel import + bulk images ----------
async function downloadImportTemplate() {
  const res = await apiFetch(`${BASE_URL}/product-import/template`);
  if (!res.ok) throw new Error("Failed to download template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "item-import-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

async function importProductsFile(file, { updateExisting, dryRun }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("update_existing", String(updateExisting));
  formData.append("dry_run", String(dryRun));
  const res = await apiFetch(`${BASE_URL}/product-import/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Import failed",
    );
  }
  return res.json();
}

async function bulkUploadImages(files, replaceExisting) {
  const formData = new FormData();
  files.forEach((f) => formData.append("images", f));
  formData.append("replace_existing", String(replaceExisting));
  const res = await apiFetch(`${BASE_URL}/product-import/images`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Image upload failed",
    );
  }
  return res.json();
}

async function getIssuedLists() {
  const res = await apiFetch(`${BASE_URL}/issued/`);
  if (!res.ok) throw new Error("Failed to fetch issued lists");
  return res.json();
}

async function createIssuedList(payload) {
  const res = await apiFetch(`${BASE_URL}/issued/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string"
        ? err.detail
        : "Failed to save issued list",
    );
  }
  return res.json();
}

async function getReconcilableRequests(issuedDate) {
  const res = await apiFetch(
    `${BASE_URL}/issued/reconcilable?issued_date=${issuedDate}`,
  );
  if (!res.ok) throw new Error("Failed to load approved requests");
  return res.json();
}

async function deleteIssuedList(id) {
  const res = await apiFetch(`${BASE_URL}/issued/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string"
        ? err.detail
        : "Failed to undo issued list",
    );
  }
  return res.json();
}

async function getBills() {
  const res = await apiFetch(`${BASE_URL}/bills/`);
  if (!res.ok) throw new Error("Failed to fetch bills");
  return res.json();
}

async function createBill(adderName, items) {
  const res = await apiFetch(`${BASE_URL}/bills/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adder_name: adderName, items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to save bill",
    );
  }
  return res.json();
}

async function updateBill(id, adderName, items) {
  const res = await apiFetch(`${BASE_URL}/bills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adder_name: adderName, items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to update bill",
    );
  }
  return res.json();
}

async function deleteBill(id) {
  const res = await apiFetch(`${BASE_URL}/bills/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.detail === "string" ? err.detail : "Failed to delete bill",
    );
  }
  return res.json();
}

// ---------- Date helpers ----------
function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Returns sorted list of "YYYY-MM" strings present in the given ISO date strings, newest first.
function getMonthOptions(isoDates) {
  const set = new Set(isoDates.filter(Boolean).map((d) => d.slice(0, 7)));
  return Array.from(set).sort().reverse();
}

function formatMonthLabel(ym) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

// ---------- MonthSelect ----------
function MonthSelect({ options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All months</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {formatMonthLabel(m)}
        </option>
      ))}
    </select>
  );
}

// ---------- ProductCard ----------
function ProductCard({
  product,
  isAdmin,
  onDelete,
  onEdit,
  onRequest,
  onRestock,
}) {
  const primaryImage =
    product.images?.find((img) => img.is_primary) || product.images?.[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-semibold text-gray-900 truncate">
            {product.name}
          </h3>
          <span className="text-sm font-medium text-gray-600">
            Rs.{Number(product.price).toFixed(2)}
          </span>
        </div>

        {product.sku && (
          <p className="text-xs text-gray-400 mb-2">SKU: {product.sku}</p>
        )}

        <div className="flex justify-between items-center mt-3">
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              product.quantity > 0
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {product.quantity > 0
              ? `${product.quantity} in stock`
              : "Out of stock"}
          </span>

          {isAdmin ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRestock(product)}
                title="Add stock"
                aria-label="Add stock"
                className="p-1.5 rounded-full text-green-600 hover:bg-green-50 transition-colors"
              >
                <PackagePlus size={16} />
              </button>
              <button
                onClick={() => onEdit(product)}
                title="Edit product"
                aria-label="Edit product"
                className="p-1.5 rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDelete(product.id)}
                title="Delete product"
                aria-label="Delete product"
                className="p-1.5 rounded-full text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onRequest(product)}
              disabled={product.quantity === 0}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- ProductGrid ----------
function GroupedProductGrid({
  products,
  isAdmin,
  onDelete,
  onEdit,
  onRequest,
  onRestock,
}) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        No products match your filters.
      </div>
    );
  }

  const sorted = [...products].sort((a, b) => compareNames(a.name, b.name));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {sorted.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isAdmin={isAdmin}
          onDelete={onDelete}
          onEdit={onEdit}
          onRequest={onRequest}
          onRestock={onRestock}
        />
      ))}
    </div>
  );
}

// ---------- RestockModal ----------
function RestockModal({ product, onSubmit, onClose }) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than 0");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(product.id, qty, note.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <PackagePlus size={18} className="text-green-600" />
          <h2 className="text-lg font-semibold">Add Stock</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {product.name} - currently {product.quantity} in stock
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Quantity received *
            </label>
            <input
              type="number"
              min="1"
              autoFocus
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Note (optional)
            </label>
            <input
              placeholder="e.g. Supplier invoice #234"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {Number(quantity) > 0 && (
            <p className="text-xs text-gray-400">
              New total: {product.quantity + Number(quantity)}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- StockHistoryPanel ----------
function StockHistoryPanel({ movements }) {
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = getMonthOptions(movements.map((m) => m.created_at));
  const filtered = selectedMonth
    ? movements.filter((m) => m.created_at?.slice(0, 7) === selectedMonth)
    : movements;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">
          Stock Additions{" "}
          <span className="text-gray-400 font-normal">({filtered.length})</span>
        </h2>
        <MonthSelect
          options={monthOptions}
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No stock movements found for this period.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-50 text-green-600 shrink-0">
                  <PackagePlus size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {m.product?.name || `Product #${m.product_id}`}
                  </p>
                  {m.note && (
                    <p className="text-xs text-gray-400 mt-0.5">{m.note}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">
                  +{m.quantity}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestModal({ products, initialProductId, onSubmit, onClose }) {
  const [items, setItems] = useState([
    { product_id: initialProductId, quantity: 1 },
  ]);
  const [requestedBy, setRequestedBy] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const requestableProducts = products.filter((p) => p.quantity > 0);

  const getProduct = (id) => products.find((p) => p.id === Number(id));

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddItem = () => {
    const usedIds = items.map((i) => Number(i.product_id));
    const nextProduct = requestableProducts.find(
      (p) => !usedIds.includes(p.id),
    );
    setItems((prev) => [
      ...prev,
      { product_id: nextProduct ? nextProduct.id : "", quantity: 1 },
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!requestedBy.trim()) {
      setError("Please enter your name");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item");
      return;
    }
    for (const item of items) {
      if (!item.product_id) {
        setError("Select a product for every item");
        return;
      }
      const product = getProduct(item.product_id);
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) {
        setError("Enter a quantity greater than 0 for every item");
        return;
      }
      if (product && qty > product.quantity) {
        setError(`Only ${product.quantity} of "${product.name}" in stock`);
        return;
      }
    }
    const ids = items.map((i) => Number(i.product_id));
    if (new Set(ids).size !== ids.length) {
      setError(
        "Each product can only appear once - adjust the quantity instead",
      );
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        items.map((item) =>
          onSubmit({
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            requested_by: requestedBy.trim(),
            note: note.trim() || null,
          }),
        ),
      );
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-1">Request Items</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add one or more items to your request
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Your name *
            </label>
            <input
              required
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Items *</label>
            {items.map((item, index) => {
              const selectedProduct = getProduct(item.product_id);
              return (
                <div key={index} className="flex gap-2 items-start">
                  <select
                    required
                    value={item.product_id}
                    onChange={(e) =>
                      handleItemChange(index, "product_id", e.target.value)
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select product</option>
                    {requestableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.quantity} in stock)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.quantity || undefined}
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                    className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    title="Remove item"
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              + Add item
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- RequestsPanel (now with month filter) ----------
function RequestsPanel({ requests, onApprove, onReject }) {
  const [processingId, setProcessingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = getMonthOptions(requests.map((r) => r.created_at));
  const filteredRequests = selectedMonth
    ? requests.filter((r) => r.created_at?.slice(0, 7) === selectedMonth)
    : requests;

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await onApprove(id);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    try {
      await onReject(id);
    } finally {
      setProcessingId(null);
    }
  };

  const pending = filteredRequests.filter((r) => r.status === "pending");
  const resolved = filteredRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MonthSelect
          options={monthOptions}
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No pending requests{selectedMonth ? " for this month" : ""}.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{r.product?.name}</p>
                  <p className="text-sm text-gray-500">
                    {r.quantity} requested by{" "}
                    <span className="font-medium">{r.requested_by}</span>
                  </p>
                  {r.note && (
                    <p className="text-xs text-gray-400 mt-1">"{r.note}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={processingId === r.id}
                    className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={processingId === r.id}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          History
        </h2>
        {resolved.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No resolved requests{selectedMonth ? " for this month" : " yet"}.
          </p>
        ) : (
          <div className="space-y-2">
            {resolved.map((r) => (
              <div
                key={r.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {r.product?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.quantity} requested by {r.requested_by}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateTime(r.created_at)}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    r.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- ImageManager (edit mode: add / change main / delete images) ----------
function ImageManager({ productId, images, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const sorted = [...images].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const product = await action();
      onChange(product.images || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    e.target.value = ""; // lets the same file be picked again later
    if (files.length) run(() => addProductImages(productId, files));
  };

  const handleDelete = (img) => {
    if (!confirm("Delete this image?")) return;
    run(() => deleteProductImage(productId, img.id));
  };

  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">Product images</label>
      {error && (
        <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-2">
          {error}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">No images yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {sorted.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
            >
              <img
                src={img.image_url}
                alt=""
                className="w-full h-full object-cover"
              />
              {img.is_primary && (
                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                  Main
                </span>
              )}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {!img.is_primary && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() => setPrimaryImage(productId, img.id))
                    }
                    title="Make main image"
                    aria-label="Make main image"
                    className="p-1.5 rounded-full bg-white/90 text-amber-500 hover:bg-white shadow disabled:opacity-50"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(img)}
                  title="Delete image"
                  aria-label="Delete image"
                  className="p-1.5 rounded-full bg-white/90 text-red-500 hover:bg-white shadow disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label
        className={`inline-flex items-center gap-1 text-xs font-medium text-blue-600 ${busy ? "opacity-50" : "cursor-pointer hover:underline"}`}
      >
        <Plus size={13} />
        {busy ? "Working..." : "Add images"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={handleFiles}
          className="hidden"
        />
      </label>
      <p className="text-[11px] text-gray-400 mt-1">
        Images save straight away - no need to press Save Changes.
      </p>
    </div>
  );
}

// ---------- ProductForm (QuickBooks-style item form; handles both Create and Edit) ----------
const ITEM_TYPES = [
  "Inventory Part",
  "Non-Inventory Part",
  "Service",
  "Inventory Assembly",
];

// ---------- VendorSelect ----------
function VendorSelect({ vendors, value, onChange, onCreateVendor }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const newVendor = await onCreateVendor(newName.trim());
      onChange(String(newVendor.id));
      setNewName("");
      setCreating(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          placeholder="New vendor name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), handleCreate())
          }
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="shrink-0 bg-blue-600 text-white px-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setCreating(false)}
          className="shrink-0 border border-gray-300 px-3 rounded-lg text-sm hover:bg-gray-50"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">None</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="shrink-0 border border-gray-300 px-3 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
      >
        + New
      </button>
    </div>
  );
}

// ---------- "Not Found" prompt (same question QuickBooks asks) ----------
function NotFoundDialog({
  noun,
  text,
  busy,
  allowQuickAdd = true,
  onQuickAdd,
  onSetUp,
  onCancel,
}) {
  const btn =
    "w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 70 }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
        <h3 className="text-base font-semibold mb-2">{noun} Not Found</h3>
        <p className="text-sm text-gray-700 mb-4">
          The {noun.toLowerCase()} <b>"{text}"</b> doesn't exist yet. Do you
          want to:
        </p>
        <div className="space-y-2">
          {allowQuickAdd && (
            <button
              type="button"
              disabled={busy}
              onClick={onQuickAdd}
              className={btn}
            >
              {busy ? "Adding..." : "Quick Add"}
              <span className="block text-[11px] font-normal text-gray-500">
                Create it now with just the name
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onSetUp}
            className={btn}
          >
            Set Up
            <span className="block text-[11px] font-normal text-gray-500">
              Open the full form to fill in all details
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={btn}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- ComboWithCreate: type-or-pick box; unknown text -> Quick Add / Set Up / Cancel ----------
//   options: [{ id, name, label }]      value: selected id (string)
//   onQuickAdd(name) -> created record  onSetUp(name) -> opens the full form
function ComboWithCreate({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  noun,
  allowQuickAdd = true,
  onQuickAdd,
  onSetUp,
}) {
  const listId = useRef("dl-" + Math.random().toString(36).slice(2)).current;
  const selected = options.find((o) => String(o.id) === String(value));
  const [text, setText] = useState(selected?.label || "");
  const [askFor, setAskFor] = useState(null); // the unknown text being asked about
  const [busy, setBusy] = useState(false);

  // keep the box in sync when the selected id changes (picked, created, form reset)
  useEffect(() => {
    setText(selected?.label || "");
  }, [value, selected?.label]);

  const findMatch = (t) => {
    const q = t.trim().toLowerCase();
    if (!q) return null;
    const byLabel = options.find((o) => (o.label || "").toLowerCase() === q);
    if (byLabel) return byLabel;
    const byName = options.filter((o) => (o.name || "").toLowerCase() === q);
    return byName.length === 1 ? byName[0] : null;
  };

  const commit = () => {
    if (askFor) return;
    const t = text.trim();
    if (!t) {
      if (value) onChange("");
      return;
    }
    const m = findMatch(t);
    if (m) {
      if (String(m.id) !== String(value)) onChange(String(m.id));
      return;
    }
    setAskFor(t); // not in the list -> ask
  };

  const cancelAsk = () => {
    setAskFor(null);
    setText(selected?.label || ""); // put back what was selected before
  };

  const quickAdd = async () => {
    setBusy(true);
    try {
      const created = await onQuickAdd(askFor);
      onChange(String(created.id));
      setAskFor(null);
    } catch (err) {
      alert(err.message);
      cancelAsk();
    } finally {
      setBusy(false);
    }
  };

  const setUp = () => {
    const name = askFor;
    setAskFor(null);
    onSetUp(name);
  };

  return (
    <>
      <input
        list={listId}
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const m = findMatch(e.target.value);
          if (m) onChange(String(m.id)); // picked an existing one
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-full min-w-0 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
      {askFor && (
        <NotFoundDialog
          noun={noun}
          text={askFor}
          busy={busy}
          allowQuickAdd={allowQuickAdd}
          onQuickAdd={quickAdd}
          onSetUp={setUp}
          onCancel={cancelAsk}
        />
      )}
    </>
  );
}

// ---------- ParentItemSelect ("Subitem of" box) ----------
//   onCreateParent(name) -> Quick Add: creates a bare parent item from just a name
//   onNew(name)          -> Set Up: caller opens the full item form
function ParentItemSelect({
  options,
  value,
  onChange,
  onCreateParent,
  onNew,
  allowQuickAdd = true,
  placeholder = "Select parent item...",
  disabled,
}) {
  return (
    <ComboWithCreate
      noun="Item"
      disabled={disabled}
      placeholder={placeholder}
      allowQuickAdd={allowQuickAdd}
      options={options.map((p) => ({
        id: p.id,
        name: p.name,
        label: p.label || p.name,
      }))}
      value={value}
      onChange={onChange}
      onQuickAdd={onCreateParent}
      onSetUp={onNew}
    />
  );
}

// ---------- AccountSetupModal (the "Set Up" form for a new account) ----------
// No <form> tag on purpose: it sits inside the item <form>, and a nested submit would save the item.
const ACCOUNT_TYPE_LABELS = {
  cogs: "Cost of Goods Sold",
  income: "Income",
  asset: "Inventory Asset",
};

function AccountSetupModal({ accountType, initialName, onSave, onClose }) {
  const [name, setName] = useState(initialName || "");
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const save = async () => {
    if (!name.trim()) return setError("Account name is required");
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        account_code: code.trim() || null,
        description: desc.trim() || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 70 }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <h3 className="text-base font-semibold mb-3">New Account</h3>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded px-3 py-2 mb-3">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Account Type
            </label>
            <input
              disabled
              value={ACCOUNT_TYPE_LABELS[accountType] || accountType}
              className={cls + " bg-gray-100 text-gray-500"}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Account Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Number (optional)
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className={cls}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- AccountSelect (COGS / Income / Asset box) ----------
function AccountSelect({
  accounts,
  accountType,
  value,
  onChange,
  placeholder,
  onCreateAccount,
}) {
  const [setupName, setSetupName] = useState(null); // not null = "Set Up" form is open
  const options = accounts
    .filter((a) => a.account_type === accountType)
    .map((a) => ({ id: a.id, name: a.name, label: a.name }));

  return (
    <>
      <ComboWithCreate
        noun="Account"
        placeholder={placeholder}
        options={options}
        value={value}
        onChange={onChange}
        onQuickAdd={(name) => onCreateAccount(name, accountType)}
        onSetUp={(name) => setSetupName(name)}
      />
      {setupName !== null && (
        <AccountSetupModal
          accountType={accountType}
          initialName={setupName}
          onClose={() => setSetupName(null)}
          onSave={async (extra) => {
            const created = await onCreateAccount(
              extra.name,
              accountType,
              extra,
            );
            onChange(String(created.id));
            setSetupName(null);
          }}
        />
      )}
    </>
  );
}

// Restores whatever page a search result was opened from, instead of always landing
// on a hardcoded page. `from` is the origin's full query string (or "home" for none).
function navigateFrom(fromParam, go, fallback) {
  if (!fromParam) return go(fallback);
  if (fromParam === "home") return go({});
  go(Object.fromEntries(new URLSearchParams(fromParam)));
}

// Flattens the item tree so ANY item - top-level or a subitem at any depth - can be picked as a
// parent. Labels show the path ("GREEN iii › DRY PAPER"). When editing, the item itself and
// everything inside it are left out (an item can't be placed inside its own subitems).
function flattenParents(items, excludeId = null, trail = []) {
  const out = [];
  [...items]
    .sort((a, b) => compareNames(a.name, b.name))
    .forEach((p) => {
      if (excludeId != null && p.id === excludeId) return; // skips its whole subtree too
      const path = [...trail, p.name];
      out.push({ ...p, label: path.join(" › ") });
      if (p.subitems?.length)
        out.push(...flattenParents(p.subitems, excludeId, path));
    });
  return out;
}

function filterItemTree(items, q) {
  const filterNode = (item) => {
    const hasKids = item.subitems?.length > 0;
    if (!hasKids) return item.name.toLowerCase().includes(q) ? item : null;
    if (item.name.toLowerCase().includes(q)) return item;
    const kept = item.subitems.map(filterNode).filter(Boolean);
    return kept.length > 0 ? { ...item, subitems: kept } : null;
  };
  return items.map(filterNode).filter(Boolean);
}

// ---------- ProductForm ----------
// What "+ Add Product" opens: first a question (Create Item / Create Subitem), then the form.
// Editing an item, or a form opened from inside another form, skips the question.
function ProductForm(props) {
  const [kind, setKind] = useState(null); // null = still asking
    if (!props.initialData && !props.duplicateFrom && !kind) {
      return <ProductKindChooser onPick={setKind} onClose={props.onClose} />;
    }
  return <ProductFormBody {...props} kind={kind || "item"} />;
}

function ProductKindChooser({ onPick, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Add Product</h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onPick("item")}
            className="w-full text-left border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50"
          >
            <p className="font-medium text-gray-900">+ Create Item</p>
            <p className="text-xs text-gray-500">
              A normal item (optionally a subitem of one item)
            </p>
          </button>
          <button
            type="button"
            onClick={() => onPick("subitem")}
            className="w-full text-left border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50"
          >
            <p className="font-medium text-gray-900">+ Create Subitem</p>
            <p className="text-xs text-gray-500">
              An item that goes inside an existing subitem (e.g. inside CYAN)
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// kind: "item"       -> normal form (Subitem of is optional, parents = top-level items)
//       "subitem"    -> Create Subitem (Subitem of is required, parents = existing subitems)
//       "under-item" -> opened by "+ New" inside a subitem form (Subitem of required, parents = top-level items)

function ProductFormBody({
  initialData,
  duplicateFrom = null, // an existing item to copy into a NEW item
  onSubmit,
  onClose,
  onImagesChanged,
  kind = "item",
  initialName = "",
}) {
  const isEditMode = Boolean(initialData);
  const isDuplicate = !isEditMode && Boolean(duplicateFrom);
  const seed = initialData || duplicateFrom; // where the form fields get their starting values
  const parentKind = kind === "subitem" ? "sub" : "top"; // which items are offered as parents
  const requireParent = kind === "subitem" || kind === "under-item"; // Subitem of is ticked and locked
  const [form, setForm] = useState({
    item_type: seed?.item_type || "Inventory Part",
    name: isDuplicate ? `${seed.name} (Copy)` : seed?.name || initialName || "",
    manufacturer_part_number: seed?.manufacturer_part_number || "",
    is_subitem: requireParent || Boolean(seed?.parent_id),
    parent_id: seed?.parent_id ? String(seed.parent_id) : "",

    purchase_description: seed?.purchase_description || "",
    cost: seed?.cost ?? 0,
    cogs_account_id: seed?.cogs_account?.id ? String(seed.cogs_account.id) : "",
    preferred_vendor_id: seed?.preferred_vendor?.id
      ? String(seed.preferred_vendor.id)
      : "",

    description: seed?.description || "",
    price: seed?.price ?? 0,
    income_account_id: seed?.income_account?.id
      ? String(seed.income_account.id)
      : "",

    asset_account_id: seed?.asset_account?.id
      ? String(seed.asset_account.id)
      : "",
    reorder_min: seed?.reorder_min ?? "",
    reorder_max: seed?.reorder_max ?? "",
    quantity: isDuplicate ? 0 : (seed?.quantity ?? 0), // a copy starts with no stock

    sku: isDuplicate ? "" : seed?.sku || "", // SKU must be unique, so the copy starts blank
  });

  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [creatingParent, setCreatingParent] = useState(null); // null = closed; string = "Set Up" form open
  const [imageFiles, setImageFiles] = useState([]);
  const [images, setImages] = useState(initialData?.images || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // which items can be picked as the parent
  //   editing        -> any item except itself and the items inside it
  //   Create Subitem -> only items that are already subitems (CYAN, MAGENTA, ...)
  //   otherwise      -> top-level items only
  const buildParentOptions = (tree) => {
    if (isEditMode) return flattenParents(tree, initialData.id);
    if (isDuplicate) return flattenParents(tree); // the copy keeps the same parent as the original
    const all = flattenParents(tree);
    return parentKind === "sub"
      ? all.filter((p) => p.parent_id)
      : all.filter((p) => !p.parent_id);
  };

  // load the dropdown data the QuickBooks-style fields need (vendors, accounts, possible parents)
  useEffect(() => {
    (async () => {
      try {
        const [v, a, p] = await Promise.all([
          getVendors(),
          getAccounts(),
          getProducts(),
        ]);
        setVendors(v);
        setAccounts(a);
        setParentOptions(buildParentOptions(p));
      } catch {
        // non-fatal: selects just show "None" if this fails
      }
    })();
  }, []);

  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const handleFileChange = (e) => setImageFiles(Array.from(e.target.files));

  const handleCreateVendor = async (name) => {
    const created = await createVendor({ name });
    setVendors((prev) => [...prev, created]);
    return created;
  };

  const handleCreateAccount = async (name, accountType, extra = {}) => {
    const created = await createAccount({
      name,
      account_type: accountType,
      ...extra, // account_code / description from the "Set Up" form
    });
    setAccounts((prev) => [...prev, created]);
    return created;
  };

  // Create Item form: "Subitem of" -> "+ New" creates a bare parent item from just a name
  const handleCreateParent = async (name) => {
    if (
      parentOptions.some(
        (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error(
        "An item with this name already exists - select it from the list",
      );
    }
    const created = await createProduct(
      { name, item_type: form.item_type },
      [],
    );
    setParentOptions((prev) => [...prev, created]);
    return created;
  };

  // Create Subitem form: "Subitem of" -> "+ New" opens a full form for the parent (a subitem of a
  // top-level item). When it saves, reload the parent list and select the new parent here.
  const handleParentCreated = async (values, files) => {
    const created = await createProduct(values, files);
    const p = await getProducts();
    const opts = buildParentOptions(p);
    if (!opts.some((o) => o.id === created.id)) {
      const extra = flattenParents(p).find((o) => o.id === created.id);
      if (extra) opts.push(extra); // make sure the new parent is selectable
    }
    setParentOptions(opts);
    setForm((prev) => ({
      ...prev,
      is_subitem: true,
      parent_id: String(created.id),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (requireParent && !form.parent_id) {
      return setError("Select the parent item, or use + New to create it");
    }
    setSubmitting(true);
    setError(null);
    try {
      const { is_subitem, ...rest } = form;
      const values = { ...rest, parent_id: is_subitem ? form.parent_id : "" };
      if (isEditMode) {
        await onSubmit(initialData.id, values);
      } else {
        await onSubmit(values, imageFiles);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inp =
    "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const lbl = "block text-xs text-gray-600 mb-0.5";
  const box = "border border-gray-300 rounded p-3 space-y-2";
  const boxTitle = "text-xs font-bold text-gray-600 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-5 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">
          {isEditMode
            ? "Edit Item"
            : isDuplicate
              ? "Duplicate Item"
              : requireParent
                ? "New Subitem"
                : "New Item"}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* ================= LEFT: all the sections ================= */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* ---- TYPE ---- */}
              <div className={box}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={boxTitle}>Type</span>
                  <select
                    value={form.item_type}
                    onChange={(e) => handleChange("item_type", e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">
                    Use for goods you purchase, track as inventory, and resell.
                  </span>
                </div>
              </div>

              {/* ---- Item Name | Subitem of | Manufacturer's Part Number (one row) ---- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={lbl}>Item Name/Number</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={inp}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_subitem}
                      disabled={requireParent}
                      onChange={(e) =>
                        handleChange("is_subitem", e.target.checked)
                      }
                      className="rounded border-gray-300"
                    />
                    Subitem of
                  </label>
                  <ParentItemSelect
                    disabled={!form.is_subitem}
                    options={parentOptions}
                    value={form.parent_id}
                    onChange={(val) => handleChange("parent_id", val)}
                    placeholder={
                      parentKind === "sub"
                        ? "Select parent subitem..."
                        : "Select parent item..."
                    }
                    allowQuickAdd={parentKind !== "sub"}
                    onCreateParent={handleCreateParent}
                    onNew={(name) => setCreatingParent(name)}
                  />
                </div>
                <div>
                  <label className={lbl}>Manufacturer's Part Number</label>
                  <input
                    value={form.manufacturer_part_number}
                    onChange={(e) =>
                      handleChange("manufacturer_part_number", e.target.value)
                    }
                    className={inp}
                  />
                </div>
              </div>

              {/* ---- PURCHASE (left) | SALES (right) ---- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={box}>
                  <h3 className={boxTitle}>Purchase Information</h3>
                  <div>
                    <label className={lbl}>
                      Description on Purchase Transactions
                    </label>
                    <textarea
                      rows={3}
                      value={form.purchase_description}
                      onChange={(e) =>
                        handleChange("purchase_description", e.target.value)
                      }
                      className={inp}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.cost}
                        onChange={(e) => handleChange("cost", e.target.value)}
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Preferred Vendor</label>
                      <VendorSelect
                        vendors={vendors}
                        value={form.preferred_vendor_id}
                        onChange={(val) =>
                          handleChange("preferred_vendor_id", val)
                        }
                        onCreateVendor={handleCreateVendor}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>COGS Account</label>
                    <AccountSelect
                      accounts={accounts}
                      accountType="cogs"
                      placeholder="Select COGS account..."
                      value={form.cogs_account_id}
                      onChange={(val) => handleChange("cogs_account_id", val)}
                      onCreateAccount={handleCreateAccount}
                    />
                  </div>
                </div>

                <div className={box}>
                  <h3 className={boxTitle}>Sales Information</h3>
                  <div>
                    <label className={lbl}>
                      Description on Sales Transactions
                    </label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        handleChange("description", e.target.value)
                      }
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Sales Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={(e) => handleChange("price", e.target.value)}
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Income Account</label>
                    <AccountSelect
                      accounts={accounts}
                      accountType="income"
                      placeholder="Select income account..."
                      value={form.income_account_id}
                      onChange={(val) => handleChange("income_account_id", val)}
                      onCreateAccount={handleCreateAccount}
                    />
                  </div>
                </div>
              </div>

              {/* ---- INVENTORY INFORMATION (one row) ---- */}
              <div className={box}>
                <h3 className={boxTitle}>Inventory Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <label className={lbl}>Asset Account</label>
                    <AccountSelect
                      accounts={accounts}
                      accountType="asset"
                      placeholder="Select asset account..."
                      value={form.asset_account_id}
                      onChange={(val) => handleChange("asset_account_id", val)}
                      onCreateAccount={handleCreateAccount}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Reorder Point (Min)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.reorder_min}
                      onChange={(e) =>
                        handleChange("reorder_min", e.target.value)
                      }
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Max</label>
                    <input
                      type="number"
                      min="0"
                      value={form.reorder_max}
                      onChange={(e) =>
                        handleChange("reorder_max", e.target.value)
                      }
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>On Hand</label>
                    <input
                      type="number"
                      min="0"
                      value={form.quantity}
                      onChange={(e) => handleChange("quantity", e.target.value)}
                      className={inp}
                    />
                  </div>
                </div>
              </div>

              {/* ---- SKU + images (one row) ---- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div>
                  <label className={lbl}>SKU (optional)</label>
                  <input
                    value={form.sku}
                    onChange={(e) => handleChange("sku", e.target.value)}
                    className={inp}
                  />
                </div>
                <div>
                  {!isEditMode && (
                    <>
                      <label className={lbl}>Product images</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="w-full text-sm"
                      />
                    </>
                  )}
                  {isEditMode && (
                    <ImageManager
                      productId={initialData.id}
                      images={images}
                      onChange={(imgs) => {
                        setImages(imgs);
                        onImagesChanged?.();
                      }}
                    />
                  )}
                </div>
              </div>

              {isEditMode && (
                <p className="text-xs text-gray-400">
                  "On Hand" here is a manual override (use it for corrections).
                  To receive new stock, use the "Add stock" button on the
                  product card instead - it logs the addition with a timestamp
                  under Stock History.
                </p>
              )}
            </div>

            {/* ================= RIGHT: OK / Cancel column (like QuickBooks) ================= */}
            <div className="md:w-32 flex flex-row md:flex-col gap-2 md:self-start">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 md:flex-none bg-blue-600 text-white rounded py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : isEditMode ? "Save Changes" : "OK"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 md:flex-none border border-gray-300 rounded py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>

        {/* "Set Up" for Subitem of: opens this same form for the parent item.
            Rendered OUTSIDE the <form> above so its submit doesn't reach this form. */}
        {creatingParent !== null && (
          <ProductFormBody
            kind={parentKind === "sub" ? "under-item" : "item"}
            initialName={creatingParent}
            onSubmit={handleParentCreated}
            onClose={async () => {
              setCreatingParent(null);
              // accounts made inside the parent's form must show up here too
              try {
                setAccounts(await getAccounts());
              } catch {
                /* non-fatal */
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
// ---------- Shared inventory view (used by both routes) ----------
function InventoryView({ isAdmin, onBack }) {
  const { can } = useAuth();
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [activeTab, setActiveTab] = useState("products"); // "products" | "requests" | "history"
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [requestingProduct, setRequestingProduct] = useState(null);
  const [restockingProduct, setRestockingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemId, setItemId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    const calls = [getProducts()];
    if (isAdmin) {
      calls.push(getRequests());
      calls.push(getStockMovements());
    }
    const results = await Promise.all(calls);
    setProducts(results[0]);
    if (isAdmin) {
      setRequests(results[1]);
      setStockMovements(results[2]);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const modalOpen = showForm || requestingProduct || restockingProduct;
      if (!modalOpen && !document.hidden) {
        loadData(true); // silent = no loading spinner flash
      }
    }, 5000);

    const onVisible = () => {
      const modalOpen = showForm || requestingProduct || restockingProduct;
      if (!document.hidden && !modalOpen) loadData(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [showForm, requestingProduct, restockingProduct]);

  const handleCreate = async (formValues, imageFiles) => {
    await createProduct(formValues, imageFiles);
    await loadData();
  };

  const handleUpdate = async (id, updates) => {
    await updateProduct(id, updates);
    await loadData();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    await deleteProduct(id);
    await loadData();
  };

  const handleRequestSubmit = async (payload) => {
    await createRequest(payload);
    await loadData();
  };

  const handleApprove = async (id) => {
    await approveRequest(id);
    await loadData();
  };

  const handleReject = async (id) => {
    await rejectRequest(id);
    await loadData();
  };

  const handleRestock = async (id, quantity, note) => {
    await restockProduct(id, quantity, note);
    await loadData();
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const q = searchTerm.trim().toLowerCase();
  const sortedProducts = [...products].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const shownProducts = q
    ? sortedProducts.filter((p) => p.name.toLowerCase().includes(q))
    : sortedProducts;

  let content;

  if (activeTab === "products" && itemId) {
    const selectedItem = findItemById(products, itemId);
    const parentName = selectedItem?.parent_id
      ? findItemById(products, selectedItem.parent_id)?.name
      : null;
    content = selectedItem ? (
      <ItemDetail
        item={selectedItem}
        parentName={parentName}
        onBack={() => setItemId(null)}
        isAdmin={isAdmin}
        onRestock={
          isAdmin && can("stock_bills", "create")
            ? (p) => setRestockingProduct(p)
            : undefined
        }
        onRequest={!isAdmin ? (p) => setRequestingProduct(p) : undefined}
      />
    ) : (
      <div className="min-h-screen bg-gray-50">
        <SubHeader title="Item details" onBack={() => setItemId(null)} />
        <p className="text-gray-400 text-center py-16">
          This item no longer exists.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex flex-wrap gap-3 justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  aria-label="Back"
                  className="p-2 -ml-2 rounded-full text-gray-500 hover:bg-gray-100"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${isAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {isAdmin ? "Admin" : "Employee (Read Only)"}
                </span>
              </div>
            </div>
            {isAdmin && activeTab === "products" && (
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Add Product
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="flex gap-4 border-b border-gray-100 -mb-4">
              <button
                onClick={() => setActiveTab("products")}
                className={`pb-2 text-sm font-medium border-b-2 ${activeTab === "products" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Products
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === "requests" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Requests
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <History size={14} />
                Stock History
              </button>
            </div>
          )}
        </header>

        <main className="p-4 sm:p-6">
          {loading ? (
            <p className="text-gray-400 text-center py-16">Loading...</p>
          ) : activeTab === "requests" ? (
            <RequestsPanel
              requests={requests}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : activeTab === "history" ? (
            <StockHistoryPanel movements={stockMovements} />
          ) : (
            <>
              <div className="mb-5">
                <SearchBox
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search items..."
                />
                {isAdmin && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Hold an item to add stock
                  </p>
                )}
              </div>
              {products.length === 0 ? (
                <p className="text-gray-400 text-center py-16">
                  No products yet.
                </p>
              ) : shownProducts.length === 0 ? (
                <p className="text-gray-400 text-center py-16">
                  No items match your search.
                </p>
              ) : (
                <div className="space-y-2 max-w-2xl">
                  {shownProducts.map((item) => (
                    <ItemRowWithSubitems
                      key={item.id}
                      item={item}
                      expanded={expandedIds.has(item.id)}
                      onToggle={() => toggleExpanded(item.id)}
                      onSelect={setItemId}
                      isAdmin={isAdmin}
                      onLongPress={(p) => setRestockingProduct(p)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <>
      {content}

      {showForm && (
        <ProductForm
          initialData={editingProduct}
          onSubmit={editingProduct ? handleUpdate : handleCreate}
          onClose={() => {
            setShowForm(false);
            setEditingProduct(null);
          }}
          onImagesChanged={() => loadData(true)}
        />
      )}

      {requestingProduct && (
        <RequestModal
          products={products}
          initialProductId={requestingProduct.id}
          onSubmit={handleRequestSubmit}
          onClose={() => setRequestingProduct(null)}
        />
      )}

      {restockingProduct && (
        <RestockModal
          product={restockingProduct}
          onSubmit={handleRestock}
          onClose={() => setRestockingProduct(null)}
        />
      )}
    </>
  );
}

// ---------- ImportItemsModal (Excel import + bulk images by SKU) ----------
function ImportItemsModal({ onClose, onDone }) {
  const [tab, setTab] = useState("excel"); // "excel" | "images"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // --- Excel tab ---
  const [file, setFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [check, setCheck] = useState(null); // result of the dry run
  const [imported, setImported] = useState(null); // result of the real import

  // --- Images tab ---
  const [imageFiles, setImageFiles] = useState([]);
  const [replaceImages, setReplaceImages] = useState(false);
  const [imgProgress, setImgProgress] = useState(null);
  const [imgResult, setImgResult] = useState(null);

  const runCheck = async (f, upd) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    setImported(null);
    try {
      setCheck(
        await importProductsFile(f, { updateExisting: upd, dryRun: true }),
      );
    } catch (err) {
      setCheck(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0] || null;
    e.target.value = "";
    setFile(f);
    setCheck(null);
    runCheck(f, updateExisting);
  };

  const handleImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await importProductsFile(file, {
        updateExisting,
        dryRun: false,
      });
      setImported(result);
      if (result.saved) onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleImages = async () => {
    setBusy(true);
    setError(null);
    setImgResult(null);
    const total = { matched: [], unmatched: [], failed: [] };
    try {
      // Group files that belong to the same item (PP-1.jpg, PP-1_2.jpg) so they always travel in the
      // same batch - otherwise "Replace existing images" could delete photos uploaded a moment earlier.
      const keyOf = (f) =>
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[\s_-]+\d+$/, "")
          .toLowerCase();
      const groups = new Map();
      imageFiles.forEach((f) => {
        const k = keyOf(f);
        groups.set(k, [...(groups.get(k) || []), f]);
      });
      const batches = [];
      let current = [];
      for (const g of groups.values()) {
        if (current.length && current.length + g.length > 6) {
          // small batches so big uploads don't time out
          batches.push(current);
          current = [];
        }
        current.push(...g);
      }
      if (current.length) batches.push(current);

      let done = 0;
      for (const batch of batches) {
        setImgProgress(
          `Uploading ${done + batch.length} of ${imageFiles.length}...`,
        );
        const r = await bulkUploadImages(batch, replaceImages);
        done += batch.length;
        total.matched.push(...r.matched);
        total.unmatched.push(...r.unmatched);
        total.failed.push(...r.failed);
      }
      setImgResult(total);
      if (total.matched.length) onDone?.();
    } catch (err) {
      setError(err.message);
      setImgResult(total);
    } finally {
      setImgProgress(null);
      setBusy(false);
    }
  };

  const tabCls = (t) =>
    `pb-2 text-sm font-medium border-b-2 ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Import items</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex gap-4 border-b border-gray-100 mb-4">
          <button
            onClick={() => {
              setTab("excel");
              setError(null);
            }}
            className={tabCls("excel")}
          >
            1. Excel file
          </button>
          <button
            onClick={() => {
              setTab("images");
              setError(null);
            }}
            className={tabCls("images")}
          >
            2. Bulk images
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {tab === "excel" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() =>
                downloadImportTemplate().catch((err) => setError(err.message))
              }
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <Download size={14} /> Download Excel template
            </button>

            <label className="block border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
              <input
                type="file"
                accept=".xlsx,.xlsm,.csv"
                onChange={handleFile}
                disabled={busy}
                className="hidden"
              />
              {file ? file.name : "Click to choose an .xlsx or .csv file"}
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={updateExisting}
                disabled={busy}
                onChange={(e) => {
                  setUpdateExisting(e.target.checked);
                  runCheck(file, e.target.checked);
                }}
              />
              Update existing items that have the same SKU (stock quantity is
              never changed)
            </label>

            {busy && !imported && (
              <p className="text-sm text-gray-400">Checking file...</p>
            )}

            {check && !imported && (
              <div className="text-sm border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-gray-700">
                  {check.total_rows} rows:{" "}
                  <b className="text-green-600">{check.created} new</b>
                  {check.updated > 0 && (
                    <>
                      , <b className="text-blue-600">{check.updated} updated</b>
                    </>
                  )}
                  {check.skipped > 0 && (
                    <>
                      ,{" "}
                      <b className="text-gray-500">
                        {check.skipped} skipped (SKU exists)
                      </b>
                    </>
                  )}
                  {check.errors.length > 0 && (
                    <>
                      ,{" "}
                      <b className="text-red-600">
                        {check.errors.length} with errors
                      </b>
                    </>
                  )}
                </p>
                {check.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-red-50 rounded p-2 text-xs text-red-700 space-y-0.5">
                    {check.errors.map((er, i) => (
                      <p key={i}>
                        Row {er.row}
                        {er.name ? ` (${er.name})` : ""}: {er.message}
                      </p>
                    ))}
                    <p className="pt-1 font-medium">
                      Nothing is imported until every row is fixed. Correct the
                      file and choose it again.
                    </p>
                  </div>
                )}
              </div>
            )}

            {imported?.saved && (
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">
                Done: {imported.created} created, {imported.updated} updated,{" "}
                {imported.skipped} skipped. Now open the <b>Bulk images</b> tab
                to add pictures.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={
                  busy ||
                  !check ||
                  check.errors.length > 0 ||
                  check.created + check.updated === 0 ||
                  imported?.saved
                }
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {busy && check
                  ? "Importing..."
                  : `Import ${check ? check.created + check.updated : ""} items`}
              </button>
            </div>
          </div>
        )}

        {tab === "images" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Select many pictures at once. Each file name must match the item's{" "}
              <b>SKU</b> (or exact item name), e.g.{" "}
              <code className="bg-gray-100 px-1 rounded">PP-A4-001.jpg</code>.
              For extra photos of the same item use{" "}
              <code className="bg-gray-100 px-1 rounded">PP-A4-001_2.jpg</code>.
              The first picture becomes the main image.
            </p>

            <label className="block border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                className="hidden"
                onChange={(e) => {
                  setImageFiles(Array.from(e.target.files));
                  setImgResult(null);
                  e.target.value = "";
                }}
              />
              {imageFiles.length
                ? `${imageFiles.length} image(s) selected`
                : "Click to choose images"}
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={replaceImages}
                disabled={busy}
                onChange={(e) => setReplaceImages(e.target.checked)}
              />
              Replace the item's existing images
            </label>

            {imgProgress && (
              <p className="text-sm text-gray-400">{imgProgress}</p>
            )}

            {imgResult && (
              <div className="text-sm border border-gray-200 rounded-lg p-3 space-y-2">
                <p>
                  <b className="text-green-600">
                    {imgResult.matched.length} uploaded
                  </b>
                  {imgResult.unmatched.length > 0 && (
                    <>
                      ,{" "}
                      <b className="text-amber-600">
                        {imgResult.unmatched.length} no matching item
                      </b>
                    </>
                  )}
                  {imgResult.failed.length > 0 && (
                    <>
                      ,{" "}
                      <b className="text-red-600">
                        {imgResult.failed.length} failed
                      </b>
                    </>
                  )}
                </p>
                {imgResult.unmatched.length > 0 && (
                  <p className="text-xs text-amber-700 max-h-24 overflow-y-auto">
                    No match: {imgResult.unmatched.join(", ")}
                  </p>
                )}
                {imgResult.failed.length > 0 && (
                  <p className="text-xs text-red-700 max-h-24 overflow-y-auto">
                    {imgResult.failed
                      .map((f) => `${f.file} (${f.message})`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleImages}
                disabled={busy || imageFiles.length === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Uploading..." : "Upload images"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const AddProductButton = forwardRef(function AddProductButton(
  { onCreated, hideTrigger },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleOpen = () => setOpen(true);

  useImperativeHandle(ref, () => ({
    open: handleOpen,
    openImport: () => setImportOpen(true),
  }));

  const handleCreate = async (values, imageFiles) => {
    await createProduct(values, imageFiles);
    onCreated?.();
  };

  return (
    <>
      {!hideTrigger && (
        <>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={handleOpen}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
          >
            + Add Product
          </button>
        </>
      )}
      
      {open && (
        <ProductForm onSubmit={handleCreate} onClose={() => setOpen(false)} />
      )}
      {importOpen && (
        <ImportItemsModal
          onClose={() => setImportOpen(false)}
          onDone={() => onCreated?.()}
        />
      )}
    </>
  );
});

function LowStockBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const products = await getProducts(); // top-level items with nested subitems
        const flat = [];
        const walk = (list) =>
          list.forEach((p) => {
            if (!p.subitems?.length)
              flat.push(p); // only real leaf items can be "low stock" - categories don't hold their own stock
            else walk(p.subitems);
          });
        walk(products);
        if (!cancelled) setItems(flat.filter(isLowStock));
      } catch {
        // notifications are best-effort - a failed fetch just leaves the bell as-is
      }
    };
    load();
    const interval = setInterval(load, 15000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const goToItem = (item) => {
    setOpen(false);
    setSearchParams({
      view: "items",
      item: String(item.id),
      from: searchParams.toString() || "home",
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Low stock notifications"
        className="relative p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-medium rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-80 overflow-y-auto">
            <p className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 sticky top-0 bg-white">
              Low stock ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">
                All items are above their reorder point.
              </p>
            ) : (
              items.map((item) => {
                return (
                  <button
                    key={item.id}
                    onClick={() => goToItem(item)}
                    className="w-full text-left px-3 py-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} left (min {item.reorder_min})
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- App appearance: theme / accent colour / text size (whole app, saved on this device) ----------
// The colours themselves live in src/index.css (html[data-theme=...] rules); this only picks + remembers them.
const APP_THEME_KEY = "app_theme_v1";
const APP_THEME_LAST_KEY = "app_theme_last_company"; // remembers which company was open (avoids a flash of the wrong theme on reload)
const themeKeyFor = (companyId) =>
  companyId ? `${APP_THEME_KEY}:${companyId}` : APP_THEME_KEY;
const APP_THEMES = [
  {
    id: "light",
    name: "Light",
    note: "Default look",
    swatch: ["#f9fafb", "#ffffff", "#1f2640"],
    accent: "blue",
  },
  {
    id: "dark",
    name: "Dark",
    note: "Easy on the eyes",
    swatch: ["#0f172a", "#1e293b", "#0b1220"],
    accent: "blue",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    note: "Blue-grey with green accent",
    swatch: ["#dfe7ef", "#ffffff", "#0f3a5f"],
    accent: "green",
  },
];
const APP_ACCENTS = [
  { id: "blue", name: "Blue", color: "#2563eb" },
  { id: "indigo", name: "Indigo", color: "#4f46e5" },
  { id: "purple", name: "Purple", color: "#9333ea" },
  { id: "pink", name: "Pink", color: "#db2777" },
  { id: "rose", name: "Rose", color: "#e11d48" },
  { id: "red", name: "Red", color: "#dc2626" },
  { id: "orange", name: "Orange", color: "#ea580c" },
  { id: "amber", name: "Amber", color: "#d97706" },
  { id: "green", name: "Green", color: "#16a34a" },
  { id: "emerald", name: "Emerald", color: "#059669" },
  { id: "teal", name: "Teal", color: "#0d9488" },
  { id: "cyan", name: "Cyan", color: "#0891b2" },
  { id: "slate", name: "Slate", color: "#475569" },
];
// Sidebar colours. All are dark so the white sidebar text stays readable.
// "auto" = follow the theme; "accent" = a dark shade of the chosen accent colour.
const APP_SIDEBARS = [
  { id: "auto", name: "Theme default", color: null },
  { id: "accent", name: "Match accent", color: "var(--color-blue-800)" },
  { id: "navy", name: "Navy", color: "#1f2640" },
  { id: "midnight", name: "Midnight", color: "#0b1220" },
  { id: "ocean", name: "Ocean", color: "#0f3a5f" },
  { id: "slate", name: "Slate", color: "#334155" },
  { id: "black", name: "Black", color: "#111111" },
  { id: "forest", name: "Forest", color: "#14532d" },
  { id: "teal", name: "Teal", color: "#134e4a" },
  { id: "indigo", name: "Indigo", color: "#312e81" },
  { id: "purple", name: "Purple", color: "#3b1d6e" },
  { id: "maroon", name: "Maroon", color: "#7f1d1d" },
  { id: "brown", name: "Brown", color: "#3f2a1d" },
];
const APP_SIZES = [
  ["small", "Small"],
  ["normal", "Normal"],
  ["large", "Large"],
];
const APP_THEME_DEFAULT = {
  theme: "light",
  accent: "blue",
  size: "normal",
  sidebar: "auto",
};

function loadAppTheme(companyId) {
  try {
    const s = JSON.parse(
      localStorage.getItem(themeKeyFor(companyId)) || "null",
    );
    if (s && typeof s === "object") {
      return {
        theme: APP_THEMES.some((t) => t.id === s.theme)
          ? s.theme
          : APP_THEME_DEFAULT.theme,
        accent: APP_ACCENTS.some((a) => a.id === s.accent)
          ? s.accent
          : APP_THEME_DEFAULT.accent,
        size: APP_SIZES.some(([id]) => id === s.size)
          ? s.size
          : APP_THEME_DEFAULT.size,
        sidebar: APP_SIDEBARS.some((x) => x.id === s.sidebar)
          ? s.sidebar
          : APP_THEME_DEFAULT.sidebar,
      };
    }
  } catch (e) {
    /* broken saved data: use defaults */
  }
  return APP_THEME_DEFAULT;
}

function applyAppTheme(s) {
  const el = document.documentElement;
  el.setAttribute("data-theme", s.theme);
  el.setAttribute("data-accent", s.accent);
  el.setAttribute("data-size", s.size);
  const sb = APP_SIDEBARS.find((x) => x.id === s.sidebar);
  if (sb && sb.color) el.style.setProperty("--sidebar-bg", sb.color);
  else el.style.removeProperty("--sidebar-bg"); // "auto" → theme default from index.css
}
applyAppTheme(loadAppTheme(localStorage.getItem(APP_THEME_LAST_KEY))); // runs once when the app loads, before the first screen is drawn

// Slide-in panel. Open it from anywhere with: window.dispatchEvent(new Event("app:appearance"))
function ThemePanel() {
  const { company } = useCompany();
  const companyId = company?.id ?? null;
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(() => loadAppTheme(companyId));

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("app:appearance", show);
    return () => window.removeEventListener("app:appearance", show);
  }, []);

  // when the company becomes known / changes: load ITS saved theme (new companies start with the default)
  useEffect(() => {
    if (companyId == null) return;
    const t = loadAppTheme(companyId);
    setS(t);
    applyAppTheme(t);
    try {
      localStorage.setItem(APP_THEME_LAST_KEY, String(companyId));
    } catch (e) {
      /* storage blocked */
    }
  }, [companyId]);

  const change = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    applyAppTheme(next);
    try {
      localStorage.setItem(themeKeyFor(companyId), JSON.stringify(next));
    } catch (e) {
      /* storage blocked */
    }
  };

  if (!open) return null;

  const label = "text-xs font-semibold text-gray-500 uppercase mb-2";
  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm h-full overflow-y-auto bg-white text-gray-900 p-5 space-y-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-gray-900 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <section>
          <h3 className={label}>Theme</h3>
          <div className="space-y-2">
            {APP_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => change({ theme: t.id, accent: t.accent })}
                className={`w-full flex items-center gap-3 border rounded-lg px-3 py-2.5 text-left ${
                  s.theme === t.id
                    ? "border-blue-600 ring-1 ring-blue-600"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="flex shrink-0">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="w-6 h-6 border border-gray-300"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-xs text-gray-500">{t.note}</span>
                </span>
                {s.theme === t.id && <span className="text-blue-600">✓</span>}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className={label}>Accent colour</h3>
          <div className="flex flex-wrap gap-3">
            {APP_ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.name}
                aria-label={a.name}
                onClick={() => change({ accent: a.id })}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm ${
                  s.accent === a.id ? "ring-2 ring-offset-2 ring-gray-400" : ""
                }`}
                style={{ background: a.color }}
              >
                {s.accent === a.id ? "✓" : ""}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className={label}>Text size</h3>
          <div className="flex">
            {APP_SIZES.map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => change({ size: id })}
                className={`flex-1 px-3 py-1.5 text-sm border ${
                  s.size === id
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className={label}>Sidebar colour</h3>
          <div className="flex flex-wrap gap-3">
            {APP_SIDEBARS.map((x) => (
              <button
                key={x.id}
                type="button"
                title={x.name}
                aria-label={x.name}
                onClick={() => change({ sidebar: x.id })}
                className={`w-9 h-9 rounded-md border border-gray-300 flex items-center justify-center text-white text-sm ${
                  s.sidebar === x.id ? "ring-2 ring-offset-2 ring-gray-400" : ""
                }`}
                style={{
                  background:
                    x.color ||
                    "linear-gradient(135deg, #1f2640 50%, #0f3a5f 50%)", // "Theme default" swatch
                }}
              >
                {s.sidebar === x.id ? "✓" : x.id === "accent" ? "A" : ""}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {APP_SIDEBARS.find((x) => x.id === s.sidebar)?.name}
          </p>
        </section>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => change(APP_THEME_DEFAULT)}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Applies to every page of this company. Saved automatically on this
          device.
        </p>
      </div>
    </div>
  );
}

function AppHeader({
  isAdmin,
  active,
  onTab,
  onProductAdded,
  actions,
  hideAddProduct,
  inlineAction,
}) {
  const { company } = useCompany();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [restockingProduct, setRestockingProduct] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const addProductRef = useRef(null);

  // "+ New Invoice": go to the Invoices page and open its New Invoice form
  // (same behaviour as Ctrl+I; if already on Invoices, just open the form)
  const openNewInvoice = () => {
    if (searchParams.get("view") === "invoices") {
      window.dispatchEvent(
        new CustomEvent("app:new", { detail: { handled: false } }),
      );
    } else {
      pendingNew = true;
      setSearchParams({ view: "invoices" });
    }
  };

  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const [searchDataLoaded, setSearchDataLoaded] = useState(false);
  const loadSearchData = async () => {
    if (searchDataLoaded) return; // only ever fetched once, and only if the search is actually used
    setSearchDataLoaded(true);
    try {
      const [p, v, a] = await Promise.all([
        getProducts(),
        isAdmin ? getVendors() : Promise.resolve([]),
        isAdmin ? getAccounts() : Promise.resolve([]),
      ]);
      setProducts(p);
      setVendors(v);
      setAccounts(a);
    } catch {
      setSearchDataLoaded(false); // let it retry next time the search is opened
    }
  };

  const q = query.trim().toLowerCase();
  const matchedItems = q
    ? flattenParents(products)
        .filter((p) => !(p.subitems?.length > 0)) // only leaf items ever show up - never an unopenable parent row
        .filter((p) => p.label.toLowerCase().includes(q)) // matches the item's own name OR any parent/parent-subitem's name
        .sort((a, b) => compareNames(a.name, b.name))
    : [];
  const matchedVendors = q
    ? vendors
        .filter((v) => v.name.toLowerCase().includes(q))
        .sort((a, b) => compareNames(a.name, b.name))
    : [];
  const matchedAccounts = q
    ? accounts
        .filter((a) => a.name.toLowerCase().includes(q))
        .sort((a, b) => compareNames(a.name, b.name))
    : [];
  const hasResults =
    matchedItems.length > 0 ||
    matchedVendors.length > 0 ||
    matchedAccounts.length > 0;

  const startLongPress = (item) => {
    if (!isAdmin) return; // can't restock a parent - it has no real stock of its own
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setRestockingProduct(item);
    }, 550);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
  };
  const currentAsFrom = () => searchParams.toString() || "home";
  const handleItemClick = (item) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    closeSearch();
    setSearchParams({
      view: "items",
      item: String(item.id),
      from: currentAsFrom(),
    });
  };
  const handleVendorClick = () => {
    closeSearch();
    setSearchParams({ view: "vendors" });
  };
  const handleAccountClick = (a) => {
    closeSearch();
    setSearchParams({
      view: "accounting",
      account: String(a.id),
      from: currentAsFrom(),
    });
  };
  const handleRestock = async (id, quantity, note) => {
    await restockProduct(id, quantity, note);
    setProducts(await getProducts());
  };

  const resultsPanel = q && (
    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto p-3 space-y-4">
      {!hasResults ? (
        <p className="text-sm text-gray-400 text-center py-6">
          Nothing matches "{query.trim()}".
        </p>
      ) : (
        <>
          {matchedItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Items{" "}
                {isAdmin && (
                  <span className="text-gray-400 font-normal normal-case">
                    · hold an item to add stock
                  </span>
                )}
              </h3>
              <div className="space-y-1.5">
                {matchedItems.map((p) => (
                  <button
                    key={`item-${p.id}`}
                    type="button"
                    onClick={() => handleItemClick(p)}
                    onPointerDown={() => startLongPress(p)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      touchAction: "manipulation",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.label}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedVendors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Vendors
              </h3>
              <div className="space-y-1.5">
                {matchedVendors.map((v) => (
                  <button
                    key={`vendor-${v.id}`}
                    type="button"
                    onClick={handleVendorClick}
                    className="w-full flex items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {v.name}
                    </p>
                    <ChevronRight
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedAccounts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Accounts
              </h3>
              <div className="space-y-1.5">
                {matchedAccounts.map((a) => (
                  <button
                    key={`account-${a.id}`}
                    type="button"
                    onClick={() => handleAccountClick(a)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {a.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {ACCOUNT_TYPE_NAMES[a.account_type] || a.account_type}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="flex flex-nowrap gap-2 justify-between items-start">
        {!isAdmin && (
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {company?.name || "\u00A0"}
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              Employee (Read Only)
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0 relative ml-auto">
          <div className="relative hidden md:block w-56 lg:w-72">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search items, vendors, accounts..."
              onFocus={loadSearchData}
            />
            {resultsPanel}
          </div>
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              loadSearchData();
            }}
            aria-label="Search"
            className="md:hidden p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event("app:appearance"))}
            aria-label="Appearance"
            title="Appearance"
            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <Palette size={18} />
          </button>

          {isAdmin && (
            <>
              {inlineAction}
              <LowStockBell />
              {actions && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex flex-col gap-2 min-w-[190px]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {actions}
                    {hideAddProduct && (
                      <>
                        <button
                          onClick={() => addProductRef.current?.openImport()}
                          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
                        >
                          Import items
                        </button>
                        <button
                          onClick={() => addProductRef.current?.open()}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                        >
                          + Add Product
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
              {active !== "items" && (
                <Gate area="invoices" level="create">
                  <button
                    onClick={openNewInvoice}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                  >
                    + New Invoice
                  </button>
                </Gate>
              )}
              <AddProductButton
                ref={addProductRef}
                onCreated={onProductAdded}
                hideTrigger={hideAddProduct || active !== "items"}
              />
            </>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden relative mt-3">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search items, vendors, accounts..."
            onFocus={loadSearchData}
          />
          {resultsPanel}
        </div>
      )}

      {!isAdmin && (
        <HomeTabs active={active} isAdmin={isAdmin} onChange={onTab} />
      )}

      {restockingProduct && (
        <RestockModal
          product={restockingProduct}
          onSubmit={handleRestock}
          onClose={() => setRestockingProduct(null)}
        />
      )}
    </header>
  );
}

// ---------- Shared helpers for the home tabs / items browser ----------
const nameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});
const compareNames = (a, b) => nameCollator.compare(a, b); // A-Z, ignores upper/lower case
const getDepartment = (slug) => DEPARTMENTS.find((d) => d.slug === slug);

function findItemById(products, id) {
  for (const p of products) {
    if (String(p.id) === String(id)) return p;
    if (p.subitems?.length) {
      const found = findItemById(p.subitems, id);
      if (found) return found;
    }
  }
  return null;
}

function HomeTabs({ active, onChange, isAdmin }) {
  const tab = (id, label, Icon) => (
    <button
      key={id}
      onClick={() => onChange(id)}
      className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
        active === id
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
  return (
    <div className="flex gap-5 border-b border-gray-100 -mb-4 mt-3 overflow-x-auto">
      {tab("home", "Home", LayoutGrid)}
      {isAdmin && tab("dashboard", "Dashboard", LayoutDashboard)}
      {isAdmin && tab("accounting", "Acc.", Landmark)}
      {isAdmin && tab("journals", "Journals", BookOpen)}
      {tab("items", "Items", Tag)}
      {isAdmin && tab("customers", "Customers", Users)}
      {isAdmin && tab("quotes", "Quotes", FileSignature)}
      {isAdmin && tab("salesorders", "Sales Orders", ClipboardCheck)}
      {isAdmin && tab("invoices", "Invoices", FileText)}
      {isAdmin && tab("payments", "Payments", Wallet)}
      {isAdmin && tab("creditnotes", "Credit Notes", RotateCcw)}
      {isAdmin && tab("vendors", "Vendors", Truck)}
      {isAdmin && tab("purchases", "Purchases", ShoppingCart)}
      {isAdmin && tab("vendorpayments", "Payments Made", CreditCard)}
      {isAdmin && tab("banking", "Banking", Banknote)}
      {isAdmin && tab("reports", "Reports", TrendingUp)}
      {isAdmin && tab("taxes", "Taxes", Percent)}
      {isAdmin && tab("bill", "Bill", Receipt)}
      {isAdmin && tab("issued", "Issued", ClipboardList)}
      {isAdmin && tab("manage", "Manage", Settings)}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, onFocus }) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function SubHeader({ title, subtitle, onBack }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Back"
        className="p-2 -ml-2 rounded-full text-gray-500 hover:bg-gray-100"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </header>
  );
}

// an item is "low stock" once its quantity drops to (or below) the reorder
// minimum set on it - items with no reorder_min set are never flagged.
function isLowStock(item) {
  return item.reorder_min != null && item.quantity <= item.reorder_min;
}

function StockBadge({ quantity, lowStock }) {
  const colorClass =
    quantity <= 0
      ? "bg-red-100 text-red-700"
      : lowStock
        ? "bg-amber-100 text-amber-700"
        : "bg-green-100 text-green-700";
  const label =
    quantity < 0
      ? `Out of stock (${quantity})`
      : quantity === 0
        ? "Out of stock"
        : lowStock
          ? `${quantity} · Low stock`
          : `${quantity} in stock`;
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${colorClass}`}
    >
      {label}
    </span>
  );
}

// ---------- Item row gestures: tap, long-press (add stock) and desktop right-click menu ----------
function useRowGestures({
  item,
  hasSubitems,
  isAdmin,
  onClick,
  onToggle,
  onLongPress,
  onContextMenuItem,
}) {
  const isDesktop = useIsDesktop();
  const canLongPress = isAdmin && !hasSubitems && Boolean(onLongPress);
  const canMenu = isAdmin && Boolean(onContextMenuItem);
  const timer = useRef(null);
  const triggered = useRef(false);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const start = (e) => {
    if (!canLongPress) return;
    if (e.pointerType === "mouse" && e.button !== 0) return; // right-click belongs to the menu
    triggered.current = false;
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress(item);
    }, 550);
  };
  const handleClick = () => {
    if (triggered.current) {
      triggered.current = false;
      return;
    }
    (hasSubitems ? onToggle : onClick)();
  };
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (triggered.current) return; // a phone long-press already opened "Add stock"
    if (canMenu && isDesktop) {
      cancel();
      onContextMenuItem(item, e.clientX, e.clientY);
    }
  };

  return {
    onClick: handleClick,
    onPointerDown: canLongPress ? start : undefined,
    onPointerUp: canLongPress ? cancel : undefined,
    onPointerLeave: canLongPress ? cancel : undefined,
    onPointerCancel: canLongPress ? cancel : undefined,
    onContextMenu: canLongPress || canMenu ? handleContextMenu : undefined,
    style: canLongPress
      ? {
          touchAction: "manipulation",
          WebkitUserSelect: "none",
          userSelect: "none",
        }
      : undefined,
  };
}

// small panel that appears where the mouse was right-clicked (desktop)
function ItemContextMenu({
  x,
  y,
  item,
  onClose,
  onEdit,
  onDuplicate,
  onRestock,
  onDelete,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // keep the panel inside the window
  const left = Math.max(8, Math.min(x, window.innerWidth - 200));
  const top = Math.max(8, Math.min(y, window.innerHeight - 220));
  const run = (fn) => () => {
    onClose();
    fn(item);
  };
  const btn =
    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50";

  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
        className="absolute w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
      >
        <p className="px-3 py-1.5 text-xs text-gray-400 truncate border-b border-gray-100">
          {item.name}
        </p>
        {onEdit && (
          <button onClick={run(onEdit)} className={`${btn} text-gray-700`}>
            <Pencil size={14} /> Edit
          </button>
        )}
        {onDuplicate && (
          <button onClick={run(onDuplicate)} className={`${btn} text-gray-700`}>
            <Copy size={14} /> Duplicate
          </button>
        )}
        {onRestock && (
          <button onClick={run(onRestock)} className={`${btn} text-gray-700`}>
            <PackagePlus size={14} /> Add stock
          </button>
        )}
        {onDelete && (
          <button
            onClick={run(onDelete)}
            className={`${btn} text-red-600 hover:bg-red-50`}
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onClick,
  expanded,
  onToggle,
  isAdmin,
  onLongPress,
  onContextMenuItem,
}) {
  const image = item.images?.find((i) => i.is_primary) || item.images?.[0];
  const low = isLowStock(item);
  const hasSubitems = (item.subitems?.length ?? 0) > 0;
  const Wrapper = hasSubitems ? "div" : "button";

  const gestures = useRowGestures({
    item,
    hasSubitems,
    isAdmin,
    onClick,
    onToggle,
    onLongPress,
    onContextMenuItem,
  });

  return (
    <Wrapper
      {...gestures}
      className={`w-full flex items-center gap-3 border rounded-xl px-3 py-2 text-left bg-white border-gray-200 hover:border-gray-300 transition ${
        hasSubitems ? "hover:bg-gray-50" : "hover:shadow-md"
      }`}
    >
      <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
        {image ? (
          <img
            src={image.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-gray-400">No image</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.name}</p>
        {!hasSubitems && (
          <p className="text-xs text-gray-500 mt-0.5">{formatRs(item.price)}</p>
        )}
        {hasSubitems && (
          <p className="text-xs text-blue-600 font-medium mt-0.5">
            {item.subitems.length}{" "}
            {item.subitems.length === 1 ? "subitem" : "subitems"}
          </p>
        )}
      </div>
      {!hasSubitems && <StockBadge quantity={item.quantity} lowStock={low} />}
      {hasSubitems ? (
        expanded ? (
          <ChevronDown size={18} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        )
      ) : (
        <ChevronRight size={18} className="text-gray-400 shrink-0" />
      )}
    </Wrapper>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium text-right break-words">
        {value}
      </dd>
    </div>
  );
}

function ItemDetail({
  item,
  parentName,
  onBack,
  isAdmin,
  onEdit,
  onDuplicate,
  onDelete,
  onRestock,
  onRequest,
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = [...(item.images || [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );
  const current = images[Math.min(imageIndex, images.length - 1)];
  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader title="Item details" onBack={onBack} />
      <main className="p-4 sm:p-6">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="aspect-square bg-gray-100">
            {current ? (
              <img
                src={current.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                No image
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto border-b border-gray-100">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImageIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${
                    img.id === current.id
                      ? "border-blue-600"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="p-5">
            <div className="flex justify-between items-start gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {item.name}
              </h2>
              <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Rs.{Number(item.price).toFixed(2)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StockBadge
                quantity={item.quantity}
                lowStock={isLowStock(item)}
              />
              {isAdmin ? (
                <div className="ml-auto flex items-center gap-1">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      title="Edit item"
                      aria-label="Edit item"
                      className="p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  {onRestock && (
                    <button
                      onClick={() => onRestock(item)}
                      title="Add stock"
                      aria-label="Add stock"
                      className="p-2 rounded-full text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <PackagePlus size={18} />
                    </button>
                  )}
                  {(onEdit || onDuplicate || onDelete) && (
                    <ItemActionsMenu
                      onEdit={onEdit ? () => onEdit(item) : undefined}
                      onDuplicate={
                        onDuplicate ? () => onDuplicate(item) : undefined
                      }
                      onDelete={onDelete ? () => onDelete(item) : undefined}
                    />
                  )}
                </div>
              ) : (
                onRequest && (
                  <button
                    onClick={() => onRequest(item)}
                    disabled={item.quantity === 0}
                    className="ml-auto text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Request
                  </button>
                )
              )}
            </div>

            {isLowStock(item) && (
              <p className="mt-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Stock is at or below the reorder point ({item.reorder_min}).
                Consider restocking.
              </p>
            )}

            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label="SKU" value={item.sku || "-"} />
              {parentName && (
                <DetailRow label="Subitem of" value={parentName} />
              )}
              {isAdmin && (
                <>
                  <DetailRow label="Type" value={item.item_type || "-"} />
                  {item.manufacturer_part_number && (
                    <DetailRow
                      label="Mfr. Part #"
                      value={item.manufacturer_part_number}
                    />
                  )}
                  <DetailRow
                    label="Cost"
                    value={`Rs.${Number(item.cost).toFixed(2)}`}
                  />
                  <DetailRow
                    label="COGS Account"
                    value={item.cogs_account?.name || "-"}
                  />
                  <DetailRow
                    label="Income Account"
                    value={item.income_account?.name || "-"}
                  />
                  <DetailRow
                    label="Asset Account"
                    value={item.asset_account?.name || "-"}
                  />
                  <DetailRow
                    label="Preferred Vendor"
                    value={item.preferred_vendor?.name || "-"}
                  />
                  {(item.reorder_min != null || item.reorder_max != null) && (
                    <DetailRow
                      label="Reorder Point"
                      value={`Min ${item.reorder_min ?? "-"} / Max ${item.reorder_max ?? "-"}`}
                    />
                  )}
                </>
              )}
              {item.subitems?.length > 0 && (
                <DetailRow
                  label="Subitems"
                  value={`${item.subitems.length} ${item.subitems.length === 1 ? "item" : "items"}`}
                />
              )}
              {item.description && (
                <div>
                  <dt className="text-gray-500 mb-1">Description</dt>
                  <dd className="text-gray-900 whitespace-pre-line">
                    {item.description}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}

function SubitemRow({
  item,
  onClick,
  expanded,
  onToggle,
  isAdmin,
  onLongPress,
  onContextMenuItem,
}) {
  const image = item.images?.find((i) => i.is_primary) || item.images?.[0];
  const low = isLowStock(item);
  const hasSubitems = (item.subitems?.length ?? 0) > 0;
  const Wrapper = hasSubitems ? "div" : "button";

  const gestures = useRowGestures({
    item,
    hasSubitems,
    isAdmin,
    onClick,
    onToggle,
    onLongPress,
    onContextMenuItem,
  });

  return (
    <Wrapper
      {...gestures}
      className={`w-full flex items-center gap-2 border rounded-xl pl-3 pr-3 py-2.5 text-left transition ${
        hasSubitems ? "hover:bg-gray-50" : "hover:shadow-md"
      } ${
        low
          ? "bg-red-50 border-red-200 hover:border-red-300"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <CornerDownRight size={14} className="text-gray-300 shrink-0" />
      <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
        {image ? (
          <img
            src={image.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[8px] text-gray-400">No image</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {item.name}
        </p>
        {!hasSubitems && (
          <p className="text-xs text-gray-500">{formatRs(item.price)}</p>
        )}
        {hasSubitems && (
          <p className="text-xs text-blue-600 font-medium">
            {item.subitems.length}{" "}
            {item.subitems.length === 1 ? "subitem" : "subitems"}
          </p>
        )}
      </div>
      {!hasSubitems && <StockBadge quantity={item.quantity} lowStock={low} />}
      {hasSubitems ? (
        expanded ? (
          <ChevronDown size={16} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 shrink-0" />
        )
      ) : (
        <ChevronRight size={16} className="text-gray-400 shrink-0" />
      )}
    </Wrapper>
  );
}

function SubitemBranch({
  item,
  onSelect,
  forceOpen,
  isAdmin,
  onLongPress,
  onContextMenuItem,
}) {
  const [open, setOpen] = useState(false);
  const kids = [...(item.subitems || [])].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const isOpen = forceOpen || open;
  return (
    <div className="space-y-1.5">
      <SubitemRow
        item={item}
        onClick={() => onSelect(item.id)}
        expanded={isOpen}
        onToggle={() => setOpen((o) => !o)}
        isAdmin={isAdmin}
        onLongPress={onLongPress}
        onContextMenuItem={onContextMenuItem}
      />
      {kids.length > 0 && isOpen && (
        <div className="ml-6 space-y-1.5">
          {kids.map((k) => (
            <SubitemBranch
              key={k.id}
              item={k}
              onSelect={onSelect}
              forceOpen={forceOpen}
              isAdmin={isAdmin}
              onLongPress={onLongPress}
              onContextMenuItem={onContextMenuItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRowWithSubitems({
  item,
  expanded,
  onToggle,
  onSelect,
  forceOpen,
  isAdmin,
  onLongPress,
  onContextMenuItem,
}) {
  const subitems = item.subitems || [];
  const sorted = [...subitems].sort((a, b) => compareNames(a.name, b.name));
  const isOpen = forceOpen || expanded;

  return (
    <div className="space-y-1.5">
      <ItemRow
        item={item}
        onClick={() => onSelect(item.id)}
        expanded={isOpen}
        onToggle={onToggle}
        isAdmin={isAdmin}
        onLongPress={onLongPress}
        onContextMenuItem={onContextMenuItem}
      />
      {sorted.length > 0 && isOpen && (
        <div className="ml-6 space-y-1.5">
          {sorted.map((sub) => (
            <SubitemBranch
              key={sub.id}
              item={sub}
              onSelect={onSelect}
              forceOpen={forceOpen}
              isAdmin={isAdmin}
              onLongPress={onLongPress}
              onContextMenuItem={onContextMenuItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Items page: flat A-Z item list (with subitems nested) -> full item card ----------
function ItemsPage({
  isAdmin,
  itemId,
  fromParam,
  go,
  refreshToken,
  onProductAdded,
}) {
  const { can } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [restockingProduct, setRestockingProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null); // item being edited
  const [duplicatingProduct, setDuplicatingProduct] = useState(null); // item being copied
  const [deleteTarget, setDeleteTarget] = useState(null); // item waiting for typed DELETE
  const [menu, setMenu] = useState(null); // desktop right-click panel: { item, x, y }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const data = await getProducts();
        if (cancelled) return;
        setProducts(data);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshToken]);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRestock = async (id, quantity, note) => {
    await restockProduct(id, quantity, note);
    setProducts(await getProducts());
  };

  const handleUpdate = async (id, updates) => {
    await updateProduct(id, updates);
    setProducts(await getProducts());
  };

  const handleCreateCopy = async (values, imageFiles) => {
    await createProduct(values, imageFiles);
    setProducts(await getProducts());
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    try {
      await deleteProduct(target.id);
      setDeleteTarget(null);
      setProducts(await getProducts());
      if (String(itemId) === String(target.id)) {
        navigateFrom(fromParam, go, { view: "items" }); // the open item is gone
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // what this user is allowed to do (the server checks too - this just hides buttons)
  const canEdit = isAdmin && can("inventory", "full");
  const canDuplicate = isAdmin && can("inventory", "create");
  const canDelete = isAdmin && can("inventory", "full");
  const canRestock = isAdmin && can("stock_bills", "create");
  const onEditItem = canEdit ? (p) => setEditingProduct(p) : undefined;
  const onDuplicateItem = canDuplicate
    ? (p) => setDuplicatingProduct(p)
    : undefined;
  const onDeleteItem = canDelete ? (p) => setDeleteTarget(p) : undefined;
  const onRestockItem = canRestock ? (p) => setRestockingProduct(p) : undefined;
  const hasAnyAction = Boolean(
    onEditItem || onDuplicateItem || onDeleteItem || onRestockItem,
  );

  // modals + right-click panel, shared by the list and the item card
  const overlays = (
    <>
      {menu && (
        <ItemContextMenu
          x={menu.x}
          y={menu.y}
          item={menu.item}
          onClose={() => setMenu(null)}
          onEdit={onEditItem}
          onDuplicate={onDuplicateItem}
          onDelete={onDeleteItem}
          onRestock={menu.item.subitems?.length ? undefined : onRestockItem}
        />
      )}
      {restockingProduct && (
        <RestockModal
          product={restockingProduct}
          onSubmit={handleRestock}
          onClose={() => setRestockingProduct(null)}
        />
      )}
      {editingProduct && (
        <ProductForm
          initialData={editingProduct}
          onSubmit={handleUpdate}
          onClose={() => setEditingProduct(null)}
        />
      )}
      {duplicatingProduct && (
        <ProductForm
          duplicateFrom={duplicatingProduct}
          onSubmit={handleCreateCopy}
          onClose={() => setDuplicatingProduct(null)}
        />
      )}
      {deleteTarget && (
        <TypedDeleteConfirm
          label={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );

  if (itemId) {
    const back = () => navigateFrom(fromParam, go, { view: "items" });
    const item = findItemById(products, itemId);
    const parentName = item?.parent_id
      ? findItemById(products, item.parent_id)?.name
      : null;
    if (item) {
      return (
        <>
          <ItemDetail
            item={item}
            parentName={parentName}
            onBack={back}
            isAdmin={isAdmin}
            onEdit={onEditItem}
            onDuplicate={onDuplicateItem}
            onDelete={onDeleteItem}
            onRestock={onRestockItem}
          />
          {overlays}
        </>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50">
        <SubHeader title="Item details" onBack={back} />
        <p className="text-gray-400 text-center py-16">
          {loading ? "Loading..." : "This item no longer exists."}
        </p>
      </div>
    );
  }

  // flat A-Z list of top-level items, each with its subitems nested underneath
  const q = search.trim().toLowerCase();
  const sortedProducts = [...products].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const shownProducts = q ? filterItemTree(sortedProducts, q) : sortedProducts;
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="items"
        onProductAdded={onProductAdded}
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-6xl flex items-start gap-6">
        <div className="flex-1 min-w-0 max-w-3xl">
          <div className="mb-5">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search items..."
            />
            {isAdmin && (
              <p className="text-xs text-gray-400 mt-1.5">
                Hold an item to add stock · right-click for more options
              </p>
            )}
          </div>

          {loading ? (
            <p className="text-gray-400 text-center py-16">Loading...</p>
          ) : error && products.length === 0 ? (
            <p className="text-red-500 text-center py-16">{error}</p>
          ) : products.length === 0 ? (
            <p className="text-gray-400 text-center py-16">No items yet.</p>
          ) : shownProducts.length === 0 ? (
            <p className="text-gray-400 text-center py-16">
              Nothing matches "{search.trim()}".
            </p>
          ) : (
            <div className="space-y-2">
              {shownProducts.map((item) => (
                <ItemRowWithSubitems
                  key={item.id}
                  item={item}
                  expanded={expandedIds.has(item.id)}
                  onToggle={() => toggleExpanded(item.id)}
                  onSelect={(id) => go({ view: "items", item: String(id) })}
                  forceOpen={Boolean(q)}
                  isAdmin={isAdmin}
                  onLongPress={(p) => setRestockingProduct(p)}
                  onContextMenuItem={
                    hasAnyAction
                      ? (p, x, y) => setMenu({ item: p, x, y })
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
        <DesktopOnly>
          <TopSoldItemsPanel />
        </DesktopOnly>
      </main>

      {overlays}
    </div>
  );
}

function ItemActionsMenu({ onEdit, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  const itemCls =
    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50";
  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Item actions"
        className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
            {onEdit && (
              <button
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className={`${itemCls} text-gray-700`}
              >
                <Pencil size={14} /> Edit
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={() => {
                  setOpen(false);
                  onDuplicate();
                }}
                className={`${itemCls} text-gray-700`}
              >
                <Copy size={14} /> Duplicate
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className={`${itemCls} text-red-600 hover:bg-red-50`}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ManageItemRow({ item, expanded, onToggle, onEdit, onDelete }) {
  const image = item.images?.find((i) => i.is_primary) || item.images?.[0];
  const hasSubitems = (item.subitems?.length ?? 0) > 0;
  return (
    <div
      onClick={hasSubitems ? onToggle : undefined}
      className={`w-full flex items-center gap-3 border rounded-xl px-3 py-2 bg-white border-gray-200 ${hasSubitems ? "cursor-pointer hover:bg-gray-50" : ""}`}
    >
      <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
        {image ? (
          <img
            src={image.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-gray-400">No image</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.name}</p>
        {hasSubitems && (
          <p className="text-xs text-blue-600 font-medium mt-0.5">
            {item.subitems.length}{" "}
            {item.subitems.length === 1 ? "subitem" : "subitems"}
          </p>
        )}
      </div>
      {hasSubitems &&
        (expanded ? (
          <ChevronDown size={18} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        ))}
      <ItemActionsMenu onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function ManageSubitemBranch({ item, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const kids = [...(item.subitems || [])].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const hasSubitems = kids.length > 0;
  const image = item.images?.find((i) => i.is_primary) || item.images?.[0];
  return (
    <div className="space-y-1.5">
      <div
        onClick={hasSubitems ? () => setOpen((o) => !o) : undefined}
        className={`w-full flex items-center gap-2 border rounded-xl pl-3 pr-3 py-2.5 bg-white border-gray-200 ${hasSubitems ? "cursor-pointer hover:bg-gray-50" : ""}`}
      >
        <CornerDownRight size={14} className="text-gray-300 shrink-0" />
        <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
          {image ? (
            <img
              src={image.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[8px] text-gray-400">No image</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {item.name}
          </p>
          {hasSubitems && (
            <p className="text-xs text-blue-600 font-medium">
              {kids.length} {kids.length === 1 ? "subitem" : "subitems"}
            </p>
          )}
        </div>
        {hasSubitems &&
          (open ? (
            <ChevronDown size={16} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-gray-400 shrink-0" />
          ))}
        <ItemActionsMenu
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      </div>
      {hasSubitems && open && (
        <div className="ml-6 space-y-1.5">
          {kids.map((k) => (
            <ManageSubitemBranch
              key={k.id}
              item={k}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ManagePage({ go, refreshToken, onProductAdded }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [deleteVendorTarget, setDeleteVendorTarget] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState(null);

  const load = async () => {
    try {
      const [productList, vendorList, accountList] = await Promise.all([
        getProducts(),
        getVendors(),
        getAccounts(),
      ]);
      setProducts(productList);
      setVendors(vendorList);
      setAccounts(accountList);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshToken]);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUpdate = async (id, updates) => {
    await updateProduct(id, updates);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this item?")) return;
    try {
      await deleteProduct(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateVendor = async (id, payload) => {
    await updateVendor(id, payload);
    await load();
  };

  const handleDeleteVendor = async () => {
    try {
      await deleteVendor(deleteVendorTarget.id);
      setDeleteVendorTarget(null);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateAccount = async (id, payload) => {
    await updateAccount(id, payload);
    await load();
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(deleteAccountTarget.id);
      setDeleteAccountTarget(null);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const sortedProducts = [...products].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const shownProducts = q
    ? sortedProducts.filter((p) => p.name.toLowerCase().includes(q))
    : sortedProducts;

  const sortedVendors = [...vendors].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const shownVendors = q
    ? sortedVendors.filter((v) => v.name.toLowerCase().includes(q))
    : sortedVendors;

  const sortedAccounts = [...accounts].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const shownAccounts = q
    ? sortedAccounts.filter((a) => a.name.toLowerCase().includes(q))
    : sortedAccounts;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={true}
        active="manage"
        onProductAdded={onProductAdded}
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search Items / Vendors / Acc..."
          />
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error && products.length === 0 ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shownProducts.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No items match.</p>
        ) : (
          <div className="space-y-2">
            {shownProducts.map((item) => {
              const sortedSubs = [...(item.subitems || [])].sort((a, b) =>
                compareNames(a.name, b.name),
              );
              return (
                <div key={item.id} className="space-y-1.5">
                  <ManageItemRow
                    item={item}
                    expanded={expandedIds.has(item.id)}
                    onToggle={() => toggleExpanded(item.id)}
                    onEdit={() => {
                      setEditingProduct(item);
                      setShowForm(true);
                    }}
                    onDelete={() => handleDelete(item.id)}
                  />
                  {sortedSubs.length > 0 && expandedIds.has(item.id) && (
                    <div className="ml-6 space-y-1.5">
                      {sortedSubs.map((sub) => (
                        <ManageSubitemBranch
                          key={sub.id}
                          item={sub}
                          onEdit={(p) => {
                            setEditingProduct(p);
                            setShowForm(true);
                          }}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {shownVendors.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Vendors
            </h2>
            <div className="space-y-2">
              {shownVendors.map((v) => (
                <div
                  key={v.id}
                  className="w-full flex items-center gap-3 border rounded-xl p-3 bg-white border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {v.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {[v.contact_person, v.phone, v.email]
                        .filter(Boolean)
                        .join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <ItemActionsMenu
                    onEdit={() => {
                      setEditingVendor(v);
                      setShowVendorForm(true);
                    }}
                    onDelete={() => setDeleteVendorTarget(v)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {shownAccounts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Accounts
            </h2>
            <div className="space-y-2">
              {shownAccounts.map((a) => (
                <div
                  key={a.id}
                  className="w-full flex items-center gap-3 border rounded-xl p-3 bg-white border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {a.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {ACCOUNT_TYPE_NAMES[a.account_type] || a.account_type}
                    </p>
                  </div>
                  <ItemActionsMenu
                    onEdit={() => {
                      setEditingAccount(a);
                      setShowAccountForm(true);
                    }}
                    onDelete={() => setDeleteAccountTarget(a)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showForm && (
        <ProductForm
          initialData={editingProduct}
          onSubmit={handleUpdate}
          onClose={() => {
            setShowForm(false);
            setEditingProduct(null);
          }}
        />
      )}

      {showVendorForm && (
        <VendorForm
          initialData={editingVendor}
          onSubmit={handleUpdateVendor}
          onClose={() => {
            setShowVendorForm(false);
            setEditingVendor(null);
          }}
        />
      )}

      {deleteVendorTarget && (
        <TypedDeleteConfirm
          label={deleteVendorTarget.name}
          onCancel={() => setDeleteVendorTarget(null)}
          onConfirm={handleDeleteVendor}
        />
      )}

      {showAccountForm && (
        <AccountForm
          initialData={editingAccount}
          onSubmit={handleUpdateAccount}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(null);
          }}
        />
      )}

      {deleteAccountTarget && (
        <TypedDeleteConfirm
          label={deleteAccountTarget.name}
          onCancel={() => setDeleteAccountTarget(null)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}

// ---------- Department home screen ----------
function DepartmentHome({
  isAdmin,
  onSelect,
  onTab,
  refreshToken,
  onProductAdded,
}) {
  const [itemCounts, setItemCounts] = useState({});
  const [pendingCounts, setPendingCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const [products, pending] = await Promise.all([
          getProducts(),
          isAdmin ? getRequests("pending") : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const items = {};
        products.forEach((p) => {
          items[p.department] = (items[p.department] || 0) + 1;
        });
        const waiting = {};
        pending.forEach((r) => {
          const d = r.product?.department;
          if (d) waiting[d] = (waiting[d] || 0) + 1;
        });
        setItemCounts(items);
        setPendingCounts(waiting);
      } catch {
        // counts are optional - the cards still work without them
      }
    };
    load();
    const interval = setInterval(load, 10000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin, refreshToken]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="home"
        onTab={onTab}
        onProductAdded={onProductAdded}
      />

      <main className="p-4 sm:p-6">
        <p className="text-sm text-gray-500 mb-4">Select a department</p>
        <div className="flex flex-col gap-4 max-w-4xl">
          {DEPARTMENTS.map((d) => {
            const count = itemCounts[d.slug] || 0;
            const waiting = pendingCounts[d.slug] || 0;
            return (
              <button
                key={d.slug}
                onClick={() => onSelect(d.slug)}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 text-left hover:shadow-md hover:border-gray-300 active:scale-[0.99] transition"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-14 h-14 shrink-0 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-1.5">
                    <img
                      src={d.logo}
                      alt=""
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="font-semibold text-gray-900 uppercase truncate">
                    {d.name}
                  </p>

                  {d.extraLogo && (
                    <>
                      <span className="text-gray-300">|</span>
                      <div className="w-14 h-14 shrink-0 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-1.5">
                        <img
                          src={d.extraLogo}
                          alt=""
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <p className="font-semibold text-gray-900 uppercase truncate">
                        {d.extraName}
                      </p>
                    </>
                  )}
                </div>

                <p className="shrink-0 text-xs text-gray-400">
                  {count} {count === 1 ? "item" : "items"}
                </p>

                {isAdmin && waiting > 0 && (
                  <span
                    title="Pending requests"
                    className="bg-red-500 text-white text-[11px] font-medium rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center"
                  >
                    {waiting}
                  </span>
                )}
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ---------- Vendors (admin only) ----------
function VendorsPage({ isAdmin, go }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));

  const load = async () => {
    try {
      setVendors(await getVendors());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this vendor?")) return;
    try {
      await deleteVendor(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const sorted = [...vendors].sort((a, b) => compareNames(a.name, b.name));

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="vendors"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex justify-end">
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Add Vendor
          </button>
        </div>
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No vendors yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{v.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[v.contact_person, v.phone, v.email]
                      .filter(Boolean)
                      .join(" · ") || "No contact details"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <VendorForm
          onClose={() => setFormOpen(false)}
          onSubmit={async (payload) => {
            await createVendor(payload);
            await load();
          }}
        />
      )}
    </div>
  );
}

function VendorForm({ initialData, onClose, onSubmit }) {
  const isEditMode = Boolean(initialData);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    contact_person: initialData?.contact_person || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEditMode) {
        await onSubmit(initialData.id, form);
      } else {
        await onSubmit(form);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {isEditMode ? "Edit Vendor" : "Add Vendor"}
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Vendor name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Contact person"
            value={form.contact_person}
            onChange={(e) => handleChange("contact_person", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <textarea
            placeholder="Address"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Taxes (admin only) ----------
const formatRate = (r) =>
  `${Number(r || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}%`;

function TaxesPage({ isAdmin, go }) {
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  useQuickNew(() => {
    setEditing(null);
    setFormOpen(true);
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      setTaxes(await getTaxes());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    try {
      await deleteTax(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="taxes"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <p className="flex-1 text-sm text-gray-500">
            Tax rates you can add to invoice and bill lines. The default one is
            pre-selected on new lines.
          </p>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + New Tax
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : taxes.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            No taxes yet. Add one, for example VAT 18%.
          </p>
        ) : (
          <div className="space-y-2">
            {taxes.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{t.name}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    {t.is_default && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Default
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-gray-900 shrink-0">
                  {formatRate(t.rate)}
                </p>
                <ItemActionsMenu
                  onEdit={() => {
                    setEditing(t);
                    setFormOpen(true);
                  }}
                  onDelete={() => setDeleteTarget(t)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <TaxForm
          initialData={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (id, payload) => {
            if (id) await updateTax(id, payload);
            else await createTax(payload);
            await load();
          }}
        />
      )}

      {deleteTarget && (
        <TypedDeleteConfirm
          label={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function TaxForm({ initialData, onClose, onSubmit }) {
  const isEditMode = Boolean(initialData);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    rate: initialData ? String(initialData.rate) : "",
    is_active: initialData?.is_active ?? true,
    is_default: initialData?.is_default ?? false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const rateOk =
    form.rate !== "" && Number(form.rate) >= 0 && Number(form.rate) <= 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(isEditMode ? initialData.id : null, {
        name: form.name.trim(),
        rate: Number(form.rate),
        is_active: form.is_active,
        is_default: form.is_active && form.is_default,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">
          {isEditMode ? "Edit Tax" : "New Tax"}
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Tax name * (e.g. VAT)"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={cls}
          />
          <label className="text-xs text-gray-500 block">
            Rate (%) *
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.001"
              value={form.rate}
              onChange={(e) => set("rate", e.target.value)}
              className={cls + " mt-1"}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            Active
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${form.is_active ? "" : "text-gray-400"}`}
          >
            <input
              type="checkbox"
              disabled={!form.is_active}
              checked={form.is_active && form.is_default}
              onChange={(e) => set("is_default", e.target.checked)}
            />
            Make this the default tax
          </label>
          <p className="text-xs text-gray-400">
            Changing a rate later never changes invoices that already used it.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.name.trim() || !rateOk}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Tax"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Step 9: Reports (admin only): Profit & Loss, Balance Sheet, Receivables / Payables Ageing ----------
const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const REPORT_TABS = [
  ["daily", "Daily Sales & Collection"],
  ["pl", "Profit & Loss"],
  ["sales", "Sales Summary"],
  ["bs", "Balance Sheet"],
  ["ar", "Receivables Ageing"],
  ["ap", "Payables Ageing"],
  ["graphs", "Graphs"],
];

function ReportsPage({ isAdmin, go }) {
  const [report, setReport] = useState("daily");
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="reports"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />
      <main className="p-4 sm:p-6 w-full max-w-5xl">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Reports</h1>
        <div className="flex flex-wrap gap-2 mb-5">
          {REPORT_TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setReport(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                report === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {report === "daily" && <DailySalesReport />}
        {report === "pl" && <ProfitLossReport />}
        {report === "sales" && <SalesSummaryReport />}
        {report === "bs" && <BalanceSheetReport />}
        {report === "ar" && <AgeingReport key="ar" kind="receivables" />}
        {report === "ap" && <AgeingReport key="ap" kind="payables" />}
        {report === "graphs" && <SalesGraphsReport />}
      </main>
    </div>
  );
}

// loads a report whenever its inputs change; ignores answers that arrive after the inputs changed again
function useReport(fetcher, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps);
  return { data, loading, error };
}

function ReportBody({ loading, error, data, children }) {
  if (loading && !data)
    return <p className="text-gray-400 text-center py-16">Loading...</p>;
  if (error) return <p className="text-red-500 text-center py-16">{error}</p>;
  if (!data) return null;
  return children;
}

function ReportLine({ label, amount, bold = false, indent = false, tone }) {
  const color =
    tone === "good"
      ? "text-green-700"
      : tone === "bad"
        ? "text-red-600"
        : "text-gray-900";
  return (
    <div
      className={`flex justify-between gap-3 py-1.5 text-sm ${indent ? "pl-4" : ""} ${bold ? "font-semibold" : ""}`}
    >
      <span className={bold ? "text-gray-900" : "text-gray-600"}>{label}</span>
      <span className={`shrink-0 ${bold ? color : "text-gray-900"}`}>
        {formatRs(amount)}
      </span>
    </div>
  );
}

function ReportCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      {title && (
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

const dateInputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1";

// ---------- Profit & Loss (QuickBooks style) ----------
// columns: total / compare previous period or year / by day, week, month, quarter, year
// click an account -> its entries grouped by day -> click an invoice (or bill / journal) -> full details
const isoToDate = (iso) => new Date(`${iso}T00:00:00`);
const addDays = (iso, n) => {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + n);
  return localIso(d);
};
// previous period = same number of days, ending the day before "from"
function previousPeriod(from, to) {
  const len = Math.round((isoToDate(to) - isoToDate(from)) / 86400000) + 1;
  const prevTo = addDays(from, -1);
  return [addDays(prevTo, -(len - 1)), prevTo];
}
const shiftYear = (iso, n) => {
  const d = isoToDate(iso);
  d.setFullYear(d.getFullYear() + n);
  return localIso(d);
};

// ----- API -----
const getPLColumns = (from, to, groupBy, customerId, showZero) =>
  reportRequest(
    `profit-and-loss/columns?date_from=${from}&date_to=${to}&group_by=${groupBy}&show_zero=${showZero}${customerId ? `&customer_id=${customerId}` : ""}`,
    "Failed to load Profit & Loss",
  );
const getPLTransactions = (accountId, from, to, own, customerId) =>
  reportRequest(
    `profit-and-loss/transactions?account_id=${accountId}&date_from=${from}&date_to=${to}&include_children=${!own}${customerId ? `&customer_id=${customerId}` : ""}`,
    "Failed to load transactions",
  );
const getPLJournal = (journalId) =>
  reportRequest(`journal/${journalId}`, "Failed to load the transaction");

// ----- number formatting -----
const PL_DECIMALS = 2; // set to 0 to show whole rupees
const plNum = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) < 0.005) return "-";
  const s = Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: PL_DECIMALS,
    maximumFractionDigits: PL_DECIMALS,
  });
  return v < 0 ? `(${s})` : s;
};
const plPct = (cur, prev) => {
  if (!prev) return cur ? "-" : "0.0%";
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  return p < 0 ? `(${Math.abs(p).toFixed(1)}%)` : `${p.toFixed(1)}%`;
};
// "% of Income" column
const plShare = (value, income) => {
  if (!income || !value) return "-";
  const p = (value / income) * 100;
  return p < 0 ? `(${Math.abs(p).toFixed(1)}%)` : `${p.toFixed(1)}%`;
};

// Turn flat accounts into display lines: parent header, children, "Total <parent>".
// Each item has v (rolled-up numbers, one per value column) and vOwn (the account's own postings).
// Every row carries `anc` = ids of the parent accounts it sits inside (used to collapse a parent).
function planPLRows(items, sortMode, sortIdx) {
  const ids = new Set(items.map((i) => i.id));
  const kids = new Map();
  const roots = [];
  const cmp =
    sortMode === "amount"
      ? (a, b) =>
          (b.v[sortIdx] || 0) - (a.v[sortIdx] || 0) ||
          compareNames(a.name, b.name)
      : (a, b) => compareNames(a.name, b.name);
  [...items].sort(cmp).forEach((i) => {
    if (i.parent_id && ids.has(i.parent_id)) {
      if (!kids.has(i.parent_id)) kids.set(i.parent_id, []);
      kids.get(i.parent_id).push(i);
    } else {
      roots.push(i);
    }
  });

  const out = [];
  const walk = (r, depth, anc) => {
    const ch = kids.get(r.id);
    if (!ch) {
      out.push({
        key: `r-${r.id}`,
        accountId: r.id,
        label: r.name,
        v: r.v,
        depth,
        kind: "item",
        anc,
      });
      return;
    }
    const inner = [...anc, r.id];
    out.push({
      key: `h-${r.id}`,
      id: r.id,
      label: r.name,
      v: r.v,
      depth,
      kind: "header",
      anc,
    });
    if (r.vOwn.some((x) => Math.abs(x) >= 0.005)) {
      out.push({
        key: `o-${r.id}`,
        accountId: r.id,
        own: true, // drill-down shows only this account's own postings
        label: `${r.name} (direct)`,
        v: r.vOwn,
        depth: depth + 1,
        kind: "item",
        anc: inner,
      });
    }
    ch.forEach((c) => walk(c, depth + 1, inner));
    out.push({
      key: `t-${r.id}`,
      id: r.id,
      label: `Total ${r.name}`,
      v: r.v,
      depth,
      kind: "subtotal",
      anc,
    });
  };
  roots.forEach((r) => walk(r, 0, []));
  return out;
}

// value columns: which API result (s) and which of its columns (c) feed each number; all = the Total column
function plValueColumns(view, res, from, to) {
  if (view === "prev" || view === "prevYear")
    return [
      {
        label: "Current Period",
        s: 0,
        c: 0,
        from: res.ranges[0][0],
        to: res.ranges[0][1],
      },
      {
        label: view === "prev" ? "Previous Period" : "Previous Year",
        s: 1,
        c: 0,
        from: res.ranges[1][0],
        to: res.ranges[1][1],
      },
    ];
  if (view === "total") return [{ label: "Total", s: 0, c: 0, from, to }];
  const cols = res.src[0].columns.map((c, i) => ({
    label: c.label,
    s: 0,
    c: i,
    from: c.from,
    to: c.to,
  }));
  return [...cols, { label: "Total", s: 0, all: true, from, to }];
}

// every line of the statement in order (bands, accounts, totals) - used by the screen AND the CSV export
function buildPLLines(res, vcs, sortMode) {
  const { src } = res;
  const pick = (arr, sum, vc) => (vc.all ? sum : (arr?.[vc.c] ?? 0));
  const secOf = (s, key) =>
    src[s].sections.find((x) => x.key === key) || {
      accounts: [],
      totals: [],
      sum: 0,
    };
  const secTotal = (key) =>
    vcs.map((vc) => pick(secOf(vc.s, key).totals, secOf(vc.s, key).sum, vc));
  const summary = (name) =>
    vcs.map((vc) => pick(src[vc.s][name].cols, src[vc.s][name].sum, vc));
  const sortIdx =
    vcs.length > 2 || (vcs.length === 2 && vcs[1].all) ? vcs.length - 1 : 0;

  const lines = [];
  const section = (title, key, totalLabel, always) => {
    const maps = src.map(
      (r) =>
        new Map(
          r.sections.find((x) => x.key === key).accounts.map((a) => [a.id, a]),
        ),
    );
    const ids = new Set();
    maps.forEach((m) => m.forEach((_a, id) => ids.add(id)));
    const items = [...ids].map((id) => {
      const first = maps.map((m) => m.get(id)).find(Boolean);
      const val = (vc, field, sumField) => {
        const a = maps[vc.s].get(id);
        return a ? (vc.all ? a[sumField] : (a[field][vc.c] ?? 0)) : 0;
      };
      return {
        id,
        name: first.name,
        parent_id: first.parent_id ?? null,
        v: vcs.map((vc) => val(vc, "total", "sum")),
        vOwn: vcs.map((vc) => val(vc, "own", "own_sum")),
      };
    });
    const total = secTotal(key);
    if (
      !always &&
      items.length === 0 &&
      total.every((x) => Math.abs(x) < 0.005)
    )
      return false;
    const secKey = `sec:${key}`;
    lines.push({ kind: "band", key: secKey, secKey, label: title, v: total });
    planPLRows(items, sortMode, sortIdx).forEach((r) =>
      lines.push({ ...r, key: `${key}-${r.key}`, secKey }),
    );
    lines.push({
      kind: "total",
      key: `${key}-total`,
      label: totalLabel,
      v: total,
    });
    return true;
  };

  section("Income", "income", "Total Income", true);
  section("Cost of Goods Sold", "cogs", "Total COGS", true);
  lines.push({
    kind: "total",
    key: "gross",
    label: "Gross Profit",
    v: summary("gross"),
  });
  section("Expense", "expense", "Total Expense", true);
  lines.push({
    kind: "total",
    key: "operating",
    label: "Net Operating Income",
    v: summary("operating"),
  });
  const a = section(
    "Other Income",
    "other_income",
    "Total Other Income",
    false,
  );
  const b = section(
    "Other Expense",
    "other_expense",
    "Total Other Expense",
    false,
  );
  if (a || b)
    lines.push({
      kind: "total",
      key: "other-net",
      label: "Net Other Income",
      v: summary("other_net"),
    });
  lines.push({
    kind: "grand",
    key: "net",
    label: "Net Income",
    v: summary("net"),
  });
  return {
    lines,
    income: secTotal("income"),
    gross: summary("gross"),
    net: summary("net"),
    sortIdx,
  };
}

const PL_NAVY = "bg-[#0a2a5e] text-[#fff]";
const PL_BAND = "bg-[#dbe8fb] text-[#0a2a5e]";
const PL_NUM = "px-3 py-1.5 text-sm text-right whitespace-nowrap tabular-nums";

// the number cells of one line. dcols = what columns the table shows (val / var / varpct / pct)
function PLCells({ v, dcols, incomeV, onCell }) {
  return dcols.map((dc, k) => {
    let txt;
    if (dc.t === "val") txt = plNum(v[dc.i]);
    else if (dc.t === "var") txt = plNum((v[0] || 0) - (v[1] || 0));
    else if (dc.t === "varpct") txt = plPct(v[0] || 0, v[1] || 0);
    else txt = plShare(v[dc.i], incomeV[dc.i]);
    const clickable =
      onCell && dc.t === "val" && Math.abs(v[dc.i] || 0) >= 0.005;
    return (
      <td key={k} className={PL_NUM}>
        {clickable ? (
          <button
            type="button"
            onClick={() => onCell(dc.i)}
            title="Show the entries behind this number"
            className="hover:underline hover:text-blue-700 print:no-underline"
          >
            {txt}
          </button>
        ) : (
          txt
        )}
      </td>
    );
  });
}

// kind = item | header | subtotal | total | grand.  toggle/open = chevron (items: show entries, headers: collapse)
function PLRow({ line, dcols, incomeV, toggle, open = false, onCell }) {
  const { kind, label, depth = 0, v } = line;
  const Chev = open ? ChevronDown : ChevronRight;
  const labelNode = toggle ? (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1 text-left hover:underline print:no-underline"
    >
      <Chev size={14} className="shrink-0 print:hidden" />
      {label}
    </button>
  ) : (
    label
  );

  if (kind === "header") {
    return (
      <tr className="text-[#0f172a] font-semibold border-b border-[#eef2fa]">
        <td
          className="px-3 py-1.5 text-sm"
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          {labelNode}
        </td>
        {open ? (
          <td colSpan={dcols.length} />
        ) : (
          <PLCells v={v} dcols={dcols} incomeV={incomeV} />
        )}
      </tr>
    );
  }

  const rowCls =
    kind === "grand"
      ? `${PL_NAVY} font-bold`
      : kind === "total"
        ? `${PL_BAND} font-bold`
        : kind === "subtotal"
          ? "border-y border-[#dbe4f3] font-semibold text-[#0f172a]"
          : "border-b border-[#dbe4f3] text-[#0f172a]";
  const pad =
    kind === "item"
      ? { paddingLeft: 24 + depth * 20 }
      : kind === "subtotal"
        ? { paddingLeft: 12 + depth * 20 }
        : undefined;

  return (
    <tr className={rowCls}>
      <td className="px-3 py-1.5 text-sm" style={pad}>
        {labelNode}
      </td>
      <PLCells v={v} dcols={dcols} incomeV={incomeV} onCell={onCell} />
    </tr>
  );
}

// grey section band ("Income", "Cost of Goods Sold"...). Collapsed -> shows the section total on the band.
function PLBand({ line, dcols, incomeV, toggle, open }) {
  const Chev = open ? ChevronDown : ChevronRight;
  return (
    <tr className={PL_BAND}>
      <td className="px-3 py-1.5 text-sm font-bold">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 text-left"
        >
          <Chev size={14} className="shrink-0 print:hidden" />
          {line.label}
        </button>
      </td>
      {open ? (
        <td colSpan={dcols.length} />
      ) : (
        <PLCells v={line.v} dcols={dcols} incomeV={incomeV} />
      )}
    </tr>
  );
}

// the dropdown under an account: its entries for the chosen period, grouped by day. Click one to open it.
function PLTransactions({
  accountId,
  own,
  from,
  to,
  customerId,
  span,
  onOpen,
}) {
  const { data, loading, error } = useReport(
    () => getPLTransactions(accountId, from, to, own, customerId),
    [accountId, own, from, to, customerId],
  );
  const wrap = (content) => (
    <tr className="bg-[#f6f9ff]">
      <td
        colSpan={span}
        className="py-2 text-xs text-[#64748b]"
        style={{ paddingLeft: 44 }}
      >
        {content}
      </td>
    </tr>
  );
  if (loading && !data) return wrap("Loading transactions...");
  if (error) return wrap(<span className="text-red-500">{error}</span>);
  if (!data || data.rows.length === 0)
    return wrap("No transactions in this period.");

  const days = [];
  data.rows.forEach((r) => {
    let d = days[days.length - 1];
    if (!d || d.date !== r.date) {
      d = { date: r.date, total: 0, rows: [] };
      days.push(d);
    }
    d.rows.push(r);
    d.total = Math.round((d.total + r.amount) * 100) / 100;
  });

  return (
    <tr className="bg-[#f6f9ff]">
      <td colSpan={span} className="py-2 pr-3" style={{ paddingLeft: 36 }}>
        <div className="rounded-lg border border-[#dbe4f3] bg-white overflow-hidden text-xs text-[#334155]">
          {days.map((d) => (
            <div key={d.date}>
              <div className="flex justify-between gap-3 px-3 py-1 bg-[#eaf1fd] font-semibold text-[#0f172a]">
                <span>
                  {formatJournalDate(d.date)}
                  <span className="font-normal text-[#64748b]">
                    {" "}
                    · {d.rows.length}{" "}
                    {d.rows.length === 1 ? "entry" : "entries"}
                  </span>
                </span>
                <span className="tabular-nums">{plNum(d.total)}</span>
              </div>
              {d.rows.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between gap-3 px-3 py-1 border-t border-[#eef2fa] hover:bg-[#f6f9ff]"
                >
                  <span className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      title="Open this transaction"
                      className="font-medium text-blue-700 underline print:no-underline"
                    >
                      {r.type} {r.number}
                    </button>
                    {r.name ? ` · ${r.name}` : ""}
                    {!own && r.account && r.account !== data.account.name
                      ? ` · ${r.account}`
                      : ""}
                    {r.memo && (
                      <span className="text-[#94a3b8]"> - {r.memo}</span>
                    )}
                  </span>
                  <span className="tabular-nums shrink-0">
                    {plNum(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between gap-3 px-3 py-1 border-t border-[#dbe4f3] font-semibold text-[#0f172a]">
            <span>Total</span>
            <span className="tabular-nums">{plNum(data.total)}</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// full details of one transaction: the invoice / bill itself + the accounting entries it posted
function PLTransactionModal({ tx, onClose }) {
  const [journal, setJournal] = useState(null);
  const [doc, setDoc] = useState(null); // the invoice or purchase bill
  const [error, setError] = useState(null);
  const [pdfFor, setPdfFor] = useState(null);

  useEffect(() => {
    let off = false;
    getPLJournal(tx.journal_id)
      .then((j) => !off && setJournal(j))
      .catch((e) => !off && setError(e.message));
    const loadDoc =
      tx.source_type === "invoice"
        ? invoiceRequest(
            String(tx.source_id),
            "GET",
            null,
            "Failed to load the invoice",
          )
        : tx.source_type === "purchase_bill"
          ? purchaseBillRequest(
              String(tx.source_id),
              "GET",
              null,
              "Failed to load the bill",
            )
          : null;
    loadDoc?.then((d) => !off && setDoc(d)).catch(() => {});
    return () => {
      off = true;
    };
  }, [tx.journal_id]);

  const isInvoice = tx.source_type === "invoice" && doc;
  const isBill = tx.source_type === "purchase_bill" && doc;
  const st = isInvoice ? invoiceStatus(doc) : null;
  const th = "py-1.5 text-xs font-semibold text-gray-500";
  const row = (k, val) =>
    val ? (
      <div className="flex justify-between gap-3 py-0.5">
        <span className="text-gray-500">{k}</span>
        <span className="text-gray-900 text-right">{val}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 truncate">
            {tx.type} {tx.number}
            {tx.name && (
              <span className="text-gray-400 font-normal"> · {tx.name}</span>
            )}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {isInvoice && (
              <button
                type="button"
                onClick={() => setPdfFor(doc)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                View PDF
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-5 text-sm">
          {error && <p className="text-red-500">{error}</p>}
          {!journal && !error && (
            <p className="text-gray-400 text-center py-10">Loading...</p>
          )}

          {(isInvoice || isBill) && (
            <section>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {isInvoice ? "Invoice" : "Bill"} details
                </h4>
                {st && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                  >
                    {st.label}
                  </span>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8">
                {isInvoice ? (
                  <>
                    {row("Customer", doc.customer_name)}
                    {row("Invoice date", formatJournalDate(doc.invoice_date))}
                    {row("Due date", formatJournalDate(doc.due_date))}
                    {row("PO / order no.", doc.order_number)}
                  </>
                ) : (
                  <>
                    {row("Vendor", doc.vendor_name)}
                    {row("Vendor invoice no.", doc.vendor_ref)}
                    {row("Bill date", formatJournalDate(doc.bill_date))}
                    {row("Due date", formatJournalDate(doc.due_date))}
                  </>
                )}
              </div>
              {doc.notes && (
                <p className="text-xs text-gray-500 mt-2">Notes: {doc.notes}</p>
              )}

              <table className="w-full mt-3">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className={th}>Item</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={`${th} text-right`}>Rate</th>
                    <th className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(doc.items || []).map((l) => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-2">
                        {l.description || l.item_name}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {l.quantity}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatRs(l.rate)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatRs(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 ml-auto max-w-xs">
                {isInvoice && row("Subtotal", formatRs(doc.subtotal))}
                {isInvoice &&
                  doc.discount_amount > 0 &&
                  row("Discount", `- ${formatRs(doc.discount_amount)}`)}
                <div className="flex justify-between gap-3 py-0.5 font-semibold">
                  <span>Total</span>
                  <span>{formatRs(doc.total)}</span>
                </div>
                {row("Paid", formatRs(doc.amount_paid))}
                <div className="flex justify-between gap-3 py-0.5 font-semibold">
                  <span>Balance due</span>
                  <span>{formatRs(doc.balance_due)}</span>
                </div>
              </div>
            </section>
          )}

          {journal && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Accounting entries · {formatJournalDate(journal.date)}
              </h4>
              {!isInvoice &&
                !isBill &&
                (journal.reference || journal.notes) && (
                  <p className="text-xs text-gray-500 mb-2">
                    {[journal.reference, journal.notes]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className={th}>Account</th>
                    <th className={th}>Description</th>
                    <th className={`${th} text-right`}>Debit</th>
                    <th className={`${th} text-right`}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 pr-2">{l.account}</td>
                      <td className="py-1.5 pr-2 text-gray-500">
                        {l.description}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {l.debit ? formatRs(l.debit) : ""}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {l.credit ? formatRs(l.credit) : ""}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1.5" colSpan={2}>
                      Total
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatRs(journal.total_debit)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatRs(journal.total_credit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
      {pdfFor && (
        <InvoicePreviewModal invoice={pdfFor} onClose={() => setPdfFor(null)} />
      )}
    </div>
  );
}

const PL_PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["lastMonth", "Last Month"],
  ["quarter", "This Quarter"],
  ["lastQuarter", "Last Quarter"],
  ["year", "This Year (to date)"],
  ["lastYear", "Last Year"],
  ["last30", "Last 30 Days"],
  ["last12", "Last 12 Months"],
  ["custom", "Custom"],
];
function plPresetRange(key) {
  const n = new Date();
  const y = n.getFullYear();
  const m = n.getMonth();
  const q = Math.floor(m / 3) * 3;
  const today = localIso(n);
  if (key === "today") return [today, today];
  if (key === "yesterday") return [addDays(today, -1), addDays(today, -1)];
  if (key === "week") {
    const mon = addDays(today, -((n.getDay() + 6) % 7)); // weeks run Monday - Sunday
    return [mon, addDays(mon, 6)];
  }
  if (key === "month")
    return [localIso(new Date(y, m, 1)), localIso(new Date(y, m + 1, 0))];
  if (key === "lastMonth")
    return [localIso(new Date(y, m - 1, 1)), localIso(new Date(y, m, 0))];
  if (key === "quarter")
    return [localIso(new Date(y, q, 1)), localIso(new Date(y, q + 3, 0))];
  if (key === "lastQuarter")
    return [localIso(new Date(y, q - 3, 1)), localIso(new Date(y, q, 0))];
  if (key === "lastYear") return [`${y - 1}-01-01`, `${y - 1}-12-31`];
  if (key === "last30") return [addDays(today, -29), today];
  if (key === "last12") return [addDays(shiftYear(today, -1), 1), today];
  return [`${y}-01-01`, today]; // year to date
}

const PL_VIEWS = [
  ["total", "Total only"],
  ["prev", "Compare: previous period"],
  ["prevYear", "Compare: previous year"],
  ["day", "Columns: by day"],
  ["week", "Columns: by week"],
  ["month", "Columns: by month"],
  ["quarter", "Columns: by quarter"],
  ["year", "Columns: by year"],
];

function ProfitLossReport() {
  const [preset, setPreset] = useState("year");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(localIso());
  const [view, setView] = useState("prev"); // see PL_VIEWS
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [showZero, setShowZero] = useState(false);
  const [showPct, setShowPct] = useState(false); // "% of Income" column
  const [sortMode, setSortMode] = useState("name");
  const [tick, setTick] = useState(0); // Refresh button
  const [collapsed, setCollapsed] = useState(() => new Set()); // "sec:income" / "acc:12"
  const [openRows, setOpenRows] = useState(() => new Map()); // line key -> value column whose entries are showing
  const [txOpen, setTxOpen] = useState(null); // the transaction whose details are open

  useEffect(() => {
    getCustomers()
      .then((c) =>
        setCustomers(
          [...c].sort((a, b) => compareNames(a.display_name, b.display_name)),
        ),
      )
      .catch(() => {});
  }, []);

  const { data, loading, error } = useReport(async () => {
    const cust = customerId || null;
    if (view === "prev" || view === "prevYear") {
      const prevRange =
        view === "prev"
          ? previousPeriod(from, to)
          : [shiftYear(from, -1), shiftYear(to, -1)];
      const [cur, prev] = await Promise.all([
        getPLColumns(from, to, "total", cust, showZero),
        getPLColumns(prevRange[0], prevRange[1], "total", cust, showZero),
      ]);
      return { src: [cur, prev], ranges: [[from, to], prevRange] };
    }
    const cur = await getPLColumns(from, to, view, cust, showZero);
    return { src: [cur], ranges: [[from, to]] };
  }, [from, to, view, customerId, showZero, tick]);

  const vcs = data ? plValueColumns(view, data, from, to) : [];
  const built = data ? buildPLLines(data, vcs, sortMode) : null;
  const multi = view !== "total" && view !== "prev" && view !== "prevYear"; // columns by period

  // what the table shows, left to right
  const dcols = [];
  if (data) {
    vcs.forEach((vc, i) => dcols.push({ t: "val", i, label: vc.label, vc }));
    if (view === "prev" || view === "prevYear") {
      dcols.push(
        { t: "var", label: "Variance" },
        { t: "varpct", label: "Variance %" },
      );
    }
    if (showPct)
      dcols.push({ t: "pct", i: built.sortIdx, label: "% of Income" });
  }
  const span = dcols.length + 1;
  const whole = multi ? vcs.length - 1 : 0; // the value column that covers the whole report period

  const flip = (setter, key) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const toggleRow = (key, col) =>
    setOpenRows((prev) => {
      const next = new Map(prev);
      next.get(key) === col ? next.delete(key) : next.set(key, col);
      return next;
    });

  const pickPreset = (key) => {
    setPreset(key);
    if (key !== "custom") {
      const [f, t] = plPresetRange(key);
      setFrom(f);
      setTo(t);
      setOpenRows(new Map());
    }
  };
  const collapseAll = () => {
    const all = new Set();
    built?.lines.forEach((l) => {
      if (l.kind === "band") all.add(l.secKey);
      if (l.kind === "header") all.add(`acc:${l.id}`);
    });
    setCollapsed(all);
    setOpenRows(new Map());
  };

  const exportCsv = () => {
    if (!built) return;
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const cell = (l, dc) =>
      dc.t === "val"
        ? (l.v[dc.i] || 0).toFixed(2)
        : dc.t === "var"
          ? ((l.v[0] || 0) - (l.v[1] || 0)).toFixed(2)
          : dc.t === "varpct"
            ? plPct(l.v[0] || 0, l.v[1] || 0)
            : plShare(l.v[dc.i], built.income[dc.i]);
    const rows = [
      ["Profit & Loss"],
      [`${from} to ${to}`],
      [],
      ["", ...dcols.map((d) => d.label)],
      ...built.lines
        .filter((l) => l.kind !== "header")
        .map((l) => [
          `${"   ".repeat(l.depth || 0)}${l.label}`,
          ...dcols.map((dc) => cell(l, dc)),
        ]),
    ];
    const blob = new Blob(
      ["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n")],
      {
        type: "text/csv;charset=utf-8",
      },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `profit-and-loss_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const btn =
    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
  const sel =
    "border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 bg-white";
  const lastIdx = built ? built.sortIdx : 0;
  const margin = (n, d) =>
    d ? `${((n / d) * 100).toFixed(1)}% of income` : "";

  const renderLine = (l) => {
    if (l.kind === "band") {
      return (
        <PLBand
          key={l.key}
          line={l}
          dcols={dcols}
          incomeV={built.income}
          open={!collapsed.has(l.secKey)}
          toggle={() => flip(setCollapsed, l.secKey)}
        />
      );
    }
    if (l.secKey && collapsed.has(l.secKey)) return null;
    if ((l.anc || []).some((id) => collapsed.has(`acc:${id}`))) return null;
    if (l.kind === "subtotal" && collapsed.has(`acc:${l.id}`)) return null;

    if (l.kind === "header") {
      return (
        <PLRow
          key={l.key}
          line={l}
          dcols={dcols}
          incomeV={built.income}
          open={!collapsed.has(`acc:${l.id}`)}
          toggle={() => flip(setCollapsed, `acc:${l.id}`)}
        />
      );
    }
    if (l.kind === "item") {
      const col = openRows.get(l.key);
      const isOpen = col !== undefined;
      const vc = vcs[isOpen ? col : whole];
      return (
        <Fragment key={l.key}>
          <PLRow
            line={l}
            dcols={dcols}
            incomeV={built.income}
            open={isOpen}
            toggle={() => toggleRow(l.key, whole)}
            onCell={(i) => toggleRow(l.key, i)}
          />
          {isOpen && (
            <PLTransactions
              accountId={l.accountId}
              own={Boolean(l.own)}
              from={vc.from}
              to={vc.to}
              customerId={customerId}
              span={span}
              onOpen={setTxOpen}
            />
          )}
        </Fragment>
      );
    }
    return <PLRow key={l.key} line={l} dcols={dcols} incomeV={built.income} />;
  };

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-3 print:hidden">
        <label className="text-xs text-gray-500">
          Report period
          <select
            value={preset}
            onChange={(e) => pickPreset(e.target.value)}
            className={`${sel} block`}
          >
            {PL_PRESETS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              if (!e.target.value) return;
              setFrom(e.target.value);
              setPreset("custom");
              setOpenRows(new Map());
            }}
            className={`${sel} block`}
          />
        </label>
        <label className="text-xs text-gray-500">
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              if (!e.target.value) return;
              setTo(e.target.value);
              setPreset("custom");
              setOpenRows(new Map());
            }}
            className={`${sel} block`}
          />
        </label>
        <label className="text-xs text-gray-500">
          Columns
          <select
            value={view}
            onChange={(e) => {
              setView(e.target.value);
              setOpenRows(new Map());
            }}
            className={`${sel} block`}
          >
            {PL_VIEWS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Customer
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setOpenRows(new Map());
            }}
            className={`${sel} block max-w-[200px]`}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Sort rows
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className={`${sel} block`}
          >
            <option value="name">Account name</option>
            <option value="amount">Highest amount</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showPct}
            onChange={(e) => setShowPct(e.target.checked)}
          />
          % of Income
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showZero}
            onChange={(e) => setShowZero(e.target.checked)}
          />
          Show zero accounts
        </label>
        <div className="flex flex-wrap gap-2 ml-auto">
          <button onClick={() => setCollapsed(new Set())} className={btn}>
            Expand all
          </button>
          <button onClick={collapseAll} className={btn}>
            Collapse all
          </button>
          <button onClick={() => setTick((t) => t + 1)} className={btn}>
            Refresh
          </button>
          <button onClick={exportCsv} disabled={!built} className={btn}>
            Export CSV
          </button>
          <button onClick={() => window.print()} className={btn}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {customerId && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 print:hidden">
          Customer filter: only that customer's invoices and credit notes are
          included. Bills, manual journals and other postings are left out.
        </p>
      )}

      <ReportBody loading={loading} error={error} data={data}>
        {built && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 print:hidden">
              {[
                ["Income", built.income[lastIdx], ""],
                [
                  "Gross profit",
                  built.gross[lastIdx],
                  margin(built.gross[lastIdx], built.income[lastIdx]),
                ],
                [
                  "Net income",
                  built.net[lastIdx],
                  margin(built.net[lastIdx], built.income[lastIdx]),
                ],
                [
                  "Total expenses",
                  built.income[lastIdx] - built.net[lastIdx],
                  margin(
                    built.income[lastIdx] - built.net[lastIdx],
                    built.income[lastIdx],
                  ),
                ],
              ].map(([label, value, sub]) => (
                <div
                  key={label}
                  className="bg-white border border-gray-200 rounded-xl p-3"
                >
                  <p className="text-xs text-gray-400">{label}</p>
                  <p
                    className={`text-lg font-bold mt-0.5 ${value < 0 ? "text-red-600" : "text-gray-900"}`}
                  >
                    {formatRs(value)}
                  </p>
                  {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
                </div>
              ))}
            </div>

            <div className="pl-statement bg-[#fff] text-[#0f172a] rounded-xl border border-[#dbe4f3] p-4">
              <div className="text-center mb-3">
                <h2 className="text-xl font-bold">Profit &amp; Loss</h2>
                <p className="text-sm font-semibold text-[#334155]">
                  {formatJournalDate(from)} – {formatJournalDate(to)}
                </p>
                {(view === "prev" || view === "prevYear") && (
                  <p className="text-xs text-[#64748b]">
                    compared with {formatJournalDate(data.ranges[1][0])} to{" "}
                    {formatJournalDate(data.ranges[1][1])}
                  </p>
                )}
                {customerId && (
                  <p className="text-xs text-[#64748b]">
                    Customer:{" "}
                    {
                      customers.find((c) => String(c.id) === String(customerId))
                        ?.display_name
                    }
                  </p>
                )}
              </div>
              <p className="text-xs text-[#64748b] mb-2 print:hidden">
                Click an account to see its daily entries
                {multi ? " (or click a number for that column)" : ""}, then
                click an invoice to open it.
              </p>
              <div className="overflow-x-auto">
                <table
                  className={`w-full border-collapse ${multi ? "min-w-max" : "min-w-[560px]"}`}
                >
                  <thead>
                    <tr className={PL_NAVY}>
                      <th className="px-3 py-2.5 text-left text-sm font-semibold rounded-tl-lg">
                        Particulars
                      </th>
                      {dcols.map((dc, k) => (
                        <th
                          key={k}
                          className={`px-3 py-2.5 text-right text-sm font-semibold whitespace-nowrap ${
                            k === dcols.length - 1 ? "rounded-tr-lg" : ""
                          }`}
                        >
                          {dc.label}
                          {!multi && dc.t !== "varpct" && dc.t !== "pct" && (
                            <>
                              <br />
                              (Rs.)
                            </>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {built.lines.map((l, i) =>
                      l.kind === "grand" ? (
                        <Fragment key={l.key}>
                          <tr>
                            <td colSpan={span} className="h-2" />
                          </tr>
                          {renderLine(l)}
                        </Fragment>
                      ) : (
                        renderLine(l)
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#64748b] mt-3">
                Accrual basis · {new Date().toLocaleString()}
              </p>
            </div>
          </>
        )}
      </ReportBody>

      {txOpen && (
        <PLTransactionModal tx={txOpen} onClose={() => setTxOpen(null)} />
      )}
    </>
  );
}

// =====================================================================================================
// Date range filter (Today / Yesterday / Last 7 days / This month / This year / Custom + From / To + Done)
// =====================================================================================================
const DATE_PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 days"],
  ["month", "This month"],
  ["year", "This year"],
  ["custom", "Custom"],
];

// preset -> [from, to] as YYYY-MM-DD strings
function presetRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (preset === "yesterday") {
    const x = localIso(new Date(y, m, d - 1));
    return [x, x];
  }
  if (preset === "last7") return [localIso(new Date(y, m, d - 6)), localIso()];
  if (preset === "month") return [localIso(new Date(y, m, 1)), localIso()];
  if (preset === "year") return [`${y}-01-01`, localIso()];
  return [localIso(), localIso()]; // today
}

// const [range, setRange] = useDateRange("month")  ->  range = { preset, from, to }
function useDateRange(initial = "today") {
  return useState(() => {
    const [from, to] = presetRange(initial);
    return { preset: initial, from, to };
  });
}

function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(value.from);
  const [draftTo, setDraftTo] = useState(value.to);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label =
    (DATE_PRESETS.find(([k]) => k === value.preset) || [])[1] || "Custom";
  const rangeText =
    value.from === value.to
      ? formatJournalDate(value.from)
      : `${formatJournalDate(value.from)} - ${formatJournalDate(value.to)}`;
  const showCustom = value.preset === "custom";

  const pick = (key) => {
    if (key === "custom") {
      setDraftFrom(value.from);
      setDraftTo(value.to);
      onChange({ preset: "custom", from: value.from, to: value.to });
      return;
    }
    const [from, to] = presetRange(key);
    onChange({ preset: key, from, to });
    setOpen(false);
  };

  return (
    <div className="relative inline-block mb-4" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
      >
        <span className="font-semibold text-slate-900">{label}</span>
        <span className="text-gray-500">{rangeText}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            {DATE_PRESETS.map(([key, text]) => (
              <button
                key={key}
                onClick={() => pick(key)}
                className={`px-2 py-2 rounded-lg text-sm font-medium border ${
                  value.preset === key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          {showCustom && (
            <>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <label className="text-xs text-gray-500">
                  From
                  <input
                    type="date"
                    value={draftFrom}
                    max={draftTo}
                    onChange={(e) => e.target.value && setDraftFrom(e.target.value)}
                    className={dateInputCls}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  To
                  <input
                    type="date"
                    value={draftTo}
                    min={draftFrom}
                    onChange={(e) => e.target.value && setDraftTo(e.target.value)}
                    className={dateInputCls}
                  />
                </label>
              </div>
              <button
                onClick={() => {
                  onChange({ preset: "custom", from: draftFrom, to: draftTo });
                  setOpen(false);
                }}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white"
              >
                Done
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================================================
// Small SVG charts (no chart library needed): XYChart (line / bar), PieChart (donut), HBarList
// =====================================================================================================
const CHART_COLORS = [
  "#0f766e", "#c2410c", "#2563eb", "#7c3aed", "#db2777",
  "#ca8a04", "#059669", "#64748b", "#dc2626", "#0891b2",
];

const shortNum = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
};

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

// labels: ["11-02", ...]   series: [{ name, color, values: [..] }]   type: "line" | "bar"
function XYChart({ labels, series, type = "line" }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 300;
  const pad = { l: 52, r: 16, t: 22, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = labels.length;
  if (n === 0) return <p className="text-sm text-gray-400">Nothing to show.</p>;

  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const y = (v) => pad.t + ih - (v / max) * ih;
  const slot = iw / n;
  const x = (i) =>
    type === "bar"
      ? pad.l + slot * i + slot / 2
      : pad.l + (n === 1 ? iw / 2 : (iw / (n - 1)) * i);
  const step = Math.ceil(n / 8);
  const showValues = n <= 10;
  const barW = Math.min((slot * 0.7) / series.length, 36);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (max / 4) * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6b7280">
                {shortNum(v)}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="#6b7280">
              {l}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#9ca3af" />
        )}
        {type === "line" &&
          series.map((s, si) => {
            const color = s.color || CHART_COLORS[si];
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            return (
              <g key={s.name}>
                {n > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />}
                {s.values.map((v, i) => (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(v)} r={n > 40 ? 1.8 : 3.2} fill="#fff" stroke={color} strokeWidth="2" />
                    {showValues && series.length <= 2 && (
                      <text x={x(i)} y={y(v) + (si === 0 ? -8 : 14)} textAnchor="middle" fontSize="9" fontWeight="600" fill={color}>
                        {shortNum(v)}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        {type === "bar" &&
          series.map((s, si) => {
            const color = s.color || CHART_COLORS[si];
            return s.values.map((v, i) => {
              const bx = x(i) - (barW * series.length) / 2 + barW * si;
              return (
                <g key={`${s.name}${i}`}>
                  <rect x={bx} y={y(v)} width={barW - 1} height={Math.max(pad.t + ih - y(v), 0)} fill={color} rx="2" />
                  {showValues && series.length <= 2 && v > 0 && (
                    <text x={bx + barW / 2} y={y(v) - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={color}>
                      {shortNum(v)}
                    </text>
                  )}
                </g>
              );
            });
          })}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={type === "bar" ? pad.l + slot * i : x(i) - Math.max(slot / 2, 4)}
            y={pad.t}
            width={Math.max(slot, 8)}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="absolute top-2 z-10 bg-white border border-gray-300 rounded-lg shadow px-3 py-2 text-xs pointer-events-none"
          style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 12), 78)}%` }}
        >
          <p className="font-semibold text-gray-900 mb-1">{labels[hover]}</p>
          {series.map((s, si) => (
            <p key={s.name} style={{ color: s.color || CHART_COLORS[si] }}>
              {s.name}: {formatRs(s.values[hover])}
            </p>
          ))}
        </div>
      )}
      <div className="flex justify-center gap-4 mt-1 text-xs text-gray-600">
        {series.map((s, si) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: s.color || CHART_COLORS[si] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// items: [{ label, value }]  - donut chart with a legend
function PieChart({ items }) {
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((a, i) => a + i.value, 0);
  if (total <= 0) return <p className="text-sm text-gray-400">Nothing to show.</p>;

  const R = 80, r = 48, C = 100;
  const pt = (rad, ang) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
  let start = -Math.PI / 2;
  const slices = data.map((it, i) => {
    const share = it.value / total;
    const end = start + share * Math.PI * 2;
    const large = share > 0.5 ? 1 : 0;
    const [x1, y1] = pt(R, start), [x2, y2] = pt(R, end);
    const [x3, y3] = pt(r, end), [x4, y4] = pt(r, start);
    const d =
      share >= 0.9999
        ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`
        : `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
    start = end;
    return { ...it, d, share, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 200 200" className="w-40 h-40 shrink-0">
        {slices.map((s) => (
          <path key={s.label} d={s.d} fill={s.color}>
            <title>{`${s.label}: ${formatRs(s.value)} (${(s.share * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
        <text x={C} y={C - 2} textAnchor="middle" fontSize="11" fill="#6b7280">Total</text>
        <text x={C} y={C + 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">
          {shortNum(total)}
        </text>
      </svg>
      <div className="flex-1 min-w-[160px] space-y-1.5 text-xs">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="flex-1 truncate text-gray-700">{s.label}</span>
            <span className="text-gray-900">{formatRs(s.value)}</span>
            <span className="w-12 text-right text-gray-400">{(s.share * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// items: [{ label, value }] - horizontal bars
function HBarList({ items }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <p className="text-sm text-gray-400">Nothing to show.</p>;
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate text-gray-600">{it.label}</span>
          <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
            <div
              className="h-4"
              style={{
                width: `${Math.max((it.value / max) * 100, 1)}%`,
                background: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
          <span className="w-28 shrink-0 text-right text-gray-900">{formatRs(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

// =====================================================================================================
// Daily Sales & Collection report (the default Reports page)
// =====================================================================================================
function DayDetail({ day }) {
  const { data, loading, error } = useReport(() => getDailyDetail(day), [day]);
  return (
    <ReportBody loading={loading} error={error} data={data}>
      {data && (
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-gray-500 mb-1">Invoices</p>
            {data.invoices.length === 0 ? (
              <p className="text-gray-400">None</p>
            ) : (
              data.invoices.map((i) => (
                <div key={i.id} className="flex justify-between gap-2 py-0.5">
                  <span className="text-gray-700 truncate">{i.number} · {i.customer}</span>
                  <span className="text-gray-900 shrink-0">{formatRs(i.total)}</span>
                </div>
              ))
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-500 mb-1">Payments received</p>
            {data.payments.length === 0 ? (
              <p className="text-gray-400">None</p>
            ) : (
              data.payments.map((p) => (
                <div key={p.id} className="flex justify-between gap-2 py-0.5">
                  <span className="text-gray-700 truncate">{p.number} · {p.customer} ({p.mode})</span>
                  <span className="text-gray-900 shrink-0">{formatRs(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </ReportBody>
  );
}

function DailySalesReport() {
  const [range, setRange] = useDateRange("month");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [openDay, setOpenDay] = useState(null);
  const { data, loading, error } = useReport(
    () => getDailyReport(range.from, range.to),
    [range.from, range.to],
  );

  const stat = (label, value, tone) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
  const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
  const td = "px-3 py-2 text-right whitespace-nowrap";

  return (
    <>
      <DateRangeFilter value={range} onChange={setRange} />
      <ReportBody loading={loading} error={error} data={data}>
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {stat("Sales (invoices)", formatRs(data.totals.sales))}
              {stat("Returns (credit notes)", formatRs(data.totals.returns), data.totals.returns > 0 ? "bad" : undefined)}
              {stat("Collection (payments)", formatRs(data.totals.collection), "good")}
              {stat(
                "Net sales - collection",
                formatRs(data.totals.difference),
                data.totals.difference > 0 ? "bad" : undefined,
              )}
            </div>

            {data.by_mode.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {data.by_mode.map((m) => (
                  <span key={m.mode} className="bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600">
                    {m.mode}: <b className="text-gray-900">{formatRs(m.amount)}</b>
                  </span>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              Hide days with no sales or collection
            </label>

            <ReportCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className={th}>Invoices</th>
                      <th className={th}>Sales</th>
                      <th className={th}>Returns</th>
                      <th className={th}>Net sales</th>
                      <th className={th}>Payments</th>
                      <th className={th}>Collection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows
                      .filter((r) => !hideEmpty || r.invoices || r.payments || r.returns)
                      .map((r) => (
                        <Fragment key={r.date}>
                          <tr
                            onClick={() => setOpenDay(openDay === r.date ? null : r.date)}
                            className="border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 text-left whitespace-nowrap text-gray-900">
                              {formatJournalDate(r.date)}
                            </td>
                            <td className={td}>{r.invoices}</td>
                            <td className={td}>{formatRs(r.sales)}</td>
                            <td className={`${td} ${r.returns > 0 ? "text-red-600" : ""}`}>{formatRs(r.returns)}</td>
                            <td className={td}>{formatRs(r.net_sales)}</td>
                            <td className={td}>{r.payments}</td>
                            <td className={`${td} text-green-700`}>{formatRs(r.collection)}</td>
                          </tr>
                          {openDay === r.date && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="px-3 py-3">
                                <DayDetail day={r.date} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    <tr className="font-semibold border-t border-gray-200">
                      <td className="px-3 py-2 text-left">Total</td>
                      <td className={td}>{data.totals.invoices}</td>
                      <td className={td}>{formatRs(data.totals.sales)}</td>
                      <td className={td}>{formatRs(data.totals.returns)}</td>
                      <td className={td}>{formatRs(data.totals.net_sales)}</td>
                      <td className={td}>{data.totals.payments}</td>
                      <td className={`${td} text-green-700`}>{formatRs(data.totals.collection)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">Tap a day to see its invoices and payments. Void invoices are not counted.</p>
            </ReportCard>
          </>
        )}
      </ReportBody>
    </>
  );
}


function groupDaily(rows, mode) {
  if (mode === "day")
    return rows.map((r) => ({ label: r.date.slice(5), sales: r.sales, collection: r.collection, returns: r.returns }));
  const map = new Map();
  for (const r of rows) {
    const d = new Date(`${r.date}T00:00:00`);
    let key, label;
    if (mode === "month") {
      key = r.date.slice(0, 7);
      label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    } else {
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      key = localIso(mon);
      label = mon.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
    }
    const g = map.get(key) || { label, sales: 0, collection: 0, returns: 0 };
    g.sales += r.sales;
    g.collection += r.collection;
    g.returns += r.returns;
    map.set(key, g);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, g]) => g);
}

function SalesGraphsReport() {
  const [range, setRange] = useDateRange("month");
  const [kind, setKind] = useState("line"); // "line" | "bar"
  const [groupBy, setGroupBy] = useState("auto");
  const daily = useReport(() => getDailyReport(range.from, range.to), [range.from, range.to]);
  const summary = useReport(() => getSalesSummary(range.from, range.to), [range.from, range.to]);

  const pill = (active) =>
    `px-3 py-1 rounded-lg text-xs font-medium border ${
      active ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
    }`;

  const ready = daily.data && summary.data;
  let trend = [];
  let custPie = [];
  let paidPie = [];
  if (ready) {
    const dayCount = daily.data.rows.length;
    const usedGroup = groupBy === "auto" ? (dayCount <= 31 ? "day" : dayCount <= 120 ? "week" : "month") : groupBy;
    trend = groupDaily(daily.data.rows, usedGroup);
    const top = summary.data.top_customers.slice(0, 6);
    custPie = top.map((c) => ({ label: c.customer_name, value: c.sales }));
    const others = summary.data.totals.sales - top.reduce((a, c) => a + c.sales, 0);
    if (others > 0.005) custPie.push({ label: "Others", value: others });
    const unpaid = Math.max(summary.data.totals.outstanding, 0);
    paidPie = [
      { label: "Paid", value: Math.max(summary.data.totals.sales - unpaid, 0) },
      { label: "Still unpaid", value: unpaid },
    ];
  }

  return (
    <>
      <DateRangeFilter value={range} onChange={setRange} />
      <ReportBody
        loading={daily.loading || summary.loading}
        error={daily.error || summary.error}
        data={ready ? true : null}
      >
        {ready && (
          <>
            <ReportCard title="Sales vs collection">
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setKind("line")} className={pill(kind === "line")}>Line</button>
                <button onClick={() => setKind("bar")} className={pill(kind === "bar")}>Bar</button>
                <span className="w-2" />
                {[["auto", "Auto"], ["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]].map(([k, t]) => (
                  <button key={k} onClick={() => setGroupBy(k)} className={pill(groupBy === k)}>{t}</button>
                ))}
              </div>
              <XYChart
                type={kind}
                labels={trend.map((t) => t.label)}
                series={[
                  { name: "Sales", color: "#0f766e", values: trend.map((t) => t.sales) },
                  { name: "Collection", color: "#c2410c", values: trend.map((t) => t.collection) },
                ]}
              />
            </ReportCard>

            <div className="grid md:grid-cols-2 gap-4">
              <ReportCard title="Sales by customer (share)">
                <PieChart items={custPie} />
              </ReportCard>
              <ReportCard title="Collection by payment mode">
                <PieChart items={daily.data.by_mode.map((m) => ({ label: m.mode, value: m.amount }))} />
              </ReportCard>
              <ReportCard title="Top 10 selling items (sales)">
                <HBarList items={summary.data.top_products.map((p) => ({ label: p.item_name, value: p.sales }))} />
              </ReportCard>
              <ReportCard title="Invoices in this period: paid vs unpaid">
                <PieChart items={paidPie} />
              </ReportCard>
            </div>

            <ReportCard title="Top 10 customers (sales)">
              <HBarList items={summary.data.top_customers.map((c) => ({ label: c.customer_name, value: c.sales }))} />
            </ReportCard>
          </>
        )}
      </ReportBody>
    </>
  );
}

// ---------- Sales Summary report: best customers, best products, trend, with date filters ----------
const SALES_FILTERS = [
  ["today", "Today"],
  ["month", "This Month"],
  ["lastMonth", "Last Month"],
  ["pickMonth", "Pick Month"],
  ["pickDay", "Pick Day"],
  ["year", "Year"],
  ["custom", "Custom Range"],
];

function SalesSummaryReport() {
  const now = new Date();
  const [mode, setMode] = useState("month");
  const [day, setDay] = useState(localIso());
  const [monthVal, setMonthVal] = useState(localIso().slice(0, 7)); // "YYYY-MM"
  const [yearVal, setYearVal] = useState(String(now.getFullYear()));
  const [customFrom, setCustomFrom] = useState(`${now.getFullYear()}-01-01`);
  const [customTo, setCustomTo] = useState(localIso());

  // turn the chosen filter into a [from, to] pair of YYYY-MM-DD strings
  const [from, to] = (() => {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (mode === "today") return [localIso(), localIso()];
    if (mode === "month")
      return [localIso(new Date(y, m, 1)), localIso(new Date(y, m + 1, 0))];
    if (mode === "lastMonth")
      return [localIso(new Date(y, m - 1, 1)), localIso(new Date(y, m, 0))];
    if (mode === "pickMonth") {
      const [py, pm] = (monthVal || localIso().slice(0, 7))
        .split("-")
        .map(Number);
      return [localIso(new Date(py, pm - 1, 1)), localIso(new Date(py, pm, 0))];
    }
    if (mode === "pickDay") return [day, day];
    if (mode === "year") {
      const py = /^\d{4}$/.test(yearVal) ? Number(yearVal) : y;
      return [`${py}-01-01`, `${py}-12-31`];
    }
    return [customFrom, customTo];
  })();

  const { data, loading, error } = useReport(
    () => getSalesSummary(from, to),
    [from, to],
  );

  const stat = (label, value, tone) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`text-lg font-bold mt-0.5 ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );

  const maxTrend = data ? Math.max(...data.trend.map((t) => t.sales), 1) : 1;

  return (
    <>
      {/* ---- filters ---- */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SALES_FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border ${
              mode === key
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 max-w-xl">
        {mode === "pickDay" && (
          <label className="text-xs text-gray-500 flex-1 min-w-[140px]">
            Day
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className={dateInputCls}
            />
          </label>
        )}
        {mode === "pickMonth" && (
          <label className="text-xs text-gray-500 flex-1 min-w-[140px]">
            Month
            <input
              type="month"
              value={monthVal}
              onChange={(e) => e.target.value && setMonthVal(e.target.value)}
              className={dateInputCls}
            />
          </label>
        )}
        {mode === "year" && (
          <label className="text-xs text-gray-500 flex-1 min-w-[140px]">
            Year
            <input
              type="number"
              min="2000"
              max="2100"
              value={yearVal}
              onChange={(e) => setYearVal(e.target.value)}
              className={dateInputCls}
            />
          </label>
        )}
        {mode === "custom" && (
          <>
            <label className="text-xs text-gray-500 flex-1 min-w-[140px]">
              Start date
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) =>
                  e.target.value && setCustomFrom(e.target.value)
                }
                className={dateInputCls}
              />
            </label>
            <label className="text-xs text-gray-500 flex-1 min-w-[140px]">
              End date
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                className={dateInputCls}
              />
            </label>
          </>
        )}
      </div>

      <ReportBody loading={loading} error={error} data={data}>
        {data && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              {formatJournalDate(data.date_from)} to{" "}
              {formatJournalDate(data.date_to)} · void invoices are not counted
            </p>

            {/* ---- most buyer customer ---- */}
            {data.top_customer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                  Most buying customer
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {data.top_customer.customer_name}
                </p>
                <p className="text-sm text-gray-600">
                  {formatRs(data.top_customer.sales)} in this period
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-4">
                No sales in this period.
              </p>
            )}

            {/* ---- totals ---- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {stat("Total sales", formatRs(data.totals.sales))}
              {stat(
                "Credit notes (returns)",
                formatRs(data.totals.returns),
                data.totals.returns > 0 ? "bad" : undefined,
              )}
              {stat("Net sales", formatRs(data.totals.net_sales), "good")}
              {stat(
                "Gross profit (sales - item cost)",
                formatRs(data.totals.gross_profit),
                data.totals.gross_profit < 0 ? "bad" : "good",
              )}
              {stat("Payments received", formatRs(data.totals.collected))}
              {stat(
                "Still unpaid (this period's invoices)",
                formatRs(data.totals.outstanding),
                data.totals.outstanding > 0 ? "bad" : undefined,
              )}
              {stat(
                "Invoices / Customers",
                `${data.totals.invoice_count} / ${data.totals.customer_count}`,
              )}
              {stat(
                "Items sold · Avg invoice",
                `${data.totals.items_sold} · ${formatRs(data.totals.average_invoice)}`,
              )}
            </div>

            {/* ---- sales trend ---- */}
            {data.trend.length > 0 && (
              <ReportCard title={`Sales by ${data.group_by}`}>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {data.trend.map((t) => (
                    <div
                      key={t.label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-20 shrink-0 text-gray-500">
                        {t.label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                        <div
                          className="bg-blue-500 h-4"
                          style={{
                            width: `${Math.max((t.sales / maxTrend) * 100, 1)}%`,
                          }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-gray-900">
                        {formatRs(t.sales)}
                      </span>
                    </div>
                  ))}
                </div>
              </ReportCard>
            )}

            {/* ---- top customers ---- */}
            <ReportCard title="Top customers (by sales)">
              {data.top_customers.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing to show.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="py-1.5 pr-2">#</th>
                        <th className="py-1.5 pr-2">Customer</th>
                        <th className="py-1.5 pr-2 text-right">Invoices</th>
                        <th className="py-1.5 pr-2 text-right">Qty</th>
                        <th className="py-1.5 pr-2 text-right">Sales</th>
                        <th className="py-1.5 pr-2 text-right">Returns</th>
                        <th className="py-1.5 pr-2 text-right">Paid</th>
                        <th className="py-1.5 text-right">Unpaid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_customers.map((c, i) => (
                        <tr
                          key={c.customer_id}
                          className={`border-b border-gray-50 ${i === 0 ? "font-semibold" : ""}`}
                        >
                          <td className="py-1.5 pr-2 text-gray-400">{i + 1}</td>
                          <td className="py-1.5 pr-2 text-gray-900">
                            {c.customer_name}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {c.invoices}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {c.quantity}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {formatRs(c.sales)}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {formatRs(c.returns)}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {formatRs(c.paid)}
                          </td>
                          <td
                            className={`py-1.5 text-right ${c.balance > 0 ? "text-red-600" : ""}`}
                          >
                            {formatRs(c.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportCard>

            {/* ---- top products ---- */}
            <ReportCard title="Top selling items">
              {data.top_products.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing to show.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="py-1.5 pr-2">#</th>
                        <th className="py-1.5 pr-2">Item</th>
                        <th className="py-1.5 pr-2 text-right">Qty sold</th>
                        <th className="py-1.5 pr-2 text-right">Sales</th>
                        <th className="py-1.5 pr-2 text-right">Cost</th>
                        <th className="py-1.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_products.map((p, i) => (
                        <tr
                          key={p.product_id ?? p.item_name}
                          className="border-b border-gray-50"
                        >
                          <td className="py-1.5 pr-2 text-gray-400">{i + 1}</td>
                          <td className="py-1.5 pr-2 text-gray-900">
                            {p.item_name}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {p.quantity}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {formatRs(p.sales)}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {formatRs(p.cost)}
                          </td>
                          <td
                            className={`py-1.5 text-right ${p.profit < 0 ? "text-red-600" : "text-green-700"}`}
                          >
                            {formatRs(p.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportCard>
          </>
        )}
      </ReportBody>
    </>
  );
}

function BSLine({
  depth = 0,
  label,
  amount,
  kind = "acct",
  chevron,
  onToggle,
  onAmount,
  active,
}) {
  const tone =
    kind === "band"
      ? "bg-[#0a2a5e] text-white font-semibold"
      : kind === "group"
        ? "bg-[#dbe8fb] text-[#0a2a5e] font-semibold"
        : kind === "sub"
          ? "font-semibold text-gray-800"
          : kind === "total"
            ? "border-t border-gray-300 font-semibold text-gray-900"
            : kind === "grand"
              ? "bg-[#eaf1fd] border-y-2 border-gray-800 font-bold text-gray-900"
              : "text-gray-700 border-b border-gray-50";
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm ${tone}`}
    >
      <span
        style={{ paddingLeft: depth * 18 }}
        className="flex items-center gap-1 min-w-0"
      >
        {chevron !== undefined && (
          <button type="button" onClick={onToggle} className="shrink-0">
            {chevron ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <span className="truncate">{label}</span>
      </span>
      {amount !== undefined &&
        (onAmount ? (
          <button
            type="button"
            onClick={onAmount}
            title="See the transactions behind this number"
            className={`tabular-nums hover:underline ${active ? "text-blue-700" : ""}`}
          >
            {plNum(amount)}
          </button>
        ) : (
          <span className="tabular-nums">{plNum(amount)}</span>
        ))}
    </div>
  );
}

// the entries behind one balance-sheet number, with a running balance
function BSAccountTx({ accountId, own, asOf, onOpen }) {
  const { data, loading, error } = useReport(
    () => getAccountTransactions(accountId, asOf, own),
    [accountId, own, asOf],
  );
  const box = (c) => (
    <div className="px-6 py-2 text-xs text-gray-500 bg-[#f6f9ff]">{c}</div>
  );
  if (loading && !data) return box("Loading transactions...");
  if (error) return box(<span className="text-red-500">{error}</span>);
  if (!data || data.rows.length === 0) return box("No transactions.");
  const th = "px-2 py-1 text-xs font-semibold text-gray-500";
  return (
    <div className="bg-[#f6f9ff] px-4 py-2 overflow-x-auto">
      <table className="w-full text-xs bg-white border border-[#dbe4f3] rounded min-w-[640px]">
        <thead>
          <tr className="text-left bg-[#eaf1fd]">
            <th className={th}>Date</th>
            <th className={th}>Transaction</th>
            <th className={th}>Name / memo</th>
            <th className={`${th} text-right`}>Debit</th>
            <th className={`${th} text-right`}>Credit</th>
            <th className={`${th} text-right`}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id} className="border-t border-[#eef2fa]">
              <td className="px-2 py-1 whitespace-nowrap">
                {formatJournalDate(r.date)}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="text-blue-700 underline font-medium"
                >
                  {r.type} {r.number}
                </button>
              </td>
              <td className="px-2 py-1">
                {r.name}
                {r.memo && <span className="text-gray-400"> - {r.memo}</span>}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {r.debit ? plNum(r.debit) : ""}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {r.credit ? plNum(r.credit) : ""}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {plNum(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetReport() {
  const [asOf, setAsOf] = useState(localIso());
  const [showZero, setShowZero] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set()); // account ids folded shut
  const [showTx, setShowTx] = useState(() => new Set()); // "own:12" / "all:12" = entries showing
  const [txOpen, setTxOpen] = useState(null); // the transaction whose details are open
  const { data, loading, error } = useReport(
    () => getBalanceSheet(asOf, showZero),
    [asOf, showZero],
  );

  const flip = (setter, key) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const renderNode = (n, depth) => {
    const canDrill = n.id != null;
    const txFor = (key, own) =>
      canDrill && showTx.has(key) ? (
        <BSAccountTx
          accountId={n.id}
          own={own}
          asOf={asOf}
          onOpen={setTxOpen}
        />
      ) : null;
    const drill = (key) => (canDrill ? () => flip(setShowTx, key) : undefined);

    if (n.children.length === 0)
      return (
        <div key={n.id ?? n.name}>
          <BSLine
            depth={depth}
            label={n.name}
            amount={n.amount}
            onAmount={drill(`own:${n.id}`)}
            active={showTx.has(`own:${n.id}`)}
          />
          {txFor(`own:${n.id}`, true)}
        </div>
      );

    const isOpen = !collapsed.has(n.id);
    return (
      <div key={n.id}>
        <BSLine
          depth={depth}
          label={n.name}
          chevron={isOpen}
          onToggle={() => flip(setCollapsed, n.id)}
          amount={isOpen ? undefined : n.total}
          onAmount={isOpen ? undefined : drill(`all:${n.id}`)}
          active={showTx.has(`all:${n.id}`)}
        />
        {!isOpen && txFor(`all:${n.id}`, false)}
        {isOpen && (
          <>
            {n.amount !== 0 && (
              <div>
                <BSLine
                  depth={depth + 1}
                  label={n.name}
                  amount={n.amount}
                  onAmount={drill(`own:${n.id}`)}
                  active={showTx.has(`own:${n.id}`)}
                />
                {txFor(`own:${n.id}`, true)}
              </div>
            )}
            {n.children.map((c) => renderNode(c, depth + 1))}
            <BSLine
              kind="total"
              depth={depth}
              label={`Total ${n.name}`}
              amount={n.total}
              onAmount={drill(`all:${n.id}`)}
              active={showTx.has(`all:${n.id}`)}
            />
            {txFor(`all:${n.id}`, false)}
          </>
        )}
      </div>
    );
  };

  const renderSide = (side, totalLabel, total) => (
    <div className="mb-4">
      <BSLine kind="band" label={side.title} />
      {side.groups.map((g) => (
        <div key={g.title}>
          <BSLine kind="group" depth={1} label={g.title} />
          {g.subgroups.map((sg) => (
            <div key={sg.title}>
              {sg.title !== g.title && (
                <BSLine kind="sub" depth={2} label={sg.title} />
              )}
              {sg.accounts.map((n) =>
                renderNode(n, sg.title !== g.title ? 3 : 2),
              )}
              {sg.title !== g.title && (
                <BSLine
                  kind="total"
                  depth={2}
                  label={`Total ${sg.title}`}
                  amount={sg.total}
                />
              )}
            </div>
          ))}
          <BSLine
            kind="total"
            depth={1}
            label={`Total ${g.title}`}
            amount={g.total}
          />
        </div>
      ))}
      <BSLine kind="grand" label={totalLabel} amount={total} />
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <label className="text-xs text-gray-500 block max-w-[12rem]">
          As of
          <input
            type="date"
            value={asOf}
            onChange={(e) => e.target.value && setAsOf(e.target.value)}
            className={dateInputCls}
          />
        </label>
        <label className="text-xs text-gray-500 flex items-center gap-1.5 pb-2">
          <input
            type="checkbox"
            checked={showZero}
            onChange={(e) => setShowZero(e.target.checked)}
          />
          Show zero accounts
        </label>
      </div>
      <ReportBody loading={loading} error={error} data={data}>
        {data && (
          <>
            {Math.abs(data.difference) >= 0.005 && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                The sheet is out of balance by {formatRs(data.difference)}.
                Check your journal entries.
              </p>
            )}
            {(data.warnings || []).map((w) => (
              <p
                key={w.account_id}
                className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3"
              >
                {w.message} Click its number below to see the entries.
              </p>
            ))}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {renderSide(data.assets, "TOTAL ASSETS", data.total_assets)}
              <BSLine kind="band" label="LIABILITIES & EQUITY" />
              {renderSide(
                { ...data.liabilities, title: "Liabilities" },
                "Total Liabilities",
                data.total_liabilities,
              )}
              {renderSide(
                { ...data.equity, title: "Equity" },
                "Total Equity",
                data.total_equity,
              )}
              <BSLine
                kind="grand"
                label="TOTAL LIABILITIES & EQUITY"
                amount={data.total_liabilities_and_equity}
              />
            </div>
          </>
        )}
      </ReportBody>
      {txOpen && (
        <PLTransactionModal tx={txOpen} onClose={() => setTxOpen(null)} />
      )}
    </>
  );
}

const AGE_COLS = [
  ["current", "Current"],
  ["d1_15", "1-15"],
  ["d16_30", "16-30"],
  ["d31_45", "31-45"],
  ["d45_plus", "> 45"],
];

// kind: "receivables" (customers, invoices) | "payables" (vendors, bills). Days are counted past the due date.
function AgeingReport({ kind }) {
  const isAr = kind === "receivables";
  const asOf = localIso();
  const { data, loading, error } = useReport(
    () => getAgeing(kind, asOf),
    [kind],
  );
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
  const td = "px-3 py-2 text-right whitespace-nowrap";
  const money = (n) => (n ? formatRs(n) : "-");

  return (
    <ReportBody loading={loading} error={error} data={data}>
      {data && (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {isAr ? "What customers owe you" : "What you owe vendors"}, by days
            past the due date · as of {formatJournalDate(asOf)}
          </p>
          {!data.matches_ledger && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              {isAr ? "Receivables" : "Payables"} here (
              {formatRs(data.totals.net)}) differ from your ledger account (
              {formatRs(data.ledger_balance)}). Usually a manual journal posted
              to {isAr ? "Accounts Receivable" : "Accounts Payable"}, or an
              entry made before the ledger existed.
            </p>
          )}
          {data.rows.length === 0 ? (
            <p className="text-gray-400 text-center py-16">
              {isAr ? "No unpaid invoices." : "No unpaid bills."}
            </p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {isAr ? "Customer" : "Vendor"}
                    </th>
                    {AGE_COLS.map(([k, label]) => (
                      <th key={k} className={th}>
                        {label}
                      </th>
                    ))}
                    <th className={th}>Total</th>
                    {isAr && <th className={th}>Unused credits</th>}
                    {isAr && <th className={th}>Net</th>}
                  </tr>
                </thead>
                {data.rows.map((r) => (
                  <tbody key={r.party_id} className="border-t border-gray-100">
                    <tr
                      onClick={() =>
                        r.documents.length > 0 && toggle(r.party_id)
                      }
                      className={
                        r.documents.length > 0
                          ? "cursor-pointer hover:bg-gray-50"
                          : ""
                      }
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {r.documents.length > 0 &&
                          (open.has(r.party_id) ? (
                            <ChevronDown
                              size={14}
                              className="inline mr-1 text-gray-400"
                            />
                          ) : (
                            <ChevronRight
                              size={14}
                              className="inline mr-1 text-gray-400"
                            />
                          ))}
                        {r.party_name}
                      </td>
                      {AGE_COLS.map(([k]) => (
                        <td
                          key={k}
                          className={`${td} ${k !== "current" && r[k] > 0 ? "text-red-600" : "text-gray-700"}`}
                        >
                          {money(r[k])}
                        </td>
                      ))}
                      <td className={`${td} font-medium`}>{money(r.total)}</td>
                      {isAr && (
                        <td className={`${td} text-green-700`}>
                          {r.credits ? `-${formatRs(r.credits)}` : "-"}
                        </td>
                      )}
                      {isAr && (
                        <td className={`${td} font-semibold`}>
                          {formatRs(r.net)}
                        </td>
                      )}
                    </tr>
                    {open.has(r.party_id) &&
                      r.documents.map((d) => (
                        <tr
                          key={d.id}
                          className="bg-gray-50 text-xs text-gray-500"
                        >
                          <td
                            className="pl-8 pr-3 py-1.5"
                            colSpan={AGE_COLS.length + 1}
                          >
                            {d.number} · dated {formatJournalDate(d.doc_date)} ·
                            due {formatJournalDate(d.due_date)}
                            {d.days_overdue > 0 ? (
                              <span className="text-red-600">
                                {" "}
                                · {d.days_overdue} days overdue
                              </span>
                            ) : (
                              " · not due yet"
                            )}
                          </td>
                          <td
                            className="px-3 py-1.5 text-right whitespace-nowrap"
                            colSpan={isAr ? 3 : 1}
                          >
                            {formatRs(d.balance)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                ))}
                <tfoot className="bg-gray-100 font-semibold text-gray-900">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    {AGE_COLS.map(([k]) => (
                      <td key={k} className={td}>
                        {money(data.totals[k])}
                      </td>
                    ))}
                    <td className={td}>{money(data.totals.total)}</td>
                    {isAr && (
                      <td className={`${td} text-green-700`}>
                        {data.totals.credits
                          ? `-${formatRs(data.totals.credits)}`
                          : "-"}
                      </td>
                    )}
                    {isAr && (
                      <td className={td}>{formatRs(data.totals.net)}</td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </ReportBody>
  );
}

// ---------- Step 10: Dashboard (admin only) ----------
function DashboardPage({ isAdmin, go }) {
  const { data, loading, error } = useReport(() => getDashboard(), []);
  const max = data
    ? Math.max(1, ...data.chart.flatMap((m) => [m.income, m.expense]))
    : 1;
  const barH = (v) => (v > 0 ? `${Math.max(2, (v / max) * 100)}%` : "0%");

  const stat = (label, value, sub, onClick, tone) => (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-4 ${onClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
    >
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-1 ${tone || "text-gray-900"}`}>
        {formatRs(value)}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="dashboard"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />
      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Dashboard</h1>
        <ReportBody loading={loading} error={error} data={data}>
          {data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {stat(
                  "Cash & bank",
                  data.cash_total,
                  `${data.cash_accounts.length} account(s)`,
                  () => go({ view: "banking" }),
                  data.cash_total < 0 ? "text-red-600" : undefined,
                )}
                {stat(
                  "Receivables",
                  data.receivables,
                  data.receivables_overdue > 0
                    ? `${formatRs(data.receivables_overdue)} overdue`
                    : "Nothing overdue",
                  () => go({ view: "reports" }),
                )}
                {stat(
                  "Payables",
                  data.payables,
                  data.payables_overdue > 0
                    ? `${formatRs(data.payables_overdue)} overdue`
                    : "Nothing overdue",
                  () => go({ view: "reports" }),
                )}
              </div>

              <ReportCard title="Income and expense, last 6 months">
                <div className="flex gap-4 text-xs text-gray-500 mb-2">
                  <span>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                    Income {formatRs(data.income_6m)}
                  </span>
                  <span>
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />
                    Expense {formatRs(data.expense_6m)}
                  </span>
                </div>
                <div className="flex gap-2 h-36 items-stretch">
                  {data.chart.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col">
                      <div className="flex-1 flex items-end justify-center gap-1">
                        <div
                          className="w-3 sm:w-5 bg-green-500 rounded-t"
                          style={{ height: barH(m.income) }}
                          title={`Income ${formatRs(m.income)}`}
                        />
                        <div
                          className="w-3 sm:w-5 bg-red-400 rounded-t"
                          style={{ height: barH(m.expense) }}
                          title={`Expense ${formatRs(m.expense)}`}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 text-center mt-1">
                        {m.month}
                      </p>
                    </div>
                  ))}
                </div>
              </ReportCard>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReportCard title="Top expenses this year">
                  {data.top_expenses.length === 0 && (
                    <p className="text-xs text-gray-400 py-1">
                      No expenses yet
                    </p>
                  )}
                  {data.top_expenses.map((a) => (
                    <ReportLine key={a.id} label={a.name} amount={a.amount} />
                  ))}
                </ReportCard>

                <ReportCard title={`Low stock (${data.low_stock_count})`}>
                  {data.low_stock.length === 0 && (
                    <p className="text-xs text-gray-400 py-1">
                      All items are above their reorder level
                    </p>
                  )}
                  {data.low_stock.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between gap-3 py-1.5 text-sm"
                    >
                      <span className="text-gray-600 truncate">{p.name}</span>
                      <span className="shrink-0 text-red-600">
                        {p.quantity} / min {p.reorder_min}
                      </span>
                    </div>
                  ))}
                </ReportCard>
              </div>

              <ReportCard title="Cash & bank accounts">
                {data.cash_accounts.length === 0 && (
                  <p className="text-xs text-gray-400 py-1">
                    No cash or bank accounts yet
                  </p>
                )}
                {data.cash_accounts.map((a) => (
                  <ReportLine key={a.id} label={a.name} amount={a.balance} />
                ))}
              </ReportCard>
            </>
          )}
        </ReportBody>
      </main>
    </div>
  );
}

// ---------- Banking (admin only): bank / cash accounts, their transactions, deposits, withdrawals, transfers ----------
function BankingPage({ isAdmin, go, accountId, reconcile }) {
  if (accountId && reconcile) {
    return (
      <BankReconcile isAdmin={isAdmin} go={go} accountId={Number(accountId)} />
    );
  }
  return accountId ? (
    <BankRegister isAdmin={isAdmin} go={go} accountId={Number(accountId)} />
  ) : (
    <BankAccountsList isAdmin={isAdmin} go={go} />
  );
}

function BankAccountsList({ isAdmin, go }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  useQuickNew(() => setAddOpen(true));
  const [transferOpen, setTransferOpen] = useState(false);

  const load = async () => {
    try {
      setAccounts(await getBankAccounts());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="banking"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[10rem]">
            <p className="text-xs text-gray-400">
              Total in bank and cash accounts
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {formatRs(total)}
            </p>
          </div>
          {accounts.length >= 2 && (
            <button
              onClick={() => setTransferOpen(true)}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
            >
              Transfer
            </button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + Add Account
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            No bank or cash accounts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => go({ view: "banking", account: a.id })}
                className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 text-left hover:bg-gray-50"
              >
                <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Banknote size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{a.name}</p>
                  <p className="text-xs text-gray-400">
                    {a.account_type === "bank"
                      ? "Bank account"
                      : "Cash account"}
                    {a.account_code && ` · ${a.account_code}`} ·{" "}
                    {a.transaction_count} transaction
                    {a.transaction_count === 1 ? "" : "s"}
                  </p>
                </div>
                <p
                  className={`font-semibold shrink-0 ${a.balance < 0 ? "text-red-600" : "text-gray-900"}`}
                >
                  {formatRs(a.balance)}
                </p>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </main>

      {addOpen && (
        <BankAccountForm onClose={() => setAddOpen(false)} onSaved={load} />
      )}
      {transferOpen && (
        <BankTxnForm
          type="transfer"
          bankAccounts={accounts}
          onClose={() => setTransferOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function BankAccountForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    account_type: "bank",
    account_code: "",
    opening_balance: "",
    opening_date: toISODate(new Date()),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createBankAccount({
        name: form.name.trim(),
        account_type: form.account_type,
        account_code: form.account_code.trim() || null,
        opening_balance: Number(form.opening_balance) || 0,
        opening_date: form.opening_date || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Add Bank / Cash Account</h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-4 text-sm">
            {[
              ["bank", "Bank account"],
              ["cash", "Cash account"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.account_type === k}
                  onChange={() => set("account_type", k)}
                />
                {label}
              </label>
            ))}
          </div>
          <input
            required
            placeholder="Account name * (e.g. BOC Current)"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={cls}
          />
          <input
            placeholder="Account number / code (optional)"
            value={form.account_code}
            onChange={(e) => set("account_code", e.target.value)}
            className={cls}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Opening balance (Rs.)
              <input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={(e) => set("opening_balance", e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              As of
              <input
                type="date"
                value={form.opening_date}
                onChange={(e) => set("opening_date", e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>
          <p className="text-xs text-gray-400">
            Leave the opening balance empty if the account starts at zero. A
            negative number means overdrawn.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BankRegister({ isAdmin, go, accountId }) {
  const [accounts, setAccounts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [txnType, setTxnType] = useState(null); // "deposit" | "withdrawal" | "transfer" while a form is open

  const load = async () => {
    try {
      const [accs, txns] = await Promise.all([
        getBankAccounts(),
        getBankTransactions(accountId, from, to),
      ]);
      setAccounts(accs);
      setRows(txns);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [accountId, from, to]);

  const account = accounts.find((a) => a.id === accountId);

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Delete this ${row.kind.toLowerCase()} (${formatRs(row.money_in || row.money_out)})? The ledger entry is removed.`,
      )
    )
      return;
    try {
      await deleteBankTransaction(row.journal_id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const btn = "px-3 py-1.5 rounded-lg text-sm font-medium border";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="banking"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <button
          onClick={() => go({ view: "banking" })}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={16} /> All bank accounts
        </button>

        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            {account?.name || "Account"}
          </h1>
          <p className="text-xs text-gray-400">Balance in your books</p>
          <p
            className={`text-2xl font-bold ${account && account.balance < 0 ? "text-red-600" : "text-gray-900"}`}
          >
            {formatRs(account?.balance ?? 0)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setTxnType("deposit")}
            className={`${btn} border-green-200 text-green-700 hover:bg-green-50`}
          >
            + Deposit
          </button>
          <button
            onClick={() => setTxnType("withdrawal")}
            className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}
          >
            + Withdrawal
          </button>
          <button
            onClick={() =>
              go({ view: "banking", account: accountId, reconcile: 1 })
            }
            className={`${btn} border-blue-200 text-blue-700 hover:bg-blue-50`}
          >
            Reconcile
          </button>
          {accounts.length >= 2 && (
            <button
              onClick={() => setTxnType("transfer")}
              className={`${btn} border-gray-300 text-gray-700 hover:bg-gray-50`}
            >
              Transfer
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 max-w-sm">
          <label className="text-xs text-gray-500">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </label>
          <label className="text-xs text-gray-500">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            No transactions {from || to ? "in this period" : "yet"}.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.line_id}
                className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.reconciled && (
                      <Check
                        size={13}
                        className="inline text-green-600 mr-1"
                        title="Reconciled"
                      />
                    )}
                    {r.kind}
                    {r.other_accounts && (
                      <span className="text-gray-400 font-normal">
                        {" "}
                        · {r.other_accounts}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {formatJournalDate(r.date)} · {r.journal_number}
                    {r.reference && ` · ${r.reference}`}
                    {r.description && ` · ${r.description}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-semibold ${r.money_in > 0 ? "text-green-700" : "text-red-600"}`}
                  >
                    {r.money_in > 0 ? "+" : "-"}
                    {formatRs(r.money_in > 0 ? r.money_in : r.money_out)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Bal. {formatRs(r.balance)}
                  </p>
                </div>
                {r.can_delete ? (
                  <button
                    title="Delete"
                    onClick={() => handleDelete(r)}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <span className="w-[27px] shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {txnType && (
        <BankTxnForm
          type={txnType}
          fromAccount={account}
          bankAccounts={accounts}
          onClose={() => setTxnType(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ---------- Step 8B: Bank reconciliation - match your books to the bank statement ----------
function BankReconcile({ isAdmin, go, accountId }) {
  const todayIso = localIso();
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [stmtDate, setStmtDate] = useState(todayIso);
  const [stmtBalance, setStmtBalance] = useState("");
  const [session, setSession] = useState(null); // set once "Start reconciling" has loaded the lines
  const [ticked, setTicked] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const loadBase = async () => {
    try {
      const [accs, recs] = await Promise.all([
        getBankAccounts(),
        getReconciliations(accountId),
      ]);
      setAccount(accs.find((a) => a.id === accountId) || null);
      setHistory(recs);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, [accountId]);

  const start = async () => {
    if (stmtBalance === "" || isNaN(Number(stmtBalance))) {
      setError("Enter the ending balance shown on your bank statement");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setSession(await getReconcileLines(accountId, stmtDate));
      setTicked(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) =>
    setTicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // work in whole cents so 0.1 + 0.2 style rounding never blocks "Finish"
  const cents = (n) => Math.round(Number(n || 0) * 100);
  const tickedRows = session
    ? session.lines.filter((l) => ticked.has(l.line_id))
    : [];
  const moneyInC = tickedRows.reduce((s, l) => s + cents(l.money_in), 0);
  const moneyOutC = tickedRows.reduce((s, l) => s + cents(l.money_out), 0);
  const openingC = session ? cents(session.opening_balance) : 0;
  const clearedC = openingC + moneyInC - moneyOutC;
  const differenceC = cents(stmtBalance) - clearedC;
  const canFinish =
    session && tickedRows.length > 0 && differenceC === 0 && !busy;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const rec = await finishReconciliation(accountId, {
        statement_date: stmtDate,
        statement_balance: Number(stmtBalance),
        line_ids: tickedRows.map((l) => l.line_id),
      });
      setDone(rec);
      setSession(null);
      setTicked(new Set());
      setStmtBalance("");
      await loadBase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const undo = async (rec) => {
    if (
      !window.confirm(
        `Undo the reconciliation of ${formatJournalDate(rec.statement_date)}? Its ${rec.cleared_count} transactions become un-reconciled again.`,
      )
    )
      return;
    try {
      await undoReconciliation(rec.id);
      setDone(null);
      await loadBase();
    } catch (err) {
      alert(err.message);
    }
  };

  const allTicked =
    session && session.lines.length > 0 && ticked.size === session.lines.length;
  const toggleAll = () =>
    setTicked(
      allTicked ? new Set() : new Set(session.lines.map((l) => l.line_id)),
    );
  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="banking"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <button
          onClick={() => go({ view: "banking", account: accountId })}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={16} /> Back to {account?.name || "account"}
        </button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Reconcile {account?.name || ""}
        </h1>
        <p className="text-xs text-gray-400 mb-4">
          Tick the transactions that appear on your bank statement. You can
          finish when the difference is 0.00.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
        {done && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
            Reconciled {done.cleared_count} transactions up to{" "}
            {formatJournalDate(done.statement_date)}.
          </p>
        )}

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : !session ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-gray-500">
                  Statement end date
                  <input
                    type="date"
                    value={stmtDate}
                    onChange={(e) => setStmtDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Ending balance on the statement (Rs.)
                  <input
                    type="number"
                    step="0.01"
                    value={stmtBalance}
                    onChange={(e) => setStmtBalance(e.target.value)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                </label>
              </div>
              {history[0] && (
                <p className="text-xs text-gray-400 mt-3">
                  Last reconciled up to{" "}
                  {formatJournalDate(history[0].statement_date)} (statement
                  balance {formatRs(history[0].statement_balance)}).
                </p>
              )}
              <button
                onClick={start}
                disabled={busy || !stmtDate}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Loading..." : "Start reconciling"}
              </button>
            </div>

            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Reconciliation history
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing reconciled yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        Statement of {formatJournalDate(h.statement_date)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {h.cleared_count} transactions · ending balance{" "}
                        {formatRs(h.statement_balance)}
                      </p>
                    </div>
                    {h.can_undo && (
                      <button
                        onClick={() => undo(h)}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 text-sm sticky top-0 z-10">
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Statement ending balance ({formatJournalDate(stmtDate)})
                </span>
                <span className="font-medium">
                  {formatRs(Number(stmtBalance))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Already reconciled balance
                </span>
                <span>{formatRs(openingC / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">+ Money in ticked</span>
                <span className="text-green-700">
                  {formatRs(moneyInC / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">- Money out ticked</span>
                <span className="text-red-600">
                  {formatRs(moneyOutC / 100)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 mt-2 pt-2">
                <span className="text-gray-500">Cleared balance</span>
                <span className="font-medium">{formatRs(clearedC / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Difference</span>
                <span
                  className={`font-bold ${differenceC === 0 ? "text-green-700" : "text-red-600"}`}
                >
                  {formatRs(differenceC / 100)}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={finish}
                  disabled={!canFinish}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                >
                  {busy ? "Saving..." : "Finish reconciliation"}
                </button>
                <button
                  onClick={() => {
                    setSession(null);
                    setTicked(new Set());
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>

            {session.lines.length === 0 ? (
              <p className="text-gray-400 text-center py-12">
                No un-reconciled transactions up to this date.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allTicked}
                    onChange={toggleAll}
                  />{" "}
                  Select all ({session.lines.length})
                </label>
                <div className="space-y-2">
                  {session.lines.map((l) => (
                    <label
                      key={l.line_id}
                      className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer ${ticked.has(l.line_id) ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}
                    >
                      <input
                        type="checkbox"
                        checked={ticked.has(l.line_id)}
                        onChange={() => toggle(l.line_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {l.kind}
                          {l.other_accounts && (
                            <span className="text-gray-400 font-normal">
                              {" "}
                              · {l.other_accounts}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {formatJournalDate(l.date)} · {l.journal_number}
                          {l.reference && ` · ${l.reference}`}
                          {l.description && ` · ${l.description}`}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold shrink-0 ${l.money_in > 0 ? "text-green-700" : "text-red-600"}`}
                      >
                        {l.money_in > 0 ? "+" : "-"}
                        {formatRs(l.money_in > 0 ? l.money_in : l.money_out)}
                      </p>
                    </label>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// type: "deposit" | "withdrawal" | "transfer".  fromAccount: the open account (leave out on the list page's Transfer button)
function BankTxnForm({
  type,
  fromAccount = null,
  bankAccounts,
  onClose,
  onSaved,
}) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(fromAccount ? fromAccount.id : "");
  const [otherId, setOtherId] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    if (type !== "transfer")
      getAccounts()
        .then(setAccounts)
        .catch((err) => setError(err.message));
  }, [type]);

  const title = {
    deposit: "New Deposit",
    withdrawal: "New Withdrawal",
    transfer: "Transfer Between Accounts",
  }[type];
  const otherLabel = {
    deposit: "Deposit from (account)",
    withdrawal: "Paid to (account)",
    transfer: "Transfer to",
  }[type];

  // deposit -> income / equity first; withdrawal -> expenses first. Receivable / payable only move through invoices and bills.
  const groupOrder =
    type === "withdrawal"
      ? ["Expense", "Liability", "Equity", "Asset", "Income"]
      : ["Income", "Equity", "Liability", "Asset", "Expense"];
  const otherChoices =
    type === "transfer"
      ? []
      : accounts.filter(
          (a) =>
            !["accounts_receivable", "accounts_payable"].includes(
              a.account_type,
            ) && a.id !== Number(accountId),
        );
  const bankChoices = bankAccounts.filter((a) => a.id !== Number(accountId));

  const canSave =
    Boolean(accountId) &&
    Boolean(otherId) &&
    Number(amount) > 0 &&
    Boolean(date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createBankTransaction({
        txn_type: type,
        txn_date: date,
        amount: Number(amount),
        account_id: Number(accountId),
        other_account_id: Number(otherId),
        reference: reference.trim() || null,
        description: description.trim() || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          {type === "transfer" ? (
            <label className="text-xs text-gray-500 block">
              Transfer from
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setOtherId("");
                }}
                className={cls + " mt-1"}
              >
                <option value="">Select an account...</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatRs(a.balance)})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-gray-600">
              Account:{" "}
              <span className="font-medium text-gray-900">
                {fromAccount?.name}
              </span>
            </p>
          )}

          <label className="text-xs text-gray-500 block">
            {otherLabel}
            <select
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              className={cls + " mt-1"}
            >
              <option value="">Select an account...</option>
              {type === "transfer"
                ? bankChoices.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                : groupOrder.map((g) => {
                    const inGroup = otherChoices.filter(
                      (a) => ACCOUNT_GROUP_OF[a.account_type] === g,
                    );
                    return inGroup.length === 0 ? null : (
                      <optgroup key={g} label={g}>
                        {inGroup.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Amount (Rs.)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>
          <input
            placeholder="Reference # (cheque no., slip no.)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={cls}
          />
          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cls}
          />

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Customers (admin only) ----------
const CUSTOMER_TERMS = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
];

// ---------- Monthly top-sellers side panels (Customers page + Items page, desktop only) ----------
function useIsDesktop(minWidth = 1024) {
  const query = `(min-width: ${minWidth}px)`;
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// renders its children only on desktop screens, so phones never even load the data
function DesktopOnly({ children }) {
  return useIsDesktop() ? children : null;
}

// month = "YYYY-MM"; reuses the existing sales-summary report
const getMonthSales = (month) => {
  const [y, m] = month.split("-").map(Number);
  const last = String(new Date(y, m, 0).getDate()).padStart(2, "0");
  return reportRequest(
    `sales-summary?date_from=${month}-01&date_to=${month}-${last}&top=100`,
    "Failed to load monthly sales",
  );
};

function useMonthSales() {
  const [month, setMonth] = useState(localIso().slice(0, 7));
  const { data, loading, error } = useReport(
    () => getMonthSales(month),
    [month],
  );
  return { month, setMonth, data, loading, error };
}

// rows: [{ key, name, meta, value, amount }]  (amount drives the bar length)
function TopListPanel({
  title,
  icon: Icon,
  month,
  onMonth,
  loading,
  error,
  data,
  rows,
  footer,
  empty,
}) {
  if (error && !data) return null; // e.g. this user has no access to reports: just hide the panel
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <aside className="hidden lg:block w-80 shrink-0 bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Icon size={16} className="text-blue-600" /> {title}
        </h2>
        <input
          type="month"
          value={month}
          max={localIso().slice(0, 7)}
          onChange={(e) => e.target.value && onMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-600"
        />
      </div>

      {loading && !data ? (
        <p className="text-xs text-gray-400 py-6 text-center">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-start gap-3">
              <span
                className={`shrink-0 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                  i === 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.name}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {r.value}
                  </p>
                </div>
                <p className="text-xs text-gray-400">{r.meta}</p>
                <div className="h-1.5 rounded-full bg-gray-100 mt-1.5">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max(4, (r.amount / max) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {footer && rows.length > 0 && (
        <p className="text-xs text-gray-500 border-t border-gray-100 mt-4 pt-3">
          {footer}
        </p>
      )}
    </aside>
  );
}

function TopBuyersPanel() {
  const { month, setMonth, data, loading, error } = useMonthSales();
  const rows = (data?.top_customers || [])
    .filter((c) => c.invoices > 0)
    .slice(0, 5)
    .map((c) => ({
      key: c.customer_id,
      name: c.customer_name,
      meta: `${c.invoices} ${c.invoices === 1 ? "invoice" : "invoices"}`,
      value: formatRs(c.sales),
      amount: c.sales,
    }));
  return (
    <TopListPanel
      title="Top buyers"
      icon={Users}
      month={month}
      onMonth={setMonth}
      loading={loading}
      error={error}
      data={data}
      rows={rows}
      empty="No sales in this month."
      footer={
        data
          ? `${data.totals.customer_count} customers bought · total ${formatRs(data.totals.sales)}`
          : ""
      }
    />
  );
}

function TopSoldItemsPanel() {
  const { month, setMonth, data, loading, error } = useMonthSales();
  const rows = [...(data?.top_products || [])]
    .filter((p) => p.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((p) => ({
      key: p.product_id ?? p.item_name,
      name: p.item_name,
      meta: `Sales ${formatRs(p.sales)}`,
      value: `${p.quantity} sold`,
      amount: p.quantity,
    }));
  return (
    <TopListPanel
      title="Most sold items"
      icon={Tag}
      month={month}
      onMonth={setMonth}
      loading={loading}
      error={error}
      data={data}
      rows={rows}
      empty="No items sold in this month."
      footer={
        data
          ? `${data.totals.items_sold} items sold in ${data.totals.invoice_count} invoices`
          : ""
      }
    />
  );
}

function CustomersPage({ isAdmin, go }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  useQuickNew(() => {
    setEditing(null);
    setFormOpen(true);
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      setCustomers(await getCustomers());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = [...customers]
    .sort((a, b) => compareNames(a.display_name, b.display_name))
    .filter(
      (c) =>
        !q ||
        [c.display_name, c.company_name, c.email, c.phone].some((v) =>
          (v || "").toLowerCase().includes(q),
        ),
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="customers"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-6xl flex items-start gap-6">
        <div className="flex-1 min-w-0 max-w-3xl">
          <div className="mb-5 flex gap-3 items-center">
            <div className="flex-1">
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Search customers..."
              />
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
            >
              + New Customer
            </button>
          </div>

          {loading ? (
            <p className="text-gray-400 text-center py-16">Loading...</p>
          ) : error ? (
            <p className="text-red-500 text-center py-16">{error}</p>
          ) : shown.length === 0 ? (
            <p className="text-gray-400 text-center py-16">No customers yet.</p>
          ) : (
            <div className="space-y-2 lg:space-y-1">
              {" "}
              {shown.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 lg:py-1 lg:px-3"
                >
                  <div className="flex-1 min-w-0 lg:flex lg:items-center lg:gap-4">
                    <p className="font-medium text-gray-900 truncate lg:w-56 lg:shrink-0 lg:text-sm">
                      {c.display_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate lg:flex-1 lg:min-w-0">
                      {[c.company_name, c.email, c.phone]
                        .filter(Boolean)
                        .join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500 hidden sm:block lg:flex lg:items-center lg:gap-4 lg:whitespace-nowrap">
                    <p>{c.payment_terms}</p>
                    <p>Opening: {formatRs(c.opening_balance)}</p>
                  </div>
                  <ItemActionsMenu
                    onEdit={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleteTarget(c)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DesktopOnly>
          <TopBuyersPanel />
        </DesktopOnly>
      </main>

      {formOpen && (
        <CustomerForm
          initialData={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (id, payload) => {
            if (id) await updateCustomer(id, payload);
            else await createCustomer(payload);
            await load();
          }}
        />
      )}

      {deleteTarget && (
        <TypedDeleteConfirm
          label={deleteTarget.display_name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function CustomerForm({ initialData, onClose, onSubmit }) {
  const isEditMode = Boolean(initialData);
  const [form, setForm] = useState({
    customer_type: initialData?.customer_type || "Business",
    display_name: initialData?.display_name || "",
    company_name: initialData?.company_name || "",
    contact_person: initialData?.contact_person || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    billing_address: initialData?.billing_address || "",
    shipping_address: initialData?.shipping_address || "",
    payment_terms: initialData?.payment_terms || "Due on Receipt",
    opening_balance: initialData?.opening_balance ?? 0,
    notes: initialData?.notes || "",
    is_active: initialData?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(isEditMode ? initialData.id : null, {
        ...form,
        opening_balance: Number(form.opening_balance) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {isEditMode ? "Edit Customer" : "New Customer"}
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-4 text-sm">
            {["Business", "Individual"].map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.customer_type === t}
                  onChange={() => set("customer_type", t)}
                />
                {t}
              </label>
            ))}
          </div>
          <input
            required
            placeholder="Customer display name *"
            value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            className={cls}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Company name"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              className={cls}
            />
            <input
              placeholder="Contact person"
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
              className={cls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={cls}
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={cls}
            />
          </div>
          <textarea
            rows={2}
            placeholder="Billing address"
            value={form.billing_address}
            onChange={(e) => set("billing_address", e.target.value)}
            className={cls}
          />
          <textarea
            rows={2}
            placeholder="Shipping address"
            value={form.shipping_address}
            onChange={(e) => set("shipping_address", e.target.value)}
            className={cls}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Payment terms
              <select
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
                className={cls + " mt-1"}
              >
                {CUSTOMER_TERMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Opening balance (Rs.)
              <input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={(e) => set("opening_balance", e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>
          <textarea
            rows={2}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={cls}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            Active
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Accounting: chart of accounts, admin only ----------
// key = account_type stored in the database (must match backend/app/account_types.py)
// cogs / income / asset are the original item-linked types; the rest are the new Zoho-style types.
const ACCOUNT_TYPES = [
  { key: "cash", label: "Cash Accounts", name: "Cash account", group: "Asset" },
  { key: "bank", label: "Bank Accounts", name: "Bank account", group: "Asset" },
  {
    key: "accounts_receivable",
    label: "Accounts Receivable",
    name: "Accounts receivable",
    group: "Asset",
  },
  {
    key: "other_current_asset",
    label: "Other Current Assets",
    name: "Other current asset",
    group: "Asset",
  },
  {
    key: "asset",
    label: "Asset Accounts",
    name: "Asset account",
    group: "Asset",
  },
  {
    key: "fixed_asset",
    label: "Fixed Assets",
    name: "Fixed asset",
    group: "Asset",
  },
  {
    key: "accounts_payable",
    label: "Accounts Payable",
    name: "Accounts payable",
    group: "Liability",
  },
  {
    key: "credit_card",
    label: "Credit Cards",
    name: "Credit card",
    group: "Liability",
  },
  {
    key: "current_liability",
    label: "Other Current Liabilities",
    name: "Other current liability",
    group: "Liability",
  },
  {
    key: "long_term_liability",
    label: "Long Term Liabilities",
    name: "Long term liability",
    group: "Liability",
  },
  { key: "equity", label: "Equity", name: "Equity account", group: "Equity" },
  {
    key: "income",
    label: "Income Accounts",
    name: "Income account",
    group: "Income",
  },
  {
    key: "other_income",
    label: "Other Income",
    name: "Other income",
    group: "Income",
  },
  {
    key: "cogs",
    label: "Cost of Goods Sold (COGS) Accounts",
    name: "COGS account",
    group: "Expense",
  },
  {
    key: "expense",
    label: "Expenses",
    name: "Expense account",
    group: "Expense",
  },
  {
    key: "other_expense",
    label: "Other Expenses",
    name: "Other expense",
    group: "Expense",
  },
];
const ACCOUNT_GROUPS = ["Asset", "Liability", "Equity", "Income", "Expense"];
const ACCOUNT_GROUP_OF = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.key, t.group]),
);
// only these three can be picked on an item (Items form); they show stock value instead of ledger balance
const ITEM_LINKED_TYPES = new Set(["cogs", "income", "asset"]);

const formatRs = (n) =>
  `Rs.${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ACCOUNT_TYPE_NAMES = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.key, t.name]),
);

function TypedDeleteConfirm({ label, onConfirm, onCancel }) {
  const [value, setValue] = useState("");
  const expected = `DELETE ${label}`;
  const match = value.trim() === expected;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Delete "{label}"?
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          This can't be undone. Type{" "}
          <span className="font-mono font-semibold text-gray-700">
            {expected}
          </span>{" "}
          to confirm.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={expected}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!match}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
// ---------- Account detail: total value + the items behind it ----------
//   /?view=accounting&account=3
function AccountDetail({ accountId, go, fromParam }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const back = () => navigateFrom(fromParam, go, { view: "accounting" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAccountDetail(accountId)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const handleDelete = async () => {
    try {
      await deleteAccount(data.id);
      back();
    } catch (err) {
      alert(err.message);
    }
  };

  const basisLabel = data?.value_basis === "price" ? "sales price" : "cost";
  const itemLinked = data ? ITEM_LINKED_TYPES.has(data.account_type) : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader
        title={data?.name || "Account"}
        subtitle={data ? ACCOUNT_TYPE_NAMES[data.account_type] : undefined}
        onBack={back}
      />
      <main className="p-4 sm:p-6 w-full max-w-3xl space-y-6">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <dl className="space-y-2 text-sm">
                <DetailRow label="Category" value={data.category || "-"} />
                {data.account_code && (
                  <DetailRow label="Account code" value={data.account_code} />
                )}
                <DetailRow
                  label="Ledger balance"
                  value={formatRs(data.ledger_balance)}
                />
                {itemLinked && (
                  <>
                    <DetailRow
                      label="Total value"
                      value={formatRs(data.total_value)}
                    />
                    <DetailRow label="Items linked" value={data.item_count} />
                    <DetailRow
                      label="Calculated as"
                      value={`Stock quantity × ${basisLabel}`}
                    />
                  </>
                )}
                {data.description && (
                  <DetailRow label="Description" value={data.description} />
                )}
              </dl>
            </div>

            {itemLinked && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Items using this account{" "}
                  <span className="text-gray-400 font-normal">
                    ({data.items.length})
                  </span>
                </h2>
                {data.items.length === 0 ? (
                  <p className="text-gray-400 text-sm">
                    No items use this account yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.items.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() =>
                          go({ view: "items", item: String(i.id) })
                        }
                        className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {i.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {i.parent_name
                              ? `Subitem of ${i.parent_name} · `
                              : ""}
                            {i.quantity} × {formatRs(i.unit_value)}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-gray-900">
                          {formatRs(i.value)}
                        </span>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-gray-400"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowEditForm(true)}
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <Pencil size={16} /> Edit account
              </button>
              <Gate right="Delete account">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  <Trash2 size={16} /> Delete account
                </button>
              </Gate>
            </div>
          </>
        )}
      </main>

      {showDeleteConfirm && (
        <TypedDeleteConfirm
          label={data.name}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            handleDelete();
          }}
        />
      )}
      {showEditForm && (
        <AccountForm
          initialData={data}
          onClose={() => setShowEditForm(false)}
          onSubmit={async (id, payload) => {
            await updateAccount(id, payload);
            const refreshed = await getAccountDetail(accountId);
            setData(refreshed);
          }}
        />
      )}
    </div>
  );
}
// ---------- Accounting page: user-customisable layout (QuickBooks / Zoho style) ----------
const ACCT_THEMES = {
  quickbooks: {
    name: "QuickBooks Blue",
    swatch: ["#4b5b8c", "#8cc21f", "#e6eefb"],
    page: "bg-[#dfe7ef]",
    panel: "bg-white border-gray-300",
    strip: "bg-[#f1f3f6] border-gray-200",
    head: "bg-[#eef1f5] text-gray-500 border-gray-300",
    line: "border-gray-200",
    rowA: "bg-white",
    rowB: "bg-[#e6eefb]",
    hover: "",
    sel: "bg-[#4e9a1e] text-white",
    text: "text-gray-800",
    sub: "text-gray-500",
    selSub: "text-white/80",
    title: "text-gray-700",
    input: "bg-white border-gray-300 text-gray-800",
    btn: "bg-green-600 hover:bg-green-700 text-white",
    groupRow: "bg-[#d5e0f2] text-gray-700",
    boxText: "text-white",
    box: {
      Asset: "bg-[#4b5b8c]",
      Liability: "bg-[#f0b83a]",
      Equity: "bg-[#7d9cc0]",
      Income: "bg-[#8cc21f]",
      Expense: "bg-[#e0452b]",
    },
  },
  zoho: {
    name: "Zoho Light",
    swatch: ["#2563eb", "#ffffff", "#f4f5f9"],
    page: "bg-[#f4f5f9]",
    panel: "bg-white border-gray-200",
    strip: "bg-transparent border-transparent",
    head: "bg-[#f9fafc] text-gray-500 border-gray-200",
    line: "border-gray-100",
    rowA: "bg-white",
    rowB: "bg-white",
    hover: "hover:bg-[#f5f8ff]",
    sel: "bg-[#e7efff] text-[#1d4ed8]",
    text: "text-gray-800",
    sub: "text-gray-500",
    selSub: "text-blue-500",
    title: "text-gray-800",
    input: "bg-white border-gray-300 text-gray-800",
    btn: "bg-[#2563eb] hover:bg-blue-700 text-white",
    groupRow: "bg-[#f3f4f8] text-gray-600",
    boxText: "text-gray-800",
    box: {
      Asset: "bg-[#e0ebff]",
      Liability: "bg-[#fff0d6]",
      Equity: "bg-[#ece6ff]",
      Income: "bg-[#dcf5e4]",
      Expense: "bg-[#fde3e0]",
    },
  },
  dark: {
    name: "Dark",
    swatch: ["#0f172a", "#1e293b", "#2563eb"],
    page: "bg-[#0f172a]",
    panel: "bg-[#1e293b] border-slate-700",
    strip: "bg-[#162033] border-slate-700",
    head: "bg-[#273449] text-slate-300 border-slate-600",
    line: "border-slate-700",
    rowA: "bg-[#1e293b]",
    rowB: "bg-[#223047]",
    hover: "hover:bg-[#2a3a55]",
    sel: "bg-[#2563eb] text-white",
    text: "text-slate-100",
    sub: "text-slate-400",
    selSub: "text-white/80",
    title: "text-slate-100",
    input: "bg-[#0f172a] border-slate-600 text-slate-100",
    btn: "bg-[#2563eb] hover:bg-blue-500 text-white",
    groupRow: "bg-[#2d3b52] text-slate-200",
    boxText: "text-white",
    box: {
      Asset: "bg-[#334a7a]",
      Liability: "bg-[#8a6a1c]",
      Equity: "bg-[#4a5d7a]",
      Income: "bg-[#2f6b3a]",
      Expense: "bg-[#8a2f25]",
    },
  },
};

const ACCT_COLUMNS = [
  { key: "code", label: "Number" },
  { key: "name", label: "Account name" },
  { key: "type", label: "Type" },
  { key: "description", label: "Description" },
  { key: "balance", label: "Balance", right: true },
  { key: "items", label: "Items", right: true },
];

const ACCT_LAYOUT_KEY = "acct_layout_v1";
const ACCT_LAYOUT_DEFAULT = {
  theme: "quickbooks",
  view: "table", // "table" | "cards"
  density: "compact", // "compact" | "comfortable"
  showSummary: true,
  showFilters: true,
  striped: true,
  groupByType: false,
  cols: [
    { key: "code", visible: true },
    { key: "name", visible: true },
    { key: "type", visible: true },
    { key: "description", visible: true },
    { key: "balance", visible: true },
    { key: "items", visible: false },
  ],
};

// saved on this device (localStorage); survives refresh
function useAccountLayout() {
  const { company } = useCompany();
  const storageKey = company?.id
    ? `${ACCT_LAYOUT_KEY}:${company.id}`
    : ACCT_LAYOUT_KEY;

  const readLayout = (key) => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && typeof saved === "object") {
        const known = ACCT_LAYOUT_DEFAULT.cols.map((c) => c.key);
        const savedCols = (saved.cols || []).filter((c) =>
          known.includes(c.key),
        );
        const missing = ACCT_LAYOUT_DEFAULT.cols.filter(
          (c) => !savedCols.some((s) => s.key === c.key),
        );
        return {
          ...ACCT_LAYOUT_DEFAULT,
          ...saved,
          theme: ACCT_THEMES[saved.theme]
            ? saved.theme
            : ACCT_LAYOUT_DEFAULT.theme,
          cols: [...savedCols, ...missing],
        };
      }
    } catch (e) {
      /* ignore broken saved data */
    }
    return ACCT_LAYOUT_DEFAULT;
  };

  const [layout, setLayout] = useState(() => readLayout(storageKey));
  useEffect(() => {
    setLayout(readLayout(storageKey));
  }, [storageKey]);

  const save = (next) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
      /* storage blocked */
    }
    return next;
  };
  const update = (patch) => setLayout((prev) => save({ ...prev, ...patch }));
  const reset = () => setLayout(save(ACCT_LAYOUT_DEFAULT));
  return [layout, update, reset];
}
function orderAccountTree(list) {
  const ids = new Set(list.map((a) => a.id));
  const kids = new Map();
  const roots = [];
  list.forEach((a) => {
    if (a.parent_id && ids.has(a.parent_id)) {
      if (!kids.has(a.parent_id)) kids.set(a.parent_id, []);
      kids.get(a.parent_id).push(a);
    } else {
      roots.push(a);
    }
  });
  const out = [];
  const walk = (a, depth) => {
    out.push({ ...a, _depth: depth, _isParent: kids.has(a.id) });
    (kids.get(a.id) || []).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}

function AccountingPage({ isAdmin, go }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));

  const [layout, updateLayout, resetLayout] = useAccountLayout();
  const [panelOpen, setPanelOpen] = useState(false);
  const t = ACCT_THEMES[layout.theme] || ACCT_THEMES.quickbooks;
  const pad = layout.density === "compact" ? "py-1" : "py-2.5";

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    try {
      setAccounts(await getAccountsSummary());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const balanceOf = (a) =>
    ITEM_LINKED_TYPES.has(a.account_type) ? a.total_value : a.ledger_balance;
  const openAccount = (a) => go({ view: "accounting", account: String(a.id) });

  const groupTotals = ACCOUNT_GROUPS.map((g) => {
    const list = accounts.filter((a) => ACCOUNT_GROUP_OF[a.account_type] === g);
    return {
      g,
      count: list.length,
      total: list.reduce((s, a) => s + Number(balanceOf(a) || 0), 0),
    };
  });

  const sortVal = (key, a) => {
    if (key === "balance") return Number(balanceOf(a) || 0);
    if (key === "items") return Number(a.item_count || 0);
    if (key === "type") return ACCOUNT_TYPE_NAMES[a.account_type] || "";
    if (key === "code") return a.account_code || "";
    if (key === "description") return a.description || "";
    return a.name || "";
  };

  const q = search.trim().toLowerCase();
  const rows = accounts
    .filter(
      (a) =>
        groupFilter === "all" ||
        ACCOUNT_GROUP_OF[a.account_type] === groupFilter,
    )
    .filter((a) => typeFilter === "all" || a.account_type === typeFilter)
    .filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.account_code || "").toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const x = sortVal(sort.key, a);
      const y = sortVal(sort.key, b);
      const r =
        typeof x === "number"
          ? x - y
          : compareNames(x, y) || compareNames(a.name, b.name);
      return sort.dir === "asc" ? r : -r;
    });

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  const visCols = layout.cols
    .filter((c) => c.visible)
    .map((c) => ACCT_COLUMNS.find((x) => x.key === c.key))
    .filter(Boolean);

  const sections = layout.groupByType
    ? ACCOUNT_TYPES.map((tp) => ({
        key: tp.key,
        title: tp.label,
        list: orderAccountTree(rows.filter((a) => a.account_type === tp.key)),
      })).filter((s) => s.list.length > 0)
    : [{ key: "all", title: null, list: orderAccountTree(rows) }];

  const cell = (key, a, selected) => {
    const sub = selected ? t.selSub : t.sub;
    const linked = ITEM_LINKED_TYPES.has(a.account_type);
    switch (key) {
      case "code":
        return a.account_code || "";
      case "name":
        return (
          <span
            className={a._isParent ? "font-semibold" : "font-medium"}
            style={{ paddingLeft: (a._depth || 0) * 18 }}
          >
            {a._depth > 0 && <span className="mr-1 opacity-60">↳</span>}
            {a.name}
          </span>
        );
      case "type":
        return ACCOUNT_TYPE_NAMES[a.account_type] || a.account_type;
      case "description":
        return <span className={sub}>{a.description || ""}</span>;
      case "balance":
        return (
          <>
            {formatRs(balanceOf(a))}
            {linked && a.ledger_balance !== 0 && (
              <span className={`block text-[10px] ${sub}`}>
                Ledger {formatRs(a.ledger_balance)}
              </span>
            )}
          </>
        );
      case "items":
        return linked ? a.item_count : "";
      default:
        return "";
    }
  };

  // ---- customize-panel helpers ----
  const moveCol = (i, d) => {
    const next = [...layout.cols];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updateLayout({ cols: next });
  };
  const toggleCol = (key) => {
    const visibleCount = layout.cols.filter((c) => c.visible).length;
    updateLayout({
      cols: layout.cols.map((c) =>
        c.key === key
          ? {
              ...c,
              visible: c.visible && visibleCount <= 1 ? true : !c.visible,
            }
          : c,
      ),
    });
  };
  const segBtn = (label, active, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-sm border ${active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
    >
      {label}
    </button>
  );
  const checkRow = (label, key) => (
    <label className="flex items-center gap-2 text-sm text-gray-700 py-1">
      <input
        type="checkbox"
        checked={layout[key]}
        onChange={(e) => updateLayout({ [key]: e.target.checked })}
      />
      {label}
    </label>
  );

  const inputCls = `border rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-blue-500 ${t.input}`;

  return (
    <div className={`min-h-screen ${t.page}`}>
      <AppHeader
        isAdmin={isAdmin}
        active="accounting"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-3 sm:p-4 space-y-3">
        {/* ---- title row ---- */}
        <div className="flex items-center justify-between gap-2">
          <h1 className={`text-base font-semibold ${t.title}`}>
            Chart of Accounts
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm border ${t.panel} ${t.text}`}
            >
              <Settings size={14} /> Customize
            </button>
            <button
              onClick={() => setFormOpen(true)}
              className={`${t.btn} px-4 py-1.5 rounded-sm text-sm font-medium`}
            >
              + Add Account
            </button>
          </div>
        </div>

        {/* ---- summary strip ---- */}
        {layout.showSummary && (
          <div className={`border p-3 ${t.strip}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
              {groupTotals.map(({ g, count, total }) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGroupFilter(groupFilter === g ? "all" : g);
                    setTypeFilter("all");
                  }}
                  className={`${t.box[g]} ${t.boxText} text-left px-3 py-2 ${groupFilter === g ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                >
                  <span className="block text-[10px] uppercase tracking-wide opacity-90">
                    {g}
                  </span>
                  <span className="block text-lg font-semibold leading-tight">
                    {formatRs(total)}
                  </span>
                  <span className="block text-[10px] uppercase opacity-90">
                    {count} account{count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- list panel ---- */}
        <div className={`border ${t.panel}`}>
          {layout.showFilters && (
            <div
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border-b ${t.line}`}
            >
              <label
                className={`flex items-center gap-2 text-[11px] uppercase ${t.sub}`}
              >
                Search
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or code"
                  className={`${inputCls} normal-case w-44`}
                />
              </label>
              <label
                className={`flex items-center gap-2 text-[11px] uppercase ${t.sub}`}
              >
                Group
                <select
                  value={groupFilter}
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setTypeFilter("all");
                  }}
                  className={`${inputCls} normal-case`}
                >
                  <option value="all">All</option>
                  {ACCOUNT_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className={`flex items-center gap-2 text-[11px] uppercase ${t.sub}`}
              >
                Type
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={`${inputCls} normal-case`}
                >
                  <option value="all">All</option>
                  {ACCOUNT_TYPES.filter(
                    (tp) => groupFilter === "all" || tp.group === groupFilter,
                  ).map((tp) => (
                    <option key={tp.key} value={tp.key}>
                      {tp.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {loading ? (
            <p className="text-gray-400 text-center py-16">Loading...</p>
          ) : error ? (
            <p className="text-red-500 text-center py-16">{error}</p>
          ) : rows.length === 0 ? (
            <p className={`text-center py-10 ${t.sub}`}>No accounts found.</p>
          ) : layout.view === "cards" ? (
            /* ---------- CARDS layout ---------- */
            <div className="p-3 space-y-4">
              {sections.map((s) => (
                <div key={s.key}>
                  {s.title && (
                    <h2
                      className={`text-xs font-semibold uppercase mb-2 ${t.sub}`}
                    >
                      {s.title} ({s.list.length})
                    </h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {s.list.map((a) => {
                      const selected = a.id === selectedId;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          data-account-id={a.id}
                          onClick={() => setSelectedId(a.id)}
                          onDoubleClick={() => openAccount(a)}
                          className={`text-left border rounded-md p-3 ${t.line} ${selected ? t.sel : `${t.rowA} ${t.text} ${t.hover}`}`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-medium truncate">
                              {a.account_code ? `${a.account_code} · ` : ""}
                              {a.name}
                            </span>
                            <span className="font-semibold shrink-0">
                              {formatRs(balanceOf(a))}
                            </span>
                          </span>
                          <span
                            className={`block text-xs mt-0.5 ${selected ? t.selSub : t.sub}`}
                          >
                            {ACCOUNT_TYPE_NAMES[a.account_type] ||
                              a.account_type}
                          </span>
                          {a.description && (
                            <span
                              className={`block text-xs mt-1 truncate ${selected ? t.selSub : t.sub}`}
                            >
                              {a.description}
                            </span>
                          )}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              openAccount(a);
                            }}
                            className={`inline-block mt-2 text-xs underline ${selected ? "text-white" : "text-blue-600"}`}
                          >
                            Open
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ---------- TABLE layout ---------- */
            <div className="overflow-x-auto max-h-[calc(100vh-330px)] overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className={`sticky top-0 z-10 border-b ${t.head}`}>
                  <tr>
                    {visCols.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key)}
                        className={`px-3 ${pad} text-[11px] font-semibold uppercase tracking-wide border-r ${t.line} cursor-pointer select-none whitespace-nowrap ${c.right ? "text-right" : "text-left"}`}
                      >
                        {c.label}
                        {sort.key === c.key && (
                          <span className="ml-1 text-[9px]">
                            {sort.dir === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </th>
                    ))}
                    <th
                      className={`px-3 ${pad} text-left text-[11px] font-semibold uppercase tracking-wide w-24`}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                {sections.map((s) => (
                  <tbody key={s.key} className={t.text}>
                    {s.title && (
                      <tr className={t.groupRow}>
                        <td
                          colSpan={visCols.length + 1}
                          className={`px-3 ${pad} text-xs font-semibold uppercase`}
                        >
                          <span className="flex justify-between">
                            <span>
                              {s.title} ({s.list.length})
                            </span>
                            <span>
                              {formatRs(
                                s.list.reduce(
                                  (sum, a) => sum + Number(balanceOf(a) || 0),
                                  0,
                                ),
                              )}
                            </span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {s.list.map((a, i) => {
                      const selected = a.id === selectedId;
                      const bg = selected
                        ? t.sel
                        : `${layout.striped && i % 2 ? t.rowB : t.rowA} ${t.hover}`;
                      return (
                        <tr
                          key={a.id}
                          data-account-id={a.id}
                          onClick={() => setSelectedId(a.id)}
                          onDoubleClick={() => openAccount(a)}
                          className={`cursor-pointer ${bg}`}
                        >
                          {visCols.map((c) => (
                            <td
                              key={c.key}
                              className={`px-3 ${pad} whitespace-nowrap ${c.right ? "text-right" : ""} ${c.key === "description" ? "max-w-[16rem] truncate" : ""}`}
                            >
                              {cell(c.key, a, selected)}
                            </td>
                          ))}
                          <td className={`px-3 ${pad}`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAccount(a);
                              }}
                              className="px-2 py-0.5 text-xs border rounded-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          )}

          <div
            className={`flex justify-end px-3 py-2 border-t text-xs ${t.line} ${t.sub}`}
          >
            Showing {rows.length ? 1 : 0} - {rows.length} of {accounts.length}
          </div>
        </div>
      </main>

      {/* ---------- Customize panel (slides in from the right) ---------- */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white h-full overflow-y-auto p-5 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Customize layout
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Theme
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(ACCT_THEMES).map(([key, th]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateLayout({ theme: key })}
                    className={`flex items-center gap-3 border rounded-md px-3 py-2 text-left text-sm ${layout.theme === key ? "border-blue-600 ring-1 ring-blue-600" : "border-gray-300 hover:bg-gray-50"}`}
                  >
                    <span className="flex">
                      {th.swatch.map((c) => (
                        <span
                          key={c}
                          className="w-5 h-5 border border-gray-300"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    <span className="text-gray-800">{th.name}</span>
                    {layout.theme === key && (
                      <span className="ml-auto text-blue-600">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Layout
              </h3>
              <div className="flex">
                {segBtn("Table", layout.view === "table", () =>
                  updateLayout({ view: "table" }),
                )}
                {segBtn("Cards", layout.view === "cards", () =>
                  updateLayout({ view: "cards" }),
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Row density
              </h3>
              <div className="flex">
                {segBtn("Compact", layout.density === "compact", () =>
                  updateLayout({ density: "compact" }),
                )}
                {segBtn("Comfortable", layout.density === "comfortable", () =>
                  updateLayout({ density: "comfortable" }),
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Show
              </h3>
              {checkRow("Summary boxes (top strip)", "showSummary")}
              {checkRow("Filter bar", "showFilters")}
              {checkRow("Striped rows", "striped")}
              {checkRow("Group by account type", "groupByType")}
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Columns (table layout)
              </h3>
              <div className="space-y-1">
                {layout.cols.map((c, i) => {
                  const def = ACCT_COLUMNS.find((x) => x.key === c.key);
                  if (!def) return null;
                  return (
                    <div
                      key={c.key}
                      className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={c.visible}
                        onChange={() => toggleCol(c.key)}
                      />
                      <span className="flex-1 text-sm text-gray-800">
                        {def.label}
                      </span>
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => moveCol(i, -1)}
                        className="px-1 text-gray-500 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={i === layout.cols.length - 1}
                        onClick={() => moveCol(i, 1)}
                        className="px-1 text-gray-500 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetLayout}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Your layout is saved automatically on this device.
            </p>
          </div>
        </div>
      )}

      {formOpen && (
        <AccountForm
          onClose={() => setFormOpen(false)}
          onSubmit={async (payload) => {
            await createAccount(payload);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AccountForm({ initialData, onClose, onSubmit }) {
  const isEditMode = Boolean(initialData);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    account_type: initialData?.account_type || "cogs",
    account_code: initialData?.account_code || "",
    description: initialData?.description || "",
    parent_id: initialData?.parent_id || "",
  });
  const [allAccounts, setAllAccounts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAccountsSummary()
      .then(setAllAccounts)
      .catch(() => {});
  }, []);

  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      ...form,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
    };
    try {
      if (isEditMode) {
        await onSubmit(initialData.id, payload);
      } else {
        await onSubmit(payload);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {isEditMode ? "Edit Account" : "Add Account"}
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Account name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={fieldCls}
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Account type
            </label>
            <select
              value={form.account_type}
              onChange={(e) => {
                handleChange("account_type", e.target.value);
                handleChange("parent_id", "");
              }}
              className={fieldCls}
            >
              {ACCOUNT_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {ACCOUNT_TYPES.filter((t) => t.group === g).map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Sub-account of (optional)
            </label>
            <select
              value={form.parent_id}
              onChange={(e) => handleChange("parent_id", e.target.value)}
              className={fieldCls}
            >
              <option value="">- None (main account) -</option>
              {allAccounts
                .filter(
                  (a) =>
                    a.account_type === form.account_type &&
                    a.id !== initialData?.id,
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <input
            placeholder="Account code (optional)"
            value={form.account_code}
            onChange={(e) => handleChange("account_code", e.target.value)}
            className={fieldCls}
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            className={fieldCls}
          />
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Manual journals + trial balance (admin only) ----------
const formatJournalDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function JournalsPage({ isAdmin, go }) {
  const [tab, setTab] = useState("journals"); // "journals" | "trial"
  const [journals, setJournals] = useState([]);
  const [trial, setTrial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [j, t] = await Promise.all([getJournals(), getTrialBalance()]);
      setJournals(j);
      setTrial(t);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    try {
      await deleteJournal(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const totalDebit = trial.reduce((s, r) => s + r.debit, 0);
  const totalCredit = trial.reduce((s, r) => s + r.credit, 0);

  const subTab = (id, label) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
        tab === id
          ? "bg-blue-600 text-white"
          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="journals"
        onTab={(t) => go(t === "home" ? {} : { view: t })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex items-center gap-2">
          {subTab("journals", "Journals")}
          {subTab("trial", "Trial balance")}
          <div className="flex-1" />
          {tab === "journals" && (
            <button
              onClick={() => setFormOpen(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
            >
              + New Journal
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : tab === "journals" ? (
          journals.length === 0 ? (
            <p className="text-gray-400 text-center py-16">
              No manual journals yet.
            </p>
          ) : (
            <div className="space-y-2">
              {journals.map((j) => (
                <div
                  key={j.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expandedId === j.id ? null : j.id)
                    }
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {j.journal_number}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(j.journal_date)}
                        {(j.reference || j.notes) &&
                          ` · ${j.reference || j.notes}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-gray-900">
                      {formatRs(j.total)}
                    </span>
                    {expandedId === j.id ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {expandedId === j.id && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {j.notes && (
                        <p className="text-sm text-gray-600">{j.notes}</p>
                      )}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase text-left">
                            <th className="font-medium pb-1">Account</th>
                            <th className="font-medium pb-1 text-right">
                              Debit
                            </th>
                            <th className="font-medium pb-1 text-right">
                              Credit
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {j.lines.map((l) => (
                            <tr key={l.id} className="border-t border-gray-50">
                              <td className="py-1.5 pr-2">
                                <p className="text-gray-900">
                                  {l.account_name}
                                </p>
                                {l.description && (
                                  <p className="text-xs text-gray-400">
                                    {l.description}
                                  </p>
                                )}
                              </td>
                              <td className="py-1.5 text-right">
                                {l.debit > 0 ? formatRs(l.debit) : ""}
                              </td>
                              <td className="py-1.5 text-right">
                                {l.credit > 0 ? formatRs(l.credit) : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Gate right="delete_records">
                        <button
                          onClick={() => setDeleteTarget(j)}
                          className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Delete journal
                        </button>
                      </Gate>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : trial.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            Nothing to show yet. Add a journal first.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase text-left">
                  <th className="font-medium pb-1">Account</th>
                  <th className="font-medium pb-1 text-right">Debit</th>
                  <th className="font-medium pb-1 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((r) => (
                  <tr key={r.account_id} className="border-t border-gray-50">
                    <td className="py-1.5 pr-2">
                      <p className="text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-400">
                        {ACCOUNT_TYPE_NAMES[r.account_type] || r.account_type}
                      </p>
                    </td>
                    <td className="py-1.5 text-right">
                      {r.debit > 0 ? formatRs(r.debit) : ""}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.credit > 0 ? formatRs(r.credit) : ""}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{formatRs(totalDebit)}</td>
                  <td className="py-2 text-right">{formatRs(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
            <p
              className={`mt-2 text-xs ${Math.abs(totalDebit - totalCredit) < 0.005 ? "text-green-600" : "text-red-600"}`}
            >
              {Math.abs(totalDebit - totalCredit) < 0.005
                ? "Balanced: debits equal credits."
                : "Out of balance!"}
            </p>
          </div>
        )}
      </main>

      {formOpen && (
        <JournalForm onClose={() => setFormOpen(false)} onSaved={load} />
      )}

      {deleteTarget && (
        <TypedDeleteConfirm
          label={deleteTarget.journal_number}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

const blankJournalLine = () => ({
  account_id: "",
  debit: "",
  credit: "",
  description: "",
});
const toCents = (v) => Math.round((Number(v) || 0) * 100);

function JournalForm({ onClose, onSaved }) {
  const [accounts, setAccounts] = useState([]);
  const [date, setDate] = useState(toISODate(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([blankJournalLine(), blankJournalLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    getAccounts()
      .then(setAccounts)
      .catch((err) => setError(err.message));
  }, []);

  const setLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );

  const totalDebit = lines.reduce((s, l) => s + toCents(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toCents(l.credit), 0);
  const hasAmount = (l) => toCents(l.debit) > 0 || toCents(l.credit) > 0;
  const filled = lines.filter((l) => l.account_id && hasAmount(l));
  const missingAccount = lines.some((l) => hasAmount(l) && !l.account_id);
  const canSave =
    filled.length >= 2 &&
    !missingAccount &&
    totalDebit === totalCredit &&
    totalDebit > 0;
  const difference = (totalDebit - totalCredit) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createJournal({
        journal_date: date,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        lines: filled.map((l) => ({
          account_id: Number(l.account_id),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description.trim() || null,
        })),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">New Manual Journal</h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Reference
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>
          <textarea
            rows={2}
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cls}
          />

          <div className="space-y-3">
            {lines.map((l, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-lg p-3 space-y-2"
              >
                <select
                  value={l.account_id}
                  onChange={(e) => setLine(i, { account_id: e.target.value })}
                  className={cls}
                >
                  <option value="">Select account...</option>
                  {ACCOUNT_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {accounts
                        .filter((a) => ACCOUNT_GROUP_OF[a.account_type] === g)
                        .sort((a, b) => compareNames(a.name, b.name))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Debit"
                    value={l.debit}
                    onChange={(e) =>
                      setLine(i, {
                        debit: e.target.value,
                        credit: e.target.value ? "" : l.credit,
                      })
                    }
                    className={cls}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Credit"
                    value={l.credit}
                    onChange={(e) =>
                      setLine(i, {
                        credit: e.target.value,
                        debit: e.target.value ? "" : l.debit,
                      })
                    }
                    className={cls}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="Description (optional)"
                    value={l.description}
                    onChange={(e) =>
                      setLine(i, { description: e.target.value })
                    }
                    className={cls}
                  />
                  {lines.length > 2 && (
                    <button
                      type="button"
                      title="Remove line"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="shrink-0 border border-gray-300 rounded-lg px-3 text-gray-500 hover:bg-gray-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, blankJournalLine()])}
              className="text-sm text-blue-600 font-medium inline-flex items-center gap-1"
            >
              <Plus size={14} /> Add another line
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Total debit</span>
              <span>{formatRs(totalDebit / 100)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total credit</span>
              <span>{formatRs(totalCredit / 100)}</span>
            </div>
            <div
              className={`flex justify-between font-semibold ${difference === 0 ? "text-green-600" : "text-red-600"}`}
            >
              <span>Difference</span>
              <span>{formatRs(Math.abs(difference))}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Journal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Invoices (sales: lowers stock + posts to the ledger, admin only) ----------
const INVOICE_TERM_DAYS = {
  "Due on Receipt": 0,
  "Net 15": 15,
  "Net 30": 30,
  "Net 45": 45,
  "Net 60": 60,
};
const STOCK_TRACKED_TYPE = "Inventory Part"; // only this item type has stock that goes down when sold

const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const primaryImageOf = (product) =>
  product?.images?.find((i) => i.is_primary) || product?.images?.[0];

// small square picture of an item (falls back to a tag icon when it has no image)
function ItemThumb({ product, size = 40 }) {
  const img = primaryImageOf(product);
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-gray-300"
    >
      {img ? (
        <img
          src={img.image_url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <Tag size={Math.round(size / 2)} />
      )}
    </div>
  );
}

function invoiceStatus(inv) {
  if (inv.status === "void")
    return { label: "Void", cls: "bg-gray-100 text-gray-500" };
  if (inv.balance_due <= 0.004)
    return { label: "Paid", cls: "bg-green-100 text-green-700" };
  if (inv.due_date < toISODate(new Date()))
    return { label: "Overdue", cls: "bg-red-100 text-red-700" };
  if (inv.amount_paid > 0)
    return { label: "Partially paid", cls: "bg-amber-100 text-amber-700" };
  return { label: "Open", cls: "bg-blue-100 text-blue-700" };
}

function InvoicesPage({ isAdmin, go }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [previewFor, setPreviewFor] = useState(null); // the saved invoice being previewed

  const load = async () => {
    try {
      setInvoices(await getInvoices());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  const [payFor, setPayFor] = useState(null); // the invoice whose "Record payment" button was pressed
  const [creditFor, setCreditFor] = useState(null); // the invoice whose "Credit note" button was pressed
  const [editFor, setEditFor] = useState(null); // the invoice whose "Edit invoice" button was pressed
  const handleVoid = async (inv) => {
    if (
      !window.confirm(
        `Void ${inv.invoice_number}? The stock goes back and its ledger entry is removed.`,
      )
    )
      return;
    try {
      await voidInvoice(inv.id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (inv) => {
    if (
      !window.confirm(
        `Permanently delete ${inv.invoice_number}? This can't be undone.`,
      )
    )
      return;
    try {
      await deleteInvoice(inv.id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = invoices.filter(
    (inv) =>
      !q ||
      [inv.invoice_number, inv.customer_name, inv.order_number].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="invoices"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <div className="flex-1">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search invoices..."
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + New Invoice
          </button>
          <button
            onClick={() => setFindOpen(true)}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
          >
            <Search size={14} /> Find
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((inv) => {
              const st = invoiceStatus(inv);
              const open = expandedId === inv.id;
              return (
                <div
                  key={inv.id}
                  id={`inv-${inv.id}`}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : inv.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {inv.invoice_number}{" "}
                        <span className="text-gray-400 font-normal">
                          · {inv.customer_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(inv.invoice_date)} · Due{" "}
                        {formatJournalDate(inv.due_date)}
                        {inv.order_number && ` · PO ${inv.order_number}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900">
                        {formatRs(inv.total)}
                      </p>
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    {open ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {inv.items.map((l) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <ItemThumb product={l.product} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {l.description || l.item_name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {l.quantity} × {formatRs(l.rate)}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-gray-900 shrink-0">
                            {formatRs(l.amount)}
                          </span>
                        </div>
                      ))}

                      {inv.notes && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                          {inv.notes}
                        </p>
                      )}

                      <div className="border-t border-gray-100 pt-2 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total</span>
                          <span>{formatRs(inv.total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Paid</span>
                          <span>{formatRs(inv.amount_paid)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Balance due</span>
                          <span>{formatRs(inv.balance_due)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPreviewFor(inv)}
                          className="inline-flex items-center gap-2 border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50"
                        >
                          <FileText size={14} /> Preview
                        </button>
                        <button
                          onClick={() => downloadPdf("invoice", inv)}
                          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                          <Download size={14} /> Download PDF
                        </button>

                        <button
                          onClick={() => sendWhatsApp("invoice", inv)}
                          className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          <MessageCircle size={14} /> Send WhatsApp
                        </button>
                        <HistoryLink type="invoice" id={inv.id} />
                      </div>

                      {inv.status !== "void" && (
                        <div className="flex flex-wrap gap-2">
                          {inv.amount_paid <= 0.004 && (
                            <button
                              onClick={() => setEditFor(inv)}
                              className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                            >
                              <Pencil size={14} /> Edit invoice
                            </button>
                          )}
                          {inv.balance_due > 0.004 && (
                            <button
                              onClick={() => setPayFor(inv)}
                              className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                            >
                              <Wallet size={14} /> Record payment
                            </button>
                          )}
                          <button
                            onClick={() => setCreditFor(inv)}
                            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                          >
                            <RotateCcw size={14} /> Credit note
                          </button>
                          <Gate right="void_transactions">
                            <button
                              onClick={() => handleVoid(inv)}
                              className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                            >
                              <Trash2 size={14} /> Void invoice
                            </button>
                          </Gate>
                        </div>
                      )}
                      {inv.status === "void" && (
                        <div className="flex flex-wrap gap-2">
                          <Gate right="delete_records">
                            <button
                              onClick={() => handleDelete(inv)}
                              className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                            >
                              <Trash2 size={14} /> Delete invoice
                            </button>
                          </Gate>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <InvoiceForm onClose={() => setFormOpen(false)} onSaved={load} />
      )}

      {editFor && (
        <InvoiceForm
          editInvoice={editFor}
          onClose={() => setEditFor(null)}
          onSaved={load}
        />
      )}

      {creditFor && (
        <CreditNoteForm
          fromInvoice={creditFor}
          onClose={() => setCreditFor(null)}
          onSaved={load}
        />
      )}

      {payFor && (
        <PaymentForm
          initialCustomerId={payFor.customer_id}
          initialInvoiceId={payFor.id}
          onClose={() => setPayFor(null)}
          onSaved={load}
        />
      )}

      {findOpen && (
        <InvoiceFindModal
          invoices={invoices}
          onClose={() => setFindOpen(false)}
          onGoTo={(inv) => {
            setSearch("");
            setExpandedId(inv.id);
            setFindOpen(false);
            setTimeout(
              () =>
                document
                  .getElementById(`inv-${inv.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
              80,
            );
          }}
        />
      )}
      {previewFor && (
        <InvoicePreviewModal
          invoice={previewFor}
          onClose={() => setPreviewFor(null)}
        />
      )}
    </div>
  );
}

// Preview of a saved invoice (the same PDF as "Download PDF", shown on screen)
function InvoicePreviewModal({ invoice, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    (async () => {
      try {
        const [pdf, customers] = await Promise.all([
          import("./pdf.js"),
          getCustomers().catch(() => []),
        ]);
        const customer = customers.find((c) => c.id === invoice.customer_id);
        const file = await pdf.downloadInvoicePdf(invoice, customer, true);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not create the preview");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {invoice.invoice_number} · {invoice.customer_name}
          </h3>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                Open in new tab
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
        {error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : !url ? (
          <p className="text-gray-400 text-center py-16">
            Preparing preview...
          </p>
        ) : (
          <iframe
            src={url}
            title="Invoice preview"
            className="flex-1 w-full rounded-b-xl"
          />
        )}
      </div>
    </div>
  );
}

// QuickBooks-style "Find Invoices": customer, number, PO, status, date range, amount range
function InvoiceFindModal({ invoices, onGoTo, onClose }) {
  const blank = {
    customer: "",
    number: "",
    po: "",
    status: "all",
    from: "",
    to: "",
    min: "",
    max: "",
  };
  const [f, setF] = useState(blank);
  const [results, setResults] = useState(null); // null = nothing searched yet
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runFind = (e) => {
    e?.preventDefault();
    const has = (v, q) =>
      (v || "").toLowerCase().includes(q.trim().toLowerCase());
    setResults(
      invoices.filter((inv) => {
        if (f.customer && !has(inv.customer_name, f.customer)) return false;
        if (f.number && !has(inv.invoice_number, f.number)) return false;
        if (f.po && !has(inv.order_number, f.po)) return false;
        if (f.status !== "all" && invoiceStatus(inv).label !== f.status)
          return false;
        if (f.from && inv.invoice_date < f.from) return false;
        if (f.to && inv.invoice_date > f.to) return false;
        if (f.min !== "" && inv.total < Number(f.min)) return false;
        if (f.max !== "" && inv.total > Number(f.max)) return false;
        return true;
      }),
    );
  };

  const reset = () => {
    setF(blank);
    setResults(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Find Invoices</h2>
        <form onSubmit={runFind} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">
              Customer
              <input
                autoFocus
                value={f.customer}
                onChange={(e) => set({ customer: e.target.value })}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Invoice no.
              <input
                value={f.number}
                onChange={(e) => set({ number: e.target.value })}
                placeholder="e.g. INV-0012"
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Order / PO number
              <input
                value={f.po}
                onChange={(e) => set({ po: e.target.value })}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Status
              <select
                value={f.status}
                onChange={(e) => set({ status: e.target.value })}
                className={cls + " mt-1"}
              >
                <option value="all">All</option>
                <option>Open</option>
                <option>Overdue</option>
                <option>Partially paid</option>
                <option>Paid</option>
                <option>Void</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Date from
              <input
                type="date"
                value={f.from}
                onChange={(e) => set({ from: e.target.value })}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Date to
              <input
                type="date"
                value={f.to}
                min={f.from}
                onChange={(e) => set({ to: e.target.value })}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Amount from
              <input
                type="number"
                min="0"
                step="0.01"
                value={f.min}
                onChange={(e) => set({ min: e.target.value })}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Amount to
              <input
                type="number"
                min="0"
                step="0.01"
                value={f.max}
                onChange={(e) => set({ max: e.target.value })}
                className={cls + " mt-1"}
              />
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Find
            </button>
            <button
              type="button"
              onClick={reset}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </form>

        {results && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">
              {results.length} invoice{results.length === 1 ? "" : "s"} found
            </p>
            {results.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">No.</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Amount</th>
                      <th className="text-right px-3 py-2">Balance</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((inv) => {
                      const st = invoiceStatus(inv);
                      return (
                        <tr
                          key={inv.id}
                          onDoubleClick={() => onGoTo(inv)}
                          className="border-t border-gray-100 hover:bg-blue-50/40"
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatJournalDate(inv.invoice_date)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">
                            {inv.invoice_number}
                          </td>
                          <td className="px-3 py-2">{inv.customer_name}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formatRs(inv.total)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formatRs(inv.balance_due)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => onGoTo(inv)}
                              className="text-blue-600 text-xs font-medium hover:underline"
                            >
                              Go To
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Small popup shown when a typed customer name isn't in the list: name + optional phone / address
function QuickCustomerModal({ initialName, onSave, onClose }) {
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        customer_type: "Business",
        display_name: name.trim(),
        phone: phone.trim() || null,
        billing_address: address.trim() || null,
        shipping_address: address.trim() || null,
        payment_terms: "Due on Receipt",
        opening_balance: 0,
        is_active: true,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-1">New customer</h2>
        <p className="text-xs text-gray-500 mb-4">
          Phone number and address are optional.
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-gray-500">
            Customer name *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls + " mt-1"}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Phone number (optional)
            <input
              autoFocus
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cls + " mt-1"}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Address (optional)
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={cls + " mt-1"}
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Small popup shown when a typed item name isn't in the list: name + type + optional price
function QuickItemModal({ initialName, onSave, onClose }) {
  const [name, setName] = useState(initialName || "");
  const [itemType, setItemType] = useState("Inventory Part");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        item_type: itemType,
        price: Number(price) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-1">New item</h2>
        <p className="text-xs text-gray-500 mb-4">
          Selling price is optional. You can edit the item fully later in
          Products.
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-gray-500">
            Item name *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls + " mt-1"}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Item type
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className={cls + " mt-1"}
            >
              {ITEM_TYPES.filter((t) => t !== "Inventory Assembly").map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-500">
            Selling price (optional)
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={cls + " mt-1"}
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INVOICE_ROW_GRID =
  "grid grid-cols-2 gap-2 sm:grid-cols-[28px_minmax(0,2fr)_minmax(0,1.2fr)_64px_96px_96px_32px] sm:items-center";

const blankInvoiceLine = () => ({
  product_id: "",
  description: "",
  quantity: "1",
  rate: "",
});


function InvoiceForm({ fromDoc = null, editInvoice = null, onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [customerId, setCustomerId] = useState(
    editInvoice ? editInvoice.customer_id : fromDoc ? fromDoc.customer_id : "",
  );
  const [date, setDate] = useState(
    editInvoice ? editInvoice.invoice_date : toISODate(new Date()),
  );
  const [dueDate, setDueDate] = useState(
    editInvoice ? editInvoice.due_date : "",
  ); // empty = follow the customer's payment terms
  const [orderNumber, setOrderNumber] = useState(
    editInvoice?.order_number || fromDoc?.reference || "",
  );
  const [notes, setNotes] = useState(
    editInvoice?.notes || fromDoc?.notes || "",
  );
  const [discountType, setDiscountType] = useState(
    editInvoice?.discount_type || "amount",
  ); // "amount" (Rs) or "percent"
  const [discountValue, setDiscountValue] = useState(
    editInvoice && Number(editInvoice.discount_value) > 0
      ? String(editInvoice.discount_value)
      : "",
  );
  const [lines, setLines] = useState(
    editInvoice && editInvoice.items.some((l) => l.product_id)
      ? editInvoice.items
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: l.product_id,
            description: l.description || l.item_name || "",
            quantity: String(l.quantity),
            rate: String(l.rate),
          }))
      : fromDoc && fromDoc.items.some((l) => l.product_id)
        ? fromDoc.items
            .filter((l) => l.product_id)
            .map((l) => ({
              product_id: l.product_id,
              description: l.description || "",
              quantity: String(l.quantity),
              rate: String(l.rate),
            }))
        : [blankInvoiceLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const [quickCustomerName, setQuickCustomerName] = useState(null); // typed name, or null = popup closed
  const [quickItem, setQuickItem] = useState(null); // { name, lineIndex } or null = popup closed
  const [invoiceNo, setInvoiceNo] = useState(editInvoice?.invoice_number || "");
  const [pos, setPos] = useState({ x: 0, y: 0 }); // how far the window has been dragged
  const [size, setSize] = useState({ w: null, h: null }); // null = default size until the user resizes
  const [preview, setPreview] = useState(null); // { url } while the preview window is open
  const [previewBusy, setPreviewBusy] = useState(false);
  const panelRef = useRef(null);
  // "Record payment" while creating the invoice (customer paid on the spot)
  const [accounts, setAccounts] = useState([]); // cash / bank accounts the money can go into
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState(""); // empty = the full invoice total
  const [payMode, setPayMode] = useState("Cash");
  const [payDepositId, setPayDepositId] = useState("");
  const [payReference, setPayReference] = useState("");

  // only for a NEW invoice: load the deposit accounts (if this user can't read them, the button is simply hidden)
  useEffect(() => {
    if (editInvoice) return;
    getAccounts()
      .then((acc) => {
        const deposits = acc.filter((a) =>
          DEPOSIT_ACCOUNT_TYPES.includes(a.account_type),
        );
        setAccounts(deposits);
        const preferred =
          deposits.find((a) => a.name === "Undeposited Funds") || deposits[0];
        if (preferred) setPayDepositId(preferred.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()])
      .then(([c, p]) => {
        setCustomers(
          c.filter((x) => x.is_active || x.id === editInvoice?.customer_id),
        );
        // only real, sellable items: a parent that has subitems can't be sold itself
        setItems(flattenParents(p).filter((x) => !(x.subitems?.length > 0)));
      })
      .catch((err) => setError(err.message));
  }, []);

  // new invoice: show the number it will get (the server still assigns the final one on save)
  useEffect(() => {
    if (editInvoice) return;
    getNextInvoiceNumber()
      .then((r) => setInvoiceNo(r.invoice_number))
      .catch(() => {});
  }, []);

  // drag the window by its title bar (kept inside the screen)
  const startDrag = (e) => {
    if (e.target.closest("button")) return;
    const el = panelRef.current;
    if (!el) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const sx = e.clientX - pos.x;
    const sy = e.clientY - pos.y;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const move = (ev) =>
      setPos({
        x: clamp(ev.clientX - sx, -(W / 2 + w / 2 - 100), W / 2 + w / 2 - 100),
        y: clamp(ev.clientY - sy, h / 2 - H / 2, H / 2 + h / 2 - 40),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // resize the window from the bottom-right handle (top-left corner stays fixed)
  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    const sx = e.clientX;
    const sy = e.clientY;
    const startPos = { ...pos };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const move = (ev) => {
      const w = clamp(startW + (ev.clientX - sx), 420, W - 16);
      const h = clamp(startH + (ev.clientY - sy), 300, H - 16);
      setSize({ w, h });
      // the window is centred, so shift it by half the change to keep the top-left corner still
      setPos({
        x: startPos.x + (w - startW) / 2,
        y: startPos.y + (h - startH) / 2,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const customer = customers.find((c) => c.id === customerId);
  const autoDue = addDaysISO(
    date,
    INVOICE_TERM_DAYS[customer?.payment_terms] ?? 0,
  );
  const effectiveDue = dueDate || autoDue;

  const itemById = Object.fromEntries(items.map((p) => [p.id, p]));
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.display_name,
    hint: c.payment_terms,
    search: `${c.display_name} ${c.company_name || ""}`,
  }));
  // when editing, the quantities this invoice already took out of stock count as available again
  const oldQty = {};
  (editInvoice?.items || []).forEach((l) => {
    if (l.product_id)
      oldQty[l.product_id] = (oldQty[l.product_id] || 0) + l.quantity;
  });
  const itemOptions = items.map((p) => ({
    value: p.id,
    label: p.label,
    hint:
      p.item_type === STOCK_TRACKED_TYPE
        ? `${p.quantity + (oldQty[p.id] || 0)} in stock`
        : p.item_type,
    search: `${p.label} ${p.sku || ""}`,
    thumb: p, // lets the dropdown show the item picture before the name
  }));

  const setLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  const pickItem = (i, productId) => {
    const p = itemById[productId];
    setLines((prev) => {
      const next = prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              product_id: productId,
              description: p?.description || p?.name || "",
              rate: p ? String(p.price ?? 0) : "",
            }
          : l,
      );
      // like QuickBooks: filling the last empty row opens a fresh empty row
      return productId && i === prev.length - 1 && !prev[i].product_id
        ? [...next, blankInvoiceLine()]
        : next;
    });
  };

  // "Create Item" button: save, reload the item list, and put the new item on the first empty line
  const handleCreateItem = async (values, imageFiles) => {
    const created = await createProduct(values, imageFiles);
    const tree = await getProducts();
    setItems(flattenParents(tree).filter((x) => !(x.subitems?.length > 0)));
    const newLine = {
      ...blankInvoiceLine(),
      product_id: created.id,
      description: created.description || created.name || "",
      rate: String(created.price ?? 0),
    };
    setLines((prev) => {
      const i = prev.findIndex((l) => !l.product_id);
      return i === -1
        ? [...prev, newLine]
        : prev.map((l, idx) => (idx === i ? newLine : l));
    });
  };

  // Enter on "+ Create new customer": save from the popup, add to the dropdown, and select it
  const handleQuickCustomer = async (payload) => {
    const created = await createCustomer(payload);
    setCustomers((prev) => [...prev, created]);
    setCustomerId(created.id);
  };

  // Enter on "+ Create new item": save from the popup, reload the list, and fill the line it was typed on
  const handleQuickItem = async (values) => {
    const created = await createProduct(values, []);
    const tree = await getProducts();
    setItems(flattenParents(tree).filter((x) => !(x.subitems?.length > 0)));
    const at = quickItem.lineIndex;
    setLines((prev) => {
      const next = prev.map((l, idx) =>
        idx === at
          ? {
              ...l,
              product_id: created.id,
              description: created.description || created.name || "",
              rate: String(created.price ?? 0),
            }
          : l,
      );
      return at === prev.length - 1 ? [...next, blankInvoiceLine()] : next;
    });
  };
  // the same item can be on two lines, so stock is checked against the combined quantity
  const used = {};
  lines.forEach((l) => {
    if (l.product_id)
      used[l.product_id] =
        (used[l.product_id] || 0) + (Number(l.quantity) || 0);
  });
  const overStock = (l) => {
    const p = itemById[l.product_id];
    return (
      Boolean(p) &&
      p.item_type === STOCK_TRACKED_TYPE &&
      used[l.product_id] > p.quantity + (oldQty[l.product_id] || 0)
    );
  };

  const filled = lines.filter((l) => l.product_id);
  const lineCents = (l) => (Number(l.quantity) || 0) * toCents(l.rate);
  const totalCents = filled.reduce((s, l) => s + lineCents(l), 0);
  const discountNum = Number(discountValue) || 0;
  const discountCents =
    discountType === "percent"
      ? Math.round((totalCents * discountNum) / 100)
      : toCents(discountValue);
  const discountOk =
    discountNum >= 0 &&
    (discountType !== "percent" || discountNum <= 100) &&
    discountCents <= totalCents;
  const netCents = totalCents - discountCents; // what the customer owes
  const payCents = payAmount === "" ? netCents : toCents(payAmount); // amount received now
  const payOk =
    !payNow ||
    (Boolean(payDepositId) && payCents > 0 && payCents <= netCents);
  const canSave =
    Boolean(customerId) &&
    filled.length > 0 &&
    filled.every(
      (l) =>
        Number.isInteger(Number(l.quantity)) &&
        Number(l.quantity) > 0 &&
        toCents(l.rate) >= 0,
    ) &&
    netCents > 0 &&
    discountOk &&
    effectiveDue >= date &&
    payOk;

  const canPreview = Boolean(customerId) && filled.length > 0;

  // builds the same PDF that "Download PDF" makes, from what is typed in the form (nothing is saved)
  const handlePreview = async () => {
    setPreviewBusy(true);
    setError(null);
    try {
      const pdf = await import("./pdf.js");
      const draft = {
        invoice_number: invoiceNo || "DRAFT",
        customer_name:
          customer?.display_name || editInvoice?.customer_name || "",
        invoice_date: date,
        due_date: effectiveDue,
        order_number: orderNumber.trim() || null,
        notes: notes.trim() || null,
        status: "open",
        subtotal: totalCents / 100,
        discount_type: discountType,
        discount_value: discountNum,
        discount_amount: discountCents / 100,
        total: netCents / 100,
        amount_paid: 0,
        balance_due: netCents / 100,
        items: filled.map((l) => ({
          item_name: itemById[l.product_id]?.name || "",
          description: l.description.trim() || null,
          quantity: Number(l.quantity) || 0,
          rate: Number(l.rate) || 0,
          amount: lineCents(l) / 100,
          product: itemById[l.product_id],
        })),
      };
      const file = await pdf.downloadInvoicePdf(draft, customer, true);
      setPreview({ url: URL.createObjectURL(file) });
    } catch (err) {
      setError(err.message || "Could not create the preview");
    } finally {
      setPreviewBusy(false);
    }
  };
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const invoicePayload = {
        customer_id: customerId,
        sales_document_id: fromDoc ? fromDoc.id : null,
        invoice_date: date,
        due_date: effectiveDue,
        order_number: orderNumber.trim() || null,
        notes: notes.trim() || null,
        discount_type: discountType,
        discount_value: discountNum,
        items: filled.map((l) => ({
          product_id: l.product_id,
          description: l.description.trim() || null,
          quantity: Number(l.quantity),
          rate: Number(l.rate) || 0,
        })),
      };
      if (editInvoice) {
        await updateInvoice(editInvoice.id, invoicePayload);
      } else {
        const created = await createInvoice(invoicePayload);
        if (payNow) {
          try {
            await createPayment({
              customer_id: customerId,
              payment_date: date,
              payment_mode: payMode,
              deposit_account_id: Number(payDepositId),
              reference: payReference.trim() || null,
              notes: null,
              allocations: [
                { invoice_id: created.id, amount: payCents / 100 },
              ],
            });
          } catch (payErr) {
            // the invoice is already saved, so close the form and tell the user what is left to do
            await onSaved();
            onClose();
            alert(
              `${created.invoice_number} was saved, but the payment could not be recorded (${payErr.message}). Use "Record payment" on the invoice list.`,
            );
            return;
          }
        }
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div
        ref={panelRef}
        style={{
          position: "relative",
          left: pos.x,
          top: pos.y,
          ...(size.w && size.h
            ? {
                width: size.w,
                height: size.h,
                minWidth: 0,
                maxHeight: "none",
              }
            : {}),
        }}
        className="bg-white rounded-xl shadow-xl w-full lg:w-1/2 lg:min-w-[640px] p-6 max-h-[92vh] overflow-y-auto"
      >
        <h2
          onPointerDown={startDrag}
          title="Drag to move"
          className="-mx-6 -mt-6 mb-4 px-6 pt-6 pb-2 rounded-t-xl text-lg font-semibold cursor-move select-none touch-none flex items-center justify-between"
        >
          <span>
            {editInvoice ? `Edit ${editInvoice.invoice_number}` : "New Invoice"}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-1 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Customer</FieldLabel>
            {editInvoice ? (
              <p className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                {editInvoice.customer_name}
              </p>
            ) : (
              <SearchSelect
                value={customerId}
                onChange={setCustomerId}
                options={customerOptions}
                placeholder="Select a customer..."
                searchPlaceholder="Search customers..."
                onCreateNew={(name) => setQuickCustomerName(name)}
                createLabel="customer"
                emptyText="No customers found"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500">
              Invoice no.
              <input
                readOnly
                value={invoiceNo || "Auto"}
                title="Assigned automatically when you save"
                className={cls + " mt-1 bg-gray-50 text-gray-700 font-medium"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Invoice date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Due date{" "}
              {customer && !dueDate && (
                <span className="text-gray-400">
                  ({customer.payment_terms})
                </span>
              )}
              <input
                required
                type="date"
                value={effectiveDue}
                min={date}
                onChange={(e) => setDueDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Order / PO number
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>

          <div className="space-y-3">
            <FieldLabel
              action={
                <FieldButton onClick={() => setShowItemForm(true)}>
                  Create Item
                </FieldButton>
              }
            >
              Items
            </FieldLabel>
            <div className="border border-gray-200 rounded-lg">
              <div
                className={`${INVOICE_ROW_GRID} hidden sm:grid bg-gray-50 border-b border-gray-200 rounded-t-lg px-2 py-2 text-[11px] font-semibold uppercase text-gray-500`}
              >
                <span>#</span>
                <span>Product / Service</span>
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              {lines.map((l, i) => {
                const p = itemById[l.product_id];
                return (
                  <div
                    key={i}
                    className="border-b border-gray-100 last:border-b-0 px-2 py-2"
                  >
                    <div className={INVOICE_ROW_GRID}>
                      <span className="hidden sm:block text-sm text-gray-400">
                        {i + 1}
                      </span>
                      <div className="col-span-2 sm:col-span-1 min-w-0">
                        <SearchSelect
                          value={l.product_id}
                          onChange={(v) => pickItem(i, v)}
                          options={itemOptions}
                          placeholder="Select an item..."
                          searchPlaceholder="Search items..."
                          onCreateNew={(name) =>
                            setQuickItem({ name, lineIndex: i })
                          }
                          createLabel="item"
                          emptyText="No items found"
                          wrap
                        />
                      </div>
                      <input
                        placeholder="Description"
                        title={l.description}
                        value={l.description}
                        onChange={(e) =>
                          setLine(i, { description: e.target.value })
                        }
                        className={cls + " col-span-2 sm:col-span-1"}
                      />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Qty"
                        aria-label="Quantity"
                        value={l.quantity}
                        onChange={(e) =>
                          setLine(i, { quantity: e.target.value })
                        }
                        className={cls + " sm:text-right"}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate"
                        aria-label="Rate"
                        value={l.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        className={cls + " sm:text-right"}
                      />
                      <p className="text-sm font-medium text-gray-900 sm:text-right truncate">
                        {formatRs(lineCents(l) / 100)}
                      </p>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          title="Remove line"
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="justify-self-end p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>

                    {overStock(l) && (
                      <p className="text-xs text-amber-600 mt-1 sm:pl-8">
                        Only {p.quantity + (oldQty[l.product_id] || 0)} in
                        stock. You can still sell it, but stock will go to{" "}
                        {p.quantity +
                          (oldQty[l.product_id] || 0) -
                          used[l.product_id]}
                        .
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [...prev, blankInvoiceLine()])
                }
                className="text-sm text-blue-600 font-medium inline-flex items-center gap-1"
              >
                <Plus size={14} /> Add lines
              </button>
              <button
                type="button"
                onClick={() => setLines([blankInvoiceLine()])}
                className="text-sm text-gray-500 hover:text-red-600"
              >
                Clear all lines
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            placeholder="Notes for the customer"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cls}
          />

          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatRs(totalCents / 100)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600">Discount</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  className={`w-28 border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${discountOk ? "border-gray-300" : "border-red-400"}`}
                />
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                >
                  <option value="amount">Rs.</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            {discountCents > 0 && discountOk && (
              <div className="flex justify-between text-gray-600">
                <span>
                  Discount
                  {discountType === "percent" ? ` (${discountNum}%)` : ""}
                </span>
                <span>- {formatRs(discountCents / 100)}</span>
              </div>
            )}
            {!discountOk && (
              <p className="text-xs text-red-500">
                The discount can't be more than the subtotal (or 100%).
              </p>
            )}
            <div className="flex justify-between font-semibold border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatRs(netCents / 100)}</span>
            </div>
          </div>

          {!editInvoice && accounts.length > 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPayNow((v) => !v)}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-green-700 bg-green-100 hover:bg-green-200 border-2 transition ${payNow ? "border-green-500" : "border-green-200"}`}
              >
                {payNow ? <Check size={20} /> : <Wallet size={20} />}
                {payNow
                  ? `Payment will be recorded: ${formatRs(payCents / 100)}`
                  : "Record payment"}
              </button>

              {payNow && (
                <div className="border border-green-200 bg-green-50/60 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs text-gray-500">
                      Amount received
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(netCents / 100)}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className={`${cls} mt-1 ${payOk ? "" : "!border-red-400"}`}
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Payment mode
                      <select
                        value={payMode}
                        onChange={(e) => setPayMode(e.target.value)}
                        className={cls + " mt-1 bg-white"}
                      >
                        {PAYMENT_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-gray-500">
                      Deposit to
                      <select
                        value={payDepositId}
                        onChange={(e) => setPayDepositId(e.target.value)}
                        className={cls + " mt-1 bg-white"}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <input
                    placeholder="Reference (cheque no., transfer ID...)"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className={cls + " bg-white"}
                  />
                  {!payOk && (
                    <p className="text-xs text-red-600">
                      The amount must be more than 0 and not more than the
                      invoice total.
                    </p>
                  )}
                  {payOk && payCents < netCents && (
                    <p className="text-xs text-gray-500">
                      Balance of {formatRs((netCents - payCents) / 100)} stays
                      due on the invoice.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!canPreview || previewBusy}
              className="flex-1 border border-blue-300 text-blue-700 rounded-lg py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <FileText size={14} /> {previewBusy ? "Preparing..." : "Preview"}
            </button>

            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : editInvoice
                  ? "Save Changes"
                  : payNow
                    ? "Save Invoice & Payment"
                    : "Save Invoice"}
            </button>
          </div>
        </form>

        {/* resize handle (bottom-right corner) */}
        <div className="sticky bottom-0 h-0 -mr-6">
          <div
            onPointerDown={startResize}
            title="Drag to resize"
            className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize touch-none select-none z-10"
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, #9ca3af 50%, #9ca3af 58%, transparent 58%, transparent 70%, #9ca3af 70%, #9ca3af 78%, transparent 78%)",
            }}
          />
        </div>

        {quickCustomerName !== null && (
          <QuickCustomerModal
            initialName={quickCustomerName}
            onSave={handleQuickCustomer}
            onClose={() => setQuickCustomerName(null)}
          />
        )}
        {quickItem && (
          <QuickItemModal
            initialName={quickItem.name}
            onSave={handleQuickItem}
            onClose={() => setQuickItem(null)}
          />
        )}

        {showItemForm && (
          <ProductForm
            onSubmit={handleCreateItem}
            onClose={() => setShowItemForm(false)}
          />
        )}
        {preview && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Invoice preview</h3>
                <div className="flex items-center gap-2">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
                  >
                    Open in new tab
                  </a>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
              <iframe
                src={preview.url}
                title="Invoice preview"
                className="flex-1 w-full rounded-b-xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Credit notes (step 6B: goods / money given back; posts to the ledger, admin only) ----------
function creditNoteStatus(cn) {
  if (cn.status === "void")
    return { label: "Void", cls: "bg-gray-100 text-gray-500" };
  if (cn.balance <= 0.004)
    return { label: "Applied", cls: "bg-green-100 text-green-700" };
  if (cn.amount_applied > 0)
    return { label: "Partially applied", cls: "bg-amber-100 text-amber-700" };
  return { label: "Open", cls: "bg-blue-100 text-blue-700" };
}

function CreditNotesPage({ isAdmin, go }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);
  const [applyFor, setApplyFor] = useState(null); // the credit note whose "Apply to invoice" button was pressed

  const load = async () => {
    try {
      setNotes(await getCreditNotes());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (action) => {
    try {
      await action();
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVoid = (cn) => {
    if (
      !window.confirm(
        `Void ${cn.credit_number}? Returned stock is taken out again and its ledger entry is removed.`,
      )
    )
      return;
    run(() => voidCreditNote(cn.id));
  };

  const handleDelete = (cn) => {
    if (
      !window.confirm(
        `Permanently delete ${cn.credit_number}? This can't be undone.`,
      )
    )
      return;
    run(() => deleteCreditNote(cn.id));
  };

  const handleRemoveApplication = (cn, app) => {
    if (
      !window.confirm(
        `Take ${formatRs(app.amount)} off ${app.invoice_number}? That invoice will owe it again.`,
      )
    )
      return;
    run(() => removeCreditApplication(cn.id, app.id));
  };

  const q = search.trim().toLowerCase();
  const shown = notes.filter(
    (n) =>
      !q ||
      [n.credit_number, n.customer_name, n.invoice_number].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
  );

  const btn =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="creditnotes"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <div className="flex-1">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search credit notes..."
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + New Credit Note
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            No credit notes yet.
          </p>
        ) : (
          <div className="space-y-2">
            {shown.map((cn) => {
              const st = creditNoteStatus(cn);
              const open = expandedId === cn.id;
              return (
                <div
                  key={cn.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : cn.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {cn.credit_number}{" "}
                        <span className="text-gray-400 font-normal">
                          · {cn.customer_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(cn.credit_date)}
                        {cn.invoice_number && ` · For ${cn.invoice_number}`}
                        {cn.restock
                          ? " · Stock returned"
                          : " · No stock returned"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900">
                        {formatRs(cn.total)}
                      </p>
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    {open ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {cn.items.map((l) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <ItemThumb product={l.product} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {l.item_name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {l.quantity} × {formatRs(l.rate)}
                              {l.description && ` · ${l.description}`}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-gray-900 shrink-0">
                            {formatRs(l.amount)}
                          </span>
                        </div>
                      ))}

                      {cn.reason && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                          {cn.reason}
                        </p>
                      )}

                      {cn.applications.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500">
                            Applied to
                          </p>
                          {cn.applications.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700">
                                {a.invoice_number}
                              </span>
                              <span className="flex items-center gap-2">
                                {formatRs(a.amount)}
                                {cn.status !== "void" && (
                                  <button
                                    type="button"
                                    title="Remove from invoice"
                                    onClick={() =>
                                      handleRemoveApplication(cn, a)
                                    }
                                    className="text-gray-400 hover:text-red-600"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-gray-100 pt-2 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total</span>
                          <span>{formatRs(cn.total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">
                            Used on invoices
                          </span>
                          <span>{formatRs(cn.amount_applied)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Credit left</span>
                          <span>{formatRs(cn.balance)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => downloadPdf("credit", cn)}
                          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                          <Download size={14} /> Download PDF
                        </button>
                      </div>

                      {cn.status !== "void" && (
                        <div className="flex flex-wrap gap-2">
                          {cn.balance > 0.004 && (
                            <button
                              onClick={() => setApplyFor(cn)}
                              className={`${btn} bg-green-600 text-white hover:bg-green-700`}
                            >
                              <FileText size={14} /> Apply to invoice
                            </button>
                          )}
                          <Gate right="void_transactions">
                            <button
                              onClick={() => handleVoid(cn)}
                              className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}
                            >
                              <Trash2 size={14} /> Void credit note
                            </button>
                          </Gate>
                        </div>
                      )}
                      {cn.status === "void" && (
                        <div className="flex flex-wrap gap-2">
                          <Gate right="delete_records">
                            <button
                              onClick={() => handleDelete(cn)}
                              className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}
                            >
                              <Trash2 size={14} /> Delete credit note
                            </button>
                          </Gate>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <CreditNoteForm onClose={() => setFormOpen(false)} onSaved={load} />
      )}
      {applyFor && (
        <ApplyCreditModal
          credit={applyFor}
          onClose={() => setApplyFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// fromInvoice: used by the "Credit note" button on an invoice (pre-fills the customer and the lines)
function CreditNoteForm({ fromInvoice = null, onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [customerId, setCustomerId] = useState(
    fromInvoice ? fromInvoice.customer_id : "",
  );
  const [date, setDate] = useState(toISODate(new Date()));
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [lines, setLines] = useState(
    fromInvoice && fromInvoice.items.some((l) => l.product_id)
      ? fromInvoice.items
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: l.product_id,
            description: l.description || "",
            quantity: String(l.quantity),
            rate: String(l.rate),
          }))
      : [blankInvoiceLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()])
      .then(([c, p]) => {
        setCustomers(
          c.filter((x) => x.is_active || x.id === fromInvoice?.customer_id),
        );
        setItems(flattenParents(p).filter((x) => !(x.subitems?.length > 0)));
      })
      .catch((err) => setError(err.message));
  }, []);

  const itemById = Object.fromEntries(items.map((p) => [p.id, p]));
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.display_name,
    hint: c.payment_terms,
    search: `${c.display_name} ${c.company_name || ""}`,
  }));
  const itemOptions = items.map((p) => ({
    value: p.id,
    label: p.label,
    hint:
      p.item_type === STOCK_TRACKED_TYPE
        ? `${p.quantity} in stock`
        : p.item_type,
    search: `${p.label} ${p.sku || ""}`,
  }));

  const setLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  const pickItem = (i, productId) => {
    const p = itemById[productId];
    setLine(i, {
      product_id: productId,
      description: p?.description || "",
      rate: p ? String(p.price ?? 0) : "",
    });
  };

  const filled = lines.filter((l) => l.product_id);
  const lineCents = (l) => (Number(l.quantity) || 0) * toCents(l.rate);
  const totalCents = filled.reduce((s, l) => s + lineCents(l), 0);
  const canSave =
    Boolean(customerId) &&
    filled.length > 0 &&
    filled.every(
      (l) =>
        Number.isInteger(Number(l.quantity)) &&
        Number(l.quantity) > 0 &&
        toCents(l.rate) >= 0,
    ) &&
    totalCents > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createCreditNote({
        customer_id: customerId,
        invoice_id: fromInvoice ? fromInvoice.id : null,
        credit_date: date,
        reason: reason.trim() || null,
        restock,
        items: filled.map((l) => ({
          product_id: l.product_id,
          description: l.description.trim() || null,
          quantity: Number(l.quantity),
          rate: Number(l.rate) || 0,
        })),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          New Credit Note
          {fromInvoice ? ` for ${fromInvoice.invoice_number}` : ""}
        </h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Customer</FieldLabel>
            <SearchSelect
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder="Select a customer..."
              searchPlaceholder="Search customers..."
              emptyText="No customers found"
            />
          </div>

          <label className="text-xs text-gray-500 block">
            Credit note date
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cls + " mt-1 sm:w-56"}
            />
          </label>

          <div className="space-y-3">
            <FieldLabel>Items being credited</FieldLabel>
            {lines.map((l, i) => {
              const p = itemById[l.product_id];
              return (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <ItemThumb product={p} size={56} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <SearchSelect
                        value={l.product_id}
                        onChange={(v) => pickItem(i, v)}
                        options={itemOptions}
                        placeholder="Select an item..."
                        searchPlaceholder="Search items..."
                        emptyText="No items found"
                      />
                      <input
                        placeholder="Description (optional)"
                        value={l.description}
                        onChange={(e) =>
                          setLine(i, { description: e.target.value })
                        }
                        className={cls}
                      />
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        title="Remove line"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 border border-gray-300 rounded-lg p-2 text-gray-500 hover:bg-gray-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-gray-500">
                      Qty
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          setLine(i, { quantity: e.target.value })
                        }
                        className={cls + " mt-1"}
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Rate
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        className={cls + " mt-1"}
                      />
                    </label>
                    <div className="text-xs text-gray-500">
                      Amount
                      <p className="mt-1 py-2 text-sm font-medium text-gray-900">
                        {formatRs(lineCents(l) / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, blankInvoiceLine()])}
              className="text-sm text-blue-600 font-medium inline-flex items-center gap-1"
            >
              <Plus size={14} /> Add another line
            </button>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
              className="mt-1"
            />
            <span>
              The goods came back, so put them back in stock
              <span className="block text-xs text-gray-400">
                Untick this for a price adjustment or a discount where nothing
                was returned.
              </span>
            </span>
          </label>

          <textarea
            rows={2}
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={cls}
          />

          <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between font-semibold">
            <span>Credit total</span>
            <span>{formatRs(totalCents / 100)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Credit Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// pays down one open invoice of the same customer with this credit note
function ApplyCreditModal({ credit, onClose, onSaved }) {
  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    getInvoices()
      .then((all) =>
        setInvoices(
          all.filter(
            (i) =>
              i.customer_id === credit.customer_id &&
              i.status === "open" &&
              i.balance_due > 0.004,
          ),
        ),
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const pick = (id) => {
    setInvoiceId(id);
    const inv = invoices.find((i) => String(i.id) === String(id));
    setAmount(
      inv ? String(Math.min(inv.balance_due, credit.balance).toFixed(2)) : "",
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await applyCreditNote(credit.id, {
        invoice_id: Number(invoiceId),
        amount: Number(amount),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">
          Apply {credit.credit_number}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {credit.customer_name} · Credit left {formatRs(credit.balance)}
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : invoices.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              This customer has no unpaid invoices to apply the credit to.
            </p>
            <button
              onClick={onClose}
              className="w-full border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="text-xs text-gray-500 block">
              Invoice
              <select
                required
                value={invoiceId}
                onChange={(e) => pick(e.target.value)}
                className={cls + " mt-1"}
              >
                <option value="">Select an invoice...</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number} · owes {formatRs(i.balance_due)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500 block">
              Amount to apply
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!invoiceId || !(Number(amount) > 0) || submitting}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Apply credit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- Payments received (money in: pays off invoices + posts to the ledger, admin only) ----------
const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];
const DEPOSIT_ACCOUNT_TYPES = ["cash", "bank", "other_current_asset"]; // where the money can land

function PaymentsPage({ isAdmin, go }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    try {
      setPayments(await getPayments());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (p) => {
    if (
      !window.confirm(
        `Delete ${p.payment_number}? Its invoices will owe the money again and the ledger entry is removed.`,
      )
    )
      return;
    try {
      await deletePayment(p.id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = payments.filter(
    (p) =>
      !q ||
      [p.payment_number, p.customer_name, p.reference].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="payments"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <div className="flex-1">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search payments..."
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + Record Payment
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((p) => {
              const open = expandedId === p.id;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : p.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {p.payment_number}{" "}
                        <span className="text-gray-400 font-normal">
                          · {p.customer_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(p.payment_date)} · {p.payment_mode} →{" "}
                        {p.deposit_account_name}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-green-700">
                      {formatRs(p.amount)}
                    </span>
                    {open ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {p.reference && (
                        <p className="text-sm text-gray-600">
                          Reference: {p.reference}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                          {p.notes}
                        </p>
                      )}
                      <div className="text-sm space-y-1">
                        <p className="text-xs text-gray-400 uppercase">
                          Applied to
                        </p>
                        {p.allocations.map((a) => (
                          <div key={a.id} className="flex justify-between">
                            <span className="text-gray-900">
                              {a.invoice_number}
                            </span>
                            <span>{formatRs(a.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <Gate right="delete_records">
                        <button
                          onClick={() => handleDelete(p)}
                          className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Delete payment
                        </button>
                      </Gate>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <PaymentForm onClose={() => setFormOpen(false)} onSaved={load} />
      )}
    </div>
  );
}

// initialCustomerId / initialInvoiceId: used by the "Record payment" button on an invoice
function PaymentForm({
  initialCustomerId = "",
  initialInvoiceId = null,
  onClose,
  onSaved,
}) {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [date, setDate] = useState(toISODate(new Date()));
  const [mode, setMode] = useState("Cash");
  const [depositId, setDepositId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [applied, setApplied] = useState({}); // invoice id -> amount typed
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    Promise.all([getCustomers(), getInvoices(), getAccounts()])
      .then(([c, inv, acc]) => {
        setCustomers(c);
        setInvoices(inv);
        const deposits = acc.filter((a) =>
          DEPOSIT_ACCOUNT_TYPES.includes(a.account_type),
        );
        setAccounts(deposits);
        const preferred =
          deposits.find((a) => a.name === "Undeposited Funds") || deposits[0];
        if (preferred) setDepositId(preferred.id);
        const start = inv.find((i) => i.id === initialInvoiceId);
        if (start) setApplied({ [start.id]: String(start.balance_due) });
      })
      .catch((err) => setError(err.message));
  }, []);

  const owed = invoices
    .filter(
      (i) =>
        i.customer_id === customerId &&
        i.status === "open" &&
        i.balance_due > 0.004,
    )
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.display_name,
    search: `${c.display_name} ${c.company_name || ""}`,
  }));

  const pickCustomer = (id) => {
    setCustomerId(id);
    setApplied({});
  };
  const setAmount = (id, value) =>
    setApplied((prev) => ({ ...prev, [id]: value }));

  const rows = owed.filter((i) => toCents(applied[i.id]) > 0);
  const totalCents = rows.reduce((s, i) => s + toCents(applied[i.id]), 0);
  const tooMuch = (i) => toCents(applied[i.id]) > toCents(i.balance_due);
  const canSave =
    Boolean(customerId) &&
    Boolean(depositId) &&
    rows.length > 0 &&
    !rows.some(tooMuch);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({
        customer_id: customerId,
        payment_date: date,
        payment_mode: mode,
        deposit_account_id: Number(depositId),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        allocations: rows.map((i) => ({
          invoice_id: i.id,
          amount: Number(applied[i.id]),
        })),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Record Payment</h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Customer</FieldLabel>
            <SearchSelect
              value={customerId}
              onChange={pickCustomer}
              options={customerOptions}
              placeholder="Select a customer..."
              searchPlaceholder="Search customers..."
              emptyText="No customers found"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">
              Payment date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Payment mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className={cls + " mt-1"}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Deposit to
              <select
                value={depositId}
                onChange={(e) => setDepositId(e.target.value)}
                className={cls + " mt-1"}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <FieldLabel>Invoices to pay</FieldLabel>
            {!customerId ? (
              <p className="text-sm text-gray-400">
                Pick a customer to see what they owe.
              </p>
            ) : owed.length === 0 ? (
              <p className="text-sm text-gray-400">
                This customer has no unpaid invoices.
              </p>
            ) : (
              owed.map((i) => (
                <div
                  key={i.id}
                  className="border border-gray-200 rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {i.invoice_number}
                    </p>
                    <p className="text-xs text-gray-400">
                      Due {formatJournalDate(i.due_date)} · Owes{" "}
                      {formatRs(i.balance_due)}
                    </p>
                    {tooMuch(i) && (
                      <p className="text-xs text-red-600">More than is owed.</p>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={applied[i.id] ?? ""}
                    onChange={(e) => setAmount(i.id, e.target.value)}
                    className={cls + " !w-28"}
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(i.id, String(i.balance_due))}
                    className="text-xs text-blue-600 font-medium whitespace-nowrap"
                  >
                    Pay in full
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Reference (cheque no., transfer ID...)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={cls}
            />
            <input
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cls}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between font-semibold">
            <span>Amount received</span>
            <span>{formatRs(totalCents / 100)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ---------- Purchase bills (step 5: what you owe vendors. Adds stock + posts to the ledger, admin only) ----------
// Not the same as the "Bill" tab (BillPage below), which is only the quick "restock several items" batch.
const BILL_EXPENSE_TYPES = [
  "expense",
  "other_expense",
  "cogs",
  "fixed_asset",
  "other_current_asset",
]; // accounts a plain expense line can use
const PAID_FROM_ACCOUNT_TYPES = [
  "cash",
  "bank",
  "credit_card",
  "other_current_asset",
]; // where vendor payments can come from

function PurchaseBillsPage({ isAdmin, go }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);
  const [payFor, setPayFor] = useState(null); // the bill whose "Record payment" button was pressed

  const load = async () => {
    try {
      setBills(await getPurchaseBills());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleVoid = async (b) => {
    if (
      !window.confirm(
        `Void ${b.bill_number}? The stock it added is taken back and its ledger entry is removed.`,
      )
    )
      return;
    try {
      await voidPurchaseBill(b.id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = bills.filter(
    (b) =>
      !q ||
      [b.bill_number, b.vendor_name, b.vendor_ref].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="purchases"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <div className="flex-1">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search bills..."
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + New Bill
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No bills yet.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((b) => {
              const st = invoiceStatus(b); // bills have the same status / balance_due / due_date fields as invoices
              const open = expandedId === b.id;
              return (
                <div
                  key={b.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : b.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {b.bill_number}{" "}
                        <span className="text-gray-400 font-normal">
                          · {b.vendor_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(b.bill_date)} · Due{" "}
                        {formatJournalDate(b.due_date)}
                        {b.vendor_ref && ` · Ref ${b.vendor_ref}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900">
                        {formatRs(b.total)}
                      </p>
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    {open ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {b.items.map((l) => (
                        <div key={l.id} className="flex items-center gap-3">
                          {l.product ? (
                            <ItemThumb product={l.product} />
                          ) : (
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                              <Receipt size={20} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {l.item_name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {l.quantity} × {formatRs(l.rate)}
                              {l.description && ` · ${l.description}`}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-gray-900 shrink-0">
                            {formatRs(l.amount)}
                          </span>
                        </div>
                      ))}

                      {b.notes && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                          {b.notes}
                        </p>
                      )}

                      <div className="border-t border-gray-100 pt-2 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total</span>
                          <span>{formatRs(b.total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Paid</span>
                          <span>{formatRs(b.amount_paid)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Balance due</span>
                          <span>{formatRs(b.balance_due)}</span>
                        </div>
                      </div>

                      {b.status !== "void" && (
                        <div className="flex flex-wrap gap-2">
                          {b.balance_due > 0.004 && (
                            <button
                              onClick={() => setPayFor(b)}
                              className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                            >
                              <CreditCard size={14} /> Record payment
                            </button>
                          )}
                          <Gate right="void_transactions">
                            <button
                              onClick={() => handleVoid(b)}
                              className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                            >
                              <Trash2 size={14} /> Void bill
                            </button>
                          </Gate>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <PurchaseBillForm onClose={() => setFormOpen(false)} onSaved={load} />
      )}

      {payFor && (
        <VendorPaymentForm
          initialVendorId={payFor.vendor_id}
          initialBillId={payFor.id}
          onClose={() => setPayFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// a line is either an Item (stock goes up if it is an Inventory Part) or a plain Expense (e.g. electricity)
const blankBillLine = () => ({
  kind: "item",
  product_id: "",
  account_id: "",
  description: "",
  quantity: "1",
  rate: "",
});

function PurchaseBillForm({ onClose, onSaved }) {
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [terms, setTerms] = useState("Due on Receipt");
  const [dueDate, setDueDate] = useState(""); // empty = follow the payment terms
  const [vendorRef, setVendorRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([blankBillLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    Promise.all([getVendors(), getProducts(), getAccounts()])
      .then(([v, p, a]) => {
        setVendors(v);
        // only real items: a parent that has subitems can't be bought itself
        setItems(flattenParents(p).filter((x) => !(x.subitems?.length > 0)));
        setAccounts(
          a.filter((x) => BILL_EXPENSE_TYPES.includes(x.account_type)),
        );
      })
      .catch((err) => setError(err.message));
  }, []);

  const autoDue = addDaysISO(date, INVOICE_TERM_DAYS[terms] ?? 0);
  const effectiveDue = dueDate || autoDue;

  const itemById = Object.fromEntries(items.map((p) => [p.id, p]));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const itemOptions = items.map((p) => ({
    value: p.id,
    label: p.label,
    hint:
      p.item_type === STOCK_TRACKED_TYPE
        ? `${p.quantity} in stock`
        : p.item_type,
    search: `${p.label} ${p.sku || ""}`,
  }));
  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    hint: ACCOUNT_TYPE_NAMES[a.account_type],
  }));

  const setLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  const pickItem = (i, productId) => {
    const p = itemById[productId];
    // the item's current cost is the starting rate; change it to what this bill actually charges
    setLine(i, {
      product_id: productId,
      description: p?.purchase_description || "",
      rate: p && Number(p.cost) > 0 ? String(p.cost) : "",
    });
  };

  const isFilled = (l) =>
    l.kind === "item" ? Boolean(l.product_id) : Boolean(l.account_id);
  const filled = lines.filter(isFilled);
  const lineCents = (l) => (Number(l.quantity) || 0) * toCents(l.rate);
  const totalCents = filled.reduce((s, l) => s + lineCents(l), 0);
  const canSave =
    Boolean(vendorId) &&
    filled.length > 0 &&
    filled.every(
      (l) =>
        Number.isInteger(Number(l.quantity)) &&
        Number(l.quantity) > 0 &&
        toCents(l.rate) >= 0,
    ) &&
    totalCents > 0 &&
    effectiveDue >= date;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPurchaseBill({
        vendor_id: vendorId,
        bill_date: date,
        due_date: effectiveDue,
        vendor_ref: vendorRef.trim() || null,
        notes: notes.trim() || null,
        items: filled.map((l) => ({
          ...(l.kind === "item"
            ? { product_id: l.product_id }
            : { account_id: l.account_id }),
          description: l.description.trim() || null,
          quantity: Number(l.quantity),
          rate: Number(l.rate) || 0,
        })),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">New Bill</h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Vendor</FieldLabel>
            <SearchSelect
              value={vendorId}
              onChange={setVendorId}
              options={vendorOptions}
              placeholder="Select a vendor..."
              searchPlaceholder="Search vendors..."
              emptyText="No vendors found. Add one on the Vendors tab first."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Bill date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Vendor's invoice number
              <input
                value={vendorRef}
                onChange={(e) => setVendorRef(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Payment terms
              <select
                value={terms}
                onChange={(e) => {
                  setTerms(e.target.value);
                  setDueDate("");
                }}
                className={cls + " mt-1"}
              >
                {Object.keys(INVOICE_TERM_DAYS).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Due date
              <input
                required
                type="date"
                value={effectiveDue}
                min={date}
                onChange={(e) => setDueDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
          </div>

          <div className="space-y-3">
            <FieldLabel>Lines</FieldLabel>
            {lines.map((l, i) => {
              const p = itemById[l.product_id];
              return (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    {l.kind === "item" ? (
                      <ItemThumb product={p} size={56} />
                    ) : (
                      <div
                        style={{ width: 56, height: 56 }}
                        className="shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300"
                      >
                        <Receipt size={28} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                        {[
                          ["item", "Item"],
                          ["expense", "Expense"],
                        ].map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              l.kind !== k &&
                              setLine(i, {
                                kind: k,
                                product_id: "",
                                account_id: "",
                                description: "",
                                rate: "",
                              })
                            }
                            className={`px-3 py-1 ${l.kind === k ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {l.kind === "item" ? (
                        <SearchSelect
                          value={l.product_id}
                          onChange={(v) => pickItem(i, v)}
                          options={itemOptions}
                          placeholder="Select an item..."
                          searchPlaceholder="Search items..."
                          emptyText="No items found"
                        />
                      ) : (
                        <SearchSelect
                          value={l.account_id}
                          onChange={(v) => setLine(i, { account_id: v })}
                          options={accountOptions}
                          placeholder="Select an expense account..."
                          searchPlaceholder="Search accounts..."
                          emptyText="No expense accounts found. Add one on the Acc. tab."
                        />
                      )}
                      <input
                        placeholder="Description (optional)"
                        value={l.description}
                        onChange={(e) =>
                          setLine(i, { description: e.target.value })
                        }
                        className={cls}
                      />
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        title="Remove line"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 border border-gray-300 rounded-lg p-2 text-gray-500 hover:bg-gray-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-gray-500">
                      Qty
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          setLine(i, { quantity: e.target.value })
                        }
                        className={cls + " mt-1"}
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Rate
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        className={cls + " mt-1"}
                      />
                    </label>
                    <div className="text-xs text-gray-500">
                      Amount
                      <p className="mt-1 py-2 text-sm font-medium text-gray-900">
                        {formatRs(lineCents(l) / 100)}
                      </p>
                    </div>
                  </div>

                  {p &&
                    p.item_type === STOCK_TRACKED_TYPE &&
                    Number(l.quantity) > 0 && (
                      <p className="text-xs text-green-700">
                        +{Number(l.quantity)} will be added to stock.
                      </p>
                    )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, blankBillLine()])}
              className="text-sm text-blue-600 font-medium inline-flex items-center gap-1"
            >
              <Plus size={14} /> Add another line
            </button>
          </div>

          <textarea
            rows={2}
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cls}
          />

          <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatRs(totalCents / 100)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Vendor payments (step 5: money out. Pays off bills + posts to the ledger, admin only) ----------
function VendorPaymentsPage({ isAdmin, go }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  useQuickNew(() => setFormOpen(true));
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    try {
      setPayments(await getVendorPayments());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (p) => {
    if (
      !window.confirm(
        `Delete ${p.payment_number}? Its bills will be owed again and the ledger entry is removed.`,
      )
    )
      return;
    try {
      await deleteVendorPayment(p.id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = payments.filter(
    (p) =>
      !q ||
      [p.payment_number, p.vendor_name, p.reference].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="vendorpayments"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-5 flex gap-3 items-center">
          <div className="flex-1">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search payments made..."
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
          >
            + Pay Vendor
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            No payments made yet.
          </p>
        ) : (
          <div className="space-y-2">
            {shown.map((p) => {
              const open = expandedId === p.id;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : p.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {p.payment_number}{" "}
                        <span className="text-gray-400 font-normal">
                          · {p.vendor_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {formatJournalDate(p.payment_date)} · {p.payment_mode}{" "}
                        from {p.paid_from_account_name}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-red-700">
                      {formatRs(p.amount)}
                    </span>
                    {open ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {p.reference && (
                        <p className="text-sm text-gray-600">
                          Reference: {p.reference}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                          {p.notes}
                        </p>
                      )}
                      <div className="text-sm space-y-1">
                        <p className="text-xs text-gray-400 uppercase">
                          Applied to
                        </p>
                        {p.allocations.map((a) => (
                          <div key={a.id} className="flex justify-between">
                            <span className="text-gray-900">
                              {a.bill_number}
                            </span>
                            <span>{formatRs(a.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <Gate right="delete_records">
                        <button
                          onClick={() => handleDelete(p)}
                          className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Delete payment
                        </button>
                      </Gate>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <VendorPaymentForm onClose={() => setFormOpen(false)} onSaved={load} />
      )}
    </div>
  );
}

// initialVendorId / initialBillId: used by the "Record payment" button on a bill
function VendorPaymentForm({
  initialVendorId = "",
  initialBillId = null,
  onClose,
  onSaved,
}) {
  const [vendors, setVendors] = useState([]);
  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vendorId, setVendorId] = useState(initialVendorId);
  const [date, setDate] = useState(toISODate(new Date()));
  const [mode, setMode] = useState("Cash");
  const [paidFromId, setPaidFromId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [applied, setApplied] = useState({}); // bill id -> amount typed
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const cls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  useEffect(() => {
    Promise.all([getVendors(), getPurchaseBills(), getAccounts()])
      .then(([v, b, acc]) => {
        setVendors(v);
        setBills(b);
        const sources = acc.filter((a) =>
          PAID_FROM_ACCOUNT_TYPES.includes(a.account_type),
        );
        setAccounts(sources);
        const preferred =
          sources.find(
            (a) => a.account_type === "cash" || a.account_type === "bank",
          ) || sources[0];
        if (preferred) setPaidFromId(preferred.id);
        const start = b.find((x) => x.id === initialBillId);
        if (start) setApplied({ [start.id]: String(start.balance_due) });
      })
      .catch((err) => setError(err.message));
  }, []);

  const owed = bills
    .filter(
      (b) =>
        b.vendor_id === vendorId &&
        b.status === "open" &&
        b.balance_due > 0.004,
    )
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  const pickVendor = (id) => {
    setVendorId(id);
    setApplied({});
  };
  const setAmount = (id, value) =>
    setApplied((prev) => ({ ...prev, [id]: value }));

  const rows = owed.filter((b) => toCents(applied[b.id]) > 0);
  const totalCents = rows.reduce((s, b) => s + toCents(applied[b.id]), 0);
  const tooMuch = (b) => toCents(applied[b.id]) > toCents(b.balance_due);
  const canSave =
    Boolean(vendorId) &&
    Boolean(paidFromId) &&
    rows.length > 0 &&
    !rows.some(tooMuch);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createVendorPayment({
        vendor_id: vendorId,
        payment_date: date,
        payment_mode: mode,
        paid_from_account_id: Number(paidFromId),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        allocations: rows.map((b) => ({
          bill_id: b.id,
          amount: Number(applied[b.id]),
        })),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Pay Vendor</h2>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Vendor</FieldLabel>
            <SearchSelect
              value={vendorId}
              onChange={pickVendor}
              options={vendorOptions}
              placeholder="Select a vendor..."
              searchPlaceholder="Search vendors..."
              emptyText="No vendors found"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">
              Payment date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cls + " mt-1"}
              />
            </label>
            <label className="text-xs text-gray-500">
              Payment mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className={cls + " mt-1"}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Paid from
              <select
                value={paidFromId}
                onChange={(e) => setPaidFromId(e.target.value)}
                className={cls + " mt-1"}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <FieldLabel>Bills to pay</FieldLabel>
            {!vendorId ? (
              <p className="text-sm text-gray-400">
                Pick a vendor to see what you owe them.
              </p>
            ) : owed.length === 0 ? (
              <p className="text-sm text-gray-400">
                You have no unpaid bills from this vendor.
              </p>
            ) : (
              owed.map((b) => (
                <div
                  key={b.id}
                  className="border border-gray-200 rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {b.bill_number}
                      {b.vendor_ref && (
                        <span className="text-gray-400 font-normal">
                          {" "}
                          · {b.vendor_ref}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      Due {formatJournalDate(b.due_date)} · Owed{" "}
                      {formatRs(b.balance_due)}
                    </p>
                    {tooMuch(b) && (
                      <p className="text-xs text-red-600">More than is owed.</p>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={applied[b.id] ?? ""}
                    onChange={(e) => setAmount(b.id, e.target.value)}
                    className={cls + " !w-28"}
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(b.id, String(b.balance_due))}
                    className="text-xs text-blue-600 font-medium whitespace-nowrap"
                  >
                    Pay in full
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Reference (cheque no., transfer ID...)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={cls}
            />
            <input
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cls}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between font-semibold">
            <span>Amount paid</span>
            <span>{formatRs(totalCents / 100)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || submitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Bill (bulk stock entry, admin only) ----------
// A "bill" is a batch of restocks saved together (see /api/bills on the backend).
const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400";

function FieldLabel({ children, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <label className="text-sm font-semibold text-gray-700">{children}</label>
      {action}
    </div>
  );
}

// Solid blue button that matches "+ Add Product"
function FieldButton({ onClick, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap hover:bg-blue-700 active:scale-[0.98] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      <Plus size={15} />
      {children}
    </button>
  );
}

function SearchSelect({
  value,
  onChange,
  options, // [{ value, label, hint? }]
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  disabled = false,
  onCreateNew = null,
  createLabel = "item",
  searchable = true,
  wrap = false, // true = show the full (long) name on several lines instead of cutting it with "..."
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => (o.search || o.label).toLowerCase().includes(q))
    : options;
  const canCreate =
    Boolean(onCreateNew) &&
    q !== "" &&
    !options.some((o) => o.label.trim().toLowerCase() === q);
  const rowCount = filtered.length + (canCreate ? 1 : 0);
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const createNow = () => {
    const name = query.trim();
    close();
    onCreateNew(name);
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled]);
  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const choose = (option) => {
    onChange(option.value);
    close();
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
      else if (canCreate) createNow();
    }
  };

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected ? selected.label : undefined}
        className={`w-full flex ${wrap ? "items-start" : "items-center"} justify-between gap-2 border rounded-lg px-3 py-2.5 text-sm text-left bg-white transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:border-gray-300 ${
          open
            ? "border-blue-500 ring-2 ring-blue-100"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className="flex items-start gap-2 min-w-0">
          {selected && "thumb" in selected && (
            <ItemThumb product={selected.thumb} size={32} />
          )}
          <span
            className={`${wrap ? "break-words whitespace-normal leading-snug" : "truncate"} ${selected ? "text-gray-900" : "text-gray-400"}`}
          >
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 mt-0.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden ${wrap ? "sm:w-[380px] sm:max-w-[80vw]" : ""}`}
        >
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-gray-400 text-center">
                {q ? `No matches for "${query.trim()}".` : emptyText}
              </li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer ${
                    i === active ? "bg-blue-50" : ""
                  } ${o.value === value ? "font-medium text-blue-700" : "text-gray-800"}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {"thumb" in o && <ItemThumb product={o.thumb} size={32} />}
                    <span
                      className={
                        wrap ? "break-words whitespace-normal" : "truncate"
                      }
                    >
                      {o.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {o.hint && (
                      <span className="text-xs text-gray-400 font-normal">
                        {o.hint}
                      </span>
                    )}
                    {o.value === value && <Check size={14} />}
                  </span>
                </li>
              ))
            )}
            {canCreate && (
              <li
                role="option"
                onClick={createNow}
                onMouseEnter={() => setActive(filtered.length)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm cursor-pointer font-medium text-blue-600 border-t border-gray-100 ${
                  active === filtered.length ? "bg-blue-50" : ""
                }`}
              >
                <span className="truncate">
                  + Create new {createLabel} "{query.trim()}"
                </span>
                <span className="shrink-0 text-xs font-normal text-gray-400">
                  Press Enter
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Inline "create item" panel shown under the Item title
function CreateItemPanel({
  existingNames,
  parentOptions = [],
  onCreate,
  onCancel,
}) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    price: "",
    is_subitem: false,
    parent_id: "",
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) return setError("Enter an item name");
    if (existingNames.includes(name.toLowerCase())) {
      return setError("This item already exists - select it from the list");
    }
    if (form.is_subitem && !form.parent_id) {
      return setError('Select the parent item, or untick "Subitem of"');
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate(
        {
          name,
          sku: form.sku.trim(),
          description: "",
          quantity: 0, // stock is added through the bill so it is logged with a timestamp
          price: form.price || 0,
          parent_id: form.is_subitem ? form.parent_id : "",
        },
        imageFiles,
      );
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 border border-blue-200 bg-blue-50/50 rounded-xl p-3 space-y-2">
      <p className="text-xs font-medium text-blue-700">New item</p>
      {error && (
        <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <input
        autoFocus
        placeholder="Item name *"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        className={inputCls}
      />
      <div className="flex items-center gap-2">
        <input
          id="new_item_is_subitem"
          type="checkbox"
          checked={form.is_subitem}
          onChange={(e) => {
            set("is_subitem", e.target.checked);
            if (!e.target.checked) set("parent_id", "");
          }}
          className="rounded border-gray-300"
        />
        <label
          htmlFor="new_item_is_subitem"
          className="text-sm text-gray-700 whitespace-nowrap"
        >
          Subitem of
        </label>
        <select
          disabled={!form.is_subitem}
          value={form.parent_id}
          onChange={(e) => set("parent_id", e.target.value)}
          className={`${inputCls} flex-1 min-w-0`}
        >
          <option value="">Select parent item...</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="SKU (optional)"
          value={form.sku}
          onChange={(e) => set("sku", e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price (optional)"
          value={form.price}
          onChange={(e) => set("price", e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Images (optional - you can add them later)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImageFiles(Array.from(e.target.files))}
          className="w-full text-xs"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 bg-white rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create item"}
        </button>
      </div>
    </div>
  );
}

// Asks for the stock adder's name, then saves the whole bill
function SubmitBillModal({ lines, onSubmit, onClose, initialName = "" }) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter the stock adder's name");
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim().replace(/\s+/g, " "));
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Receipt size={18} className="text-green-600" />
          <h2 className="text-lg font-semibold">Submit Bill</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {lines.length} {lines.length === 1 ? "item" : "items"} · {totalUnits}{" "}
          units will be added to stock
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Stock adder name *
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ---------- New bill form ----------
function NewBillForm({ onBack, onSaved, editBill = null }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState([]); // [{ product, quantity }]
  const [formError, setFormError] = useState(null);

  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    getProducts()
      .then((p) => {
        setProducts(p);
        if (editBill) {
          // start from the bill's current lines; show stock as it was BEFORE this bill
          const flat = flattenParents(p);
          setLines(
            editBill.items
              .map((it) => {
                const prod = flat.find((x) => x.id === it.product_id);
                return prod
                  ? {
                      product: {
                        ...prod,
                        quantity: prod.quantity - it.quantity,
                      },
                      quantity: it.quantity,
                    }
                  : null;
              })
              .filter(Boolean),
          );
        }
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const allItems = flattenParents(products);
  const billableItems = allItems
    .filter((p) => !(p.subitems?.length > 0)) // only real, leaf-level items can be billed - categories can't
    .sort((a, b) => compareNames(a.name, b.name));
  const selectedItem = billableItems.find((p) => String(p.id) === itemId);
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);
  const qtyNumber = Number(quantity);
  const qtyValid = Number.isInteger(qtyNumber) && qtyNumber > 0;

  const itemOptions = billableItems.map((p) => ({
    value: String(p.id),
    label: p.label,
    hint: `${p.quantity} in stock`,
  }));
  const handleCreateItem = async (values, imageFiles) => {
    const created = await createProduct(values, imageFiles);
    setProducts((prev) => [...prev, created]);
    setItemId(String(created.id));
    setShowCreateItem(false);
  };

  const handleAddToList = () => {
    setFormError(null);
    if (!selectedItem) return setFormError("Select an item first");
    if (!qtyValid) return setFormError("Enter a whole quantity greater than 0");

    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === selectedItem.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === selectedItem.id
            ? { ...l, quantity: l.quantity + qtyNumber }
            : l,
        );
      }
      return [...prev, { product: selectedItem, quantity: qtyNumber }];
    });
    setItemId("");
    setQuantity("");
  };

  const stepQuantity = (delta) =>
    setQuantity(String(Math.max(1, (Number(quantity) || 0) + delta)));

  const handleLineQty = (productId, value) => {
    const qty = Math.max(1, Math.floor(Number(value)) || 1);
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, quantity: qty } : l,
      ),
    );
  };

  const handleRemoveLine = (productId) =>
    setLines((prev) => prev.filter((l) => l.product.id !== productId));

  const handleSubmitBill = async (adderName) => {
    const items = lines.map((l) => ({
      product_id: l.product.id,
      quantity: l.quantity,
    }));
    if (editBill) await updateBill(editBill.id, adderName, items);
    else await createBill(adderName, items);
    onSaved();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader
        title={editBill ? "Edit Bill" : "New Bill"}
        subtitle={
          editBill
            ? "Change the items or quantities of this bill"
            : "Add stock for many items at once"
        }
        onBack={onBack}
      />

      <main className="p-4 sm:p-6 max-w-2xl space-y-4">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : loadError ? (
          <p className="text-red-500 text-center py-16">{loadError}</p>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-5">
              {formError && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Item */}
              <div>
                <FieldLabel
                  action={
                    <FieldButton onClick={() => setShowCreateItem((v) => !v)}>
                      Create Item
                    </FieldButton>
                  }
                >
                  Item
                </FieldLabel>

                {showCreateItem && (
                  <CreateItemPanel
                    existingNames={allItems.map((p) => p.name.toLowerCase())}
                    parentOptions={allItems.filter((p) => !p.parent_id)}
                    onCreate={handleCreateItem}
                    onCancel={() => setShowCreateItem(false)}
                  />
                )}

                <SearchSelect
                  value={itemId}
                  onChange={setItemId}
                  options={itemOptions}
                  placeholder={
                    billableItems.length
                      ? "Search or select item"
                      : "No items yet"
                  }
                  searchPlaceholder="Search items..."
                  emptyText={
                    billableItems.length ? "No item found" : "No items yet"
                  }
                />
                {billableItems.length === 0 && !showCreateItem && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    No items yet - use “Create Item” to add one.
                  </p>
                )}

                {/* Quantity + add to list, right under the item select */}
                <div
                  className={`mt-4 rounded-xl border p-3 sm:p-4 transition ${selectedItem ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-gray-50/60"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Quantity
                    </span>
                    {selectedItem && (
                      <span className="text-xs text-gray-500">
                        In stock:{" "}
                        <span className="font-medium text-gray-700">
                          {selectedItem.quantity}
                        </span>
                        {qtyValid && (
                          <>
                            {" "}
                            →{" "}
                            <span className="font-medium text-green-600">
                              {selectedItem.quantity + qtyNumber}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div
                      className={`flex items-stretch rounded-lg border border-gray-300 bg-white overflow-hidden sm:w-44 ${!selectedItem ? "opacity-50" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => stepQuantity(-1)}
                        disabled={!selectedItem}
                        aria-label="Decrease quantity"
                        className="w-11 text-lg text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={quantity}
                        disabled={!selectedItem}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), handleAddToList())
                        }
                        aria-label="Quantity"
                        className="flex-1 min-w-0 text-center text-sm font-medium border-x border-gray-200 py-2.5 focus:outline-none focus:bg-blue-50 disabled:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => stepQuantity(1)}
                        disabled={!selectedItem}
                        aria-label="Increase quantity"
                        className="w-11 text-lg text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToList}
                      disabled={!selectedItem || !qtyValid}
                      className="sm:flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap hover:bg-blue-700 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      <Plus size={16} />
                      Add to list
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill item list */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Bill items{" "}
                <span className="text-gray-400 font-normal">
                  ({lines.length} · {totalUnits} units)
                </span>
              </h2>
              {lines.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No items added yet. Pick an item and quantity above, then “Add
                  to list”.
                </p>
              ) : (
                <div className="space-y-2">
                  {lines.map((l) => {
                    return (
                      <div
                        key={l.product.id}
                        className="flex items-center gap-3 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {l.product.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {l.product.quantity} →{" "}
                            <span className="font-medium text-green-600">
                              {l.product.quantity + l.quantity}
                            </span>
                          </p>
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={l.quantity}
                          onChange={(e) =>
                            handleLineQty(l.product.id, e.target.value)
                          }
                          aria-label={`Quantity for ${l.product.name}`}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(l.product.id)}
                          aria-label="Remove"
                          className="p-1.5 rounded-full text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              disabled={lines.length === 0}
              className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editBill ? "Save Changes" : "Submit Bill"}
            </button>
          </>
        )}
      </main>

      {showSubmit && (
        <SubmitBillModal
          lines={lines}
          initialName={editBill?.adder_name || ""}
          onSubmit={handleSubmitBill}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </div>
  );
}

// ---------- Bill page: list of submitted bills (newest first) ----------
function BillPage({ go, autoCreateToken }) {
  const [creating, setCreating] = useState(false);
  const [editBill, setEditBill] = useState(null); // the bill being edited
  useQuickNew(() => setCreating(true));
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = async () => {
    try {
      setBills(await getBills());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 10000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (autoCreateToken) setCreating(true);
  }, [autoCreateToken]);

  const handleDelete = async (bill) => {
    const units = bill.items.reduce((sum, m) => sum + m.quantity, 0);
    if (
      !window.confirm(
        `Delete this bill by ${bill.adder_name}? The ${units} units it added will be taken out of stock again.`,
      )
    )
      return;
    try {
      await deleteBill(bill.id);
      setOpenId(null);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (creating || editBill) {
    return (
      <NewBillForm
        key={editBill ? editBill.id : "new"}
        editBill={editBill}
        onBack={() => {
          setCreating(false);
          setEditBill(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditBill(null);
          setLoading(true);
          load();
        }}
      />
    );
  }

  const monthOptions = getMonthOptions(bills.map((b) => b.created_at));
  const shown = selectedMonth
    ? bills.filter((b) => b.created_at?.slice(0, 7) === selectedMonth)
    : bills;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin
        active="bill"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + New Bill
          </button>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Bills{" "}
            <span className="text-gray-400 font-normal">({shown.length})</span>
          </h2>
          <MonthSelect
            options={monthOptions}
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error && bills.length === 0 ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">
            {bills.length === 0
              ? "No bills yet. Tap “New Bill” to add stock in bulk."
              : "No bills for this month."}
          </p>
        ) : (
          <div className="space-y-2">
            {shown.map((bill) => {
              const open = openId === bill.id;
              const units = bill.items.reduce((sum, m) => sum + m.quantity, 0);
              return (
                <div
                  key={bill.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenId(open ? null : bill.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                  >
                    <div className="p-2 rounded-full bg-green-50 text-green-600 shrink-0">
                      <Receipt size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {bill.adder_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(bill.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">
                        +{units}
                      </p>
                      <p className="text-xs text-gray-400">
                        {bill.items.length}{" "}
                        {bill.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                      {bill.items
                        .slice()
                        .sort((a, b) =>
                          compareNames(
                            a.product?.name || "",
                            b.product?.name || "",
                          ),
                        )
                        .map((m) => (
                          <div
                            key={m.id}
                            className="flex justify-between items-center gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-gray-900 truncate">
                                {m.product?.name || `Product #${m.product_id}`}
                              </p>
                            </div>
                            <span className="font-semibold text-green-600 shrink-0">
                              +{m.quantity}
                            </span>
                          </div>
                        ))}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setEditBill(bill)}
                          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white"
                        >
                          <Pencil size={14} /> Edit bill
                        </button>
                        <Gate right="delete_records">
                          <button
                            onClick={() => handleDelete(bill)}
                            className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
                          >
                            <Trash2 size={14} /> Delete bill
                          </button>
                        </Gate>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Issued (decrease stock from a list of items employees took, admin only) ----------
const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function formatIssuedDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const pretty = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const now = new Date();
  if (iso === toISODate(now)) return `Today · ${pretty}`;
  if (
    iso ===
    toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  )
    return `Yesterday · ${pretty}`;
  return pretty;
}

// ---------- Review popup shown before stock is deducted ----------
function ReviewIssuedModal({
  date,
  responsible,
  rows,
  warnings,
  error,
  submitting,
  onBack,
  onConfirm,
}) {
  const totalDeduct = rows.reduce((sum, r) => sum + r.deduct, 0);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={18} className="text-amber-600" />
          <h2 className="text-lg font-semibold">Review before deducting</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {formatIssuedDate(date)} · by {responsible}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {rows.map((r) => (
            <div
              key={r.product.id}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex justify-between items-start gap-3">
                <p className="font-medium text-gray-900 truncate">
                  {r.product.name}
                </p>
                <p className="text-sm shrink-0">
                  {r.product.quantity} →{" "}
                  <span className="font-semibold text-amber-600">
                    {r.product.quantity - r.deduct}
                  </span>
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {r.covered > 0
                  ? `List ${r.total} − ${r.covered} already deducted via approved request${r.covered === r.total ? "" : "s"} = ${r.deduct} to deduct now`
                  : `${r.deduct} to deduct now`}
              </p>
            </div>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-amber-800 mb-1">
              Check for double counting
            </p>
            <p className="text-xs text-amber-700 mb-2">
              These approved requests are for items in this list but are not
              ticked. If they are part of this list, go back and tick them -
              otherwise they will be deducted a second time.
            </p>
            <ul className="text-xs text-amber-800 space-y-0.5">
              {warnings.map((w) => (
                <li key={w.id}>
                  • {w.product?.name || `Product #${w.product_id}`} ×{" "}
                  {w.quantity} - {w.requested_by || "unknown"}, approved{" "}
                  {formatDateTime(w.resolved_at)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          Total to deduct:{" "}
          <span className="font-semibold text-amber-600">{totalDeduct}</span>{" "}
          units
        </p>

        <div className="flex gap-2">
          <button
            onClick={onBack}
            disabled={submitting}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Confirm & deduct"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Create issued list form ----------
function NewIssuedForm({ onBack, onSaved }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [issuedDate, setIssuedDate] = useState(toISODate(new Date()));
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState([]); // [{ product, quantity }]  quantity = total taken (QuickBooks)
  const [description, setDescription] = useState("");
  const [responsibleBy, setResponsibleBy] = useState("");
  const [formError, setFormError] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // approved requests whose stock was already deducted (double-count protection)
  const [reconcilable, setReconcilable] = useState([]);
  const [reconcileError, setReconcileError] = useState(false);
  const [ticked, setTicked] = useState([]); // request ids
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTicked([]);
    setReconcileError(false);
    getReconcilableRequests(issuedDate)
      .then((data) => {
        if (!cancelled) setReconcilable(data);
      })
      .catch(() => {
        if (!cancelled) {
          setReconcilable([]);
          setReconcileError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [issuedDate]);

  const tickedSet = new Set(ticked);
  const coveredByProduct = {};
  reconcilable.forEach((r) => {
    if (tickedSet.has(r.id))
      coveredByProduct[r.product_id] =
        (coveredByProduct[r.product_id] || 0) + r.quantity;
  });
  const covered = (productId) => coveredByProduct[productId] || 0;

  const leafProducts = flattenParents(products).filter(
    (p) => !(p.subitems?.length > 0),
  );
  const sortedProducts = [...leafProducts].sort((a, b) =>
    compareNames(a.name, b.name),
  );
  const itemOptions = sortedProducts.map((p) => ({
    value: String(p.id),
    label: p.label,
    hint: `${p.quantity} in stock`,
  }));
  const selectedItem = leafProducts.find((p) => String(p.id) === itemId);
  const alreadyInList =
    lines.find((l) => l.product.id === selectedItem?.id)?.quantity || 0;
  const pendingDeduct = selectedItem
    ? Math.max(0, alreadyInList - covered(selectedItem.id))
    : 0;
  const availableStock = selectedItem
    ? selectedItem.quantity - pendingDeduct
    : 0;
  const qtyNumber = Number(quantity);
  const qtyValid = Number.isInteger(qtyNumber) && qtyNumber > 0;

  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);
  const deductUnits = lines.reduce(
    (sum, l) => sum + (l.quantity - covered(l.product.id)),
    0,
  );

  const isSameDay = (r) =>
    r.resolved_at && toISODate(new Date(r.resolved_at)) === issuedDate;
  const sameDayRequests = reconcilable.filter(isSameDay);
  const otherRequests = reconcilable.filter((r) => !isSameDay(r));

  const canTick = (r) => {
    const line = lines.find((l) => l.product.id === r.product_id);
    return !!line && covered(r.product_id) + r.quantity <= line.quantity;
  };
  const toggleTick = (r) => {
    setFormError(null);
    setTicked((prev) =>
      prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
    );
  };

  // "+ Create Product" uses the same form as the main product screen
  const handleCreateProduct = async (values, imageFiles) => {
    const created = await createProduct(values, imageFiles);
    setProducts((prev) => [...prev, created]);
    setItemId(String(created.id));
  };

  const stepQuantity = (delta) =>
    setQuantity(String(Math.max(1, (Number(quantity) || 0) + delta)));

  const handleAddToList = () => {
    setFormError(null);
    if (!selectedItem) return setFormError("Select an item first");
    if (!qtyValid) return setFormError("Enter a whole quantity greater than 0");
    if (qtyNumber > availableStock) {
      return setFormError(
        `Only ${selectedItem.quantity} of "${selectedItem.name}" in stock` +
          (pendingDeduct ? ` (${pendingDeduct} already in this list)` : ""),
      );
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === selectedItem.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === selectedItem.id
            ? { ...l, quantity: l.quantity + qtyNumber }
            : l,
        );
      }
      return [...prev, { product: selectedItem, quantity: qtyNumber }];
    });
    setItemId("");
    setQuantity("");
  };

  const handleLineQty = (productId, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l;
        const min = Math.max(1, covered(productId));
        const max = l.product.quantity + covered(productId);
        return {
          ...l,
          quantity: Math.min(
            max,
            Math.max(min, Math.floor(Number(value)) || 1),
          ),
        };
      }),
    );
  };

  const handleRemoveLine = (productId) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
    // ticked requests only make sense while their item is in the list
    setTicked((prev) =>
      prev.filter(
        (id) => reconcilable.find((r) => r.id === id)?.product_id !== productId,
      ),
    );
  };

  const handleReview = () => {
    setFormError(null);
    if (lines.length === 0)
      return setFormError("Add at least one item to the list");
    if (!issuedDate) return setFormError("Select the issued date");
    if (!responsibleBy.trim())
      return setFormError("Responsible by is required");
    setShowReview(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createIssuedList({
        issued_date: issuedDate,
        description: description.trim() || null,
        responsible_by: responsibleBy.trim().replace(/\s+/g, " "),
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        request_ids: ticked,
      });
      onSaved();
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  const reviewRows = lines.map((l) => ({
    product: l.product,
    total: l.quantity,
    covered: covered(l.product.id),
    deduct: l.quantity - covered(l.product.id),
  }));
  // only warn about requests approved on the chosen date; nearby-day ones stay optional in the checklist
  const warnings = sameDayRequests.filter(
    (r) =>
      !tickedSet.has(r.id) && lines.some((l) => l.product.id === r.product_id),
  );

  const renderRequest = (r) => {
    const isTicked = tickedSet.has(r.id);
    const hasLine = lines.some((l) => l.product.id === r.product_id);
    const disabled = !isTicked && !canTick(r);
    return (
      <label
        key={r.id}
        className={`flex items-start gap-3 border rounded-lg p-3 ${isTicked ? "border-blue-300 bg-blue-50/50" : "border-gray-200"} ${disabled ? "opacity-60" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={isTicked}
          disabled={disabled}
          onChange={() => toggleTick(r)}
          className="mt-1 h-4 w-4 accent-blue-600"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {r.product?.name || `Product #${r.product_id}`}{" "}
            <span className="text-gray-500 font-normal">× {r.quantity}</span>
          </p>
          <p className="text-xs text-gray-400 truncate">
            Requested by {r.requested_by || "-"} · approved{" "}
            {formatDateTime(r.resolved_at)}
          </p>
          {disabled && (
            <p className="text-xs text-amber-600 mt-0.5">
              {hasLine
                ? "More than the quantity in the list"
                : "Add this item to the list first"}
            </p>
          )}
        </div>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader
        title="Create Issued List"
        subtitle="Reduce stock for items employees took"
        onBack={onBack}
      />

      <main className="p-4 sm:p-6 max-w-2xl space-y-4">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : loadError ? (
          <p className="text-red-500 text-center py-16">{loadError}</p>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-5">
              {formError && !showReview && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Date (native mini calendar) */}
              <div>
                <FieldLabel>Issued date</FieldLabel>
                <input
                  type="date"
                  value={issuedDate}
                  max={toISODate(new Date())}
                  onChange={(e) => setIssuedDate(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  The day the employees took these items.
                </p>
              </div>

              {/* Item */}
              <div>
                <FieldLabel
                  action={
                    <FieldButton onClick={() => setShowProductForm(true)}>
                      Create Product
                    </FieldButton>
                  }
                >
                  Item
                </FieldLabel>
                <SearchSelect
                  value={itemId}
                  onChange={setItemId}
                  options={itemOptions}
                  placeholder="Search or select item"
                  searchPlaceholder="Search items..."
                  emptyText={
                    products.length
                      ? "No item found - use “Create Product”"
                      : "No products yet - use “Create Product”"
                  }
                />

                {/* Quantity + add to list */}
                <div
                  className={`mt-4 rounded-xl border p-3 sm:p-4 transition ${selectedItem ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-gray-50/60"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Quantity taken
                    </span>
                    {selectedItem && (
                      <span className="text-xs text-gray-500">
                        In stock:{" "}
                        <span className="font-medium text-gray-700">
                          {availableStock}
                        </span>
                        {qtyValid && (
                          <>
                            {" "}
                            →{" "}
                            <span
                              className={`font-medium ${availableStock - qtyNumber < 0 ? "text-red-600" : "text-amber-600"}`}
                            >
                              {availableStock - qtyNumber}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div
                      className={`flex items-stretch rounded-lg border border-gray-300 bg-white overflow-hidden sm:w-44 ${!selectedItem ? "opacity-50" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => stepQuantity(-1)}
                        disabled={!selectedItem}
                        aria-label="Decrease quantity"
                        className="w-11 text-lg text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={quantity}
                        disabled={!selectedItem}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), handleAddToList())
                        }
                        aria-label="Quantity"
                        className="flex-1 min-w-0 text-center text-sm font-medium border-x border-gray-200 py-2.5 focus:outline-none focus:bg-blue-50 disabled:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => stepQuantity(1)}
                        disabled={!selectedItem}
                        aria-label="Increase quantity"
                        className="w-11 text-lg text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToList}
                      disabled={!selectedItem || !qtyValid}
                      className="sm:flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap hover:bg-blue-700 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      <Plus size={16} />
                      Add to list
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Issued item list */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Issued items{" "}
                <span className="text-gray-400 font-normal">
                  ({lines.length} · {totalUnits} units)
                </span>
              </h2>
              {lines.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No items added yet. Pick an item and quantity above, then “Add
                  to list”.
                </p>
              ) : (
                <div className="space-y-2">
                  {lines.map((l) => {
                    const cov = covered(l.product.id);
                    return (
                      <div
                        key={l.product.id}
                        className="flex items-center gap-3 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {l.product.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {l.product.quantity} →{" "}
                            <span className="font-medium text-amber-600">
                              {l.product.quantity - (l.quantity - cov)}
                            </span>
                          </p>
                          {cov > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              {l.quantity} in list − {cov} already deducted via
                              approved requests
                            </p>
                          )}
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={l.quantity}
                          onChange={(e) =>
                            handleLineQty(l.product.id, e.target.value)
                          }
                          aria-label={`Quantity for ${l.product.name}`}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(l.product.id)}
                          aria-label="Remove"
                          className="p-1.5 rounded-full text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Approved requests already deducted (prevents counting them twice) */}
            {(reconcilable.length > 0 || reconcileError) && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-1">
                  Already deducted via requests
                </h2>
                {reconcileError ? (
                  <p className="text-sm text-red-500">
                    Couldn't load approved requests, so double-count protection
                    is off. Reopen this form to try again.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-3">
                      Stock for these requests was already reduced when they
                      were approved. If an item on your list was one of them,
                      tick it so it is not deducted twice.
                    </p>
                    <div className="space-y-2">
                      {sameDayRequests.length === 0 && (
                        <p className="text-sm text-gray-400">
                          No approved requests on {formatIssuedDate(issuedDate)}
                          .
                        </p>
                      )}
                      {sameDayRequests.map(renderRequest)}
                    </div>
                    {otherRequests.length > 0 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setShowOthers((v) => !v)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          {showOthers ? "Hide" : "Show"} {otherRequests.length}{" "}
                          other approved{" "}
                          {otherRequests.length === 1 ? "request" : "requests"}{" "}
                          from nearby days
                        </button>
                        {showOthers && (
                          <div className="space-y-2 mt-2">
                            {otherRequests.map(renderRequest)}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Description + responsible */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-5">
              <div>
                <FieldLabel>
                  Description{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </FieldLabel>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Items from QuickBooks report"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>
                  Responsible by <span className="text-red-500">*</span>
                </FieldLabel>
                <input
                  value={responsibleBy}
                  onChange={(e) => setResponsibleBy(e.target.value)}
                  placeholder="Name of the person who created this list"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleReview}
                disabled={lines.length === 0}
                className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Review & Create
              </button>
              {lines.length > 0 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  This will reduce stock by {deductUnits}{" "}
                  {deductUnits === 1 ? "unit" : "units"} across {lines.length}{" "}
                  {lines.length === 1 ? "item" : "items"}.
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {showProductForm && (
        <ProductForm
          onSubmit={handleCreateProduct}
          onClose={() => setShowProductForm(false)}
        />
      )}

      {showReview && (
        <ReviewIssuedModal
          date={issuedDate}
          responsible={responsibleBy.trim()}
          rows={reviewRows}
          warnings={warnings}
          error={formError}
          submitting={submitting}
          onBack={() => {
            setShowReview(false);
            setFormError(null);
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

// ---------- Issued page: lists grouped by the selected date (newest first) ----------
function IssuedPage({ go, autoCreateToken }) {
  const [creating, setCreating] = useState(false);
  useQuickNew(() => setCreating(true));
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [openId, setOpenId] = useState(null);
  const [undoingId, setUndoingId] = useState(null);
  const [undoError, setUndoError] = useState(null);

  const load = async () => {
    try {
      setLists(await getIssuedLists());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 10000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (autoCreateToken) setCreating(true);
  }, [autoCreateToken]);

  const handleUndo = async (list) => {
    const units = list.items.reduce((sum, m) => sum + m.quantity, 0);
    const extra = list.covered_requests?.length
      ? " Its approved requests can be counted again."
      : "";
    if (
      !confirm(
        `Undo this issued list?\n\n${units} units will be added back to stock.${extra}`,
      )
    )
      return;
    setUndoingId(list.id);
    setUndoError(null);
    try {
      await deleteIssuedList(list.id);
      setOpenId(null);
      await load();
    } catch (err) {
      setUndoError(err.message);
    } finally {
      setUndoingId(null);
    }
  };

  if (creating) {
    return (
      <NewIssuedForm
        onBack={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          setLoading(true);
          load();
        }}
      />
    );
  }

  const monthOptions = getMonthOptions(lists.map((l) => l.issued_date));
  const shown = selectedMonth
    ? lists.filter((l) => l.issued_date.slice(0, 7) === selectedMonth)
    : lists;

  // the server already sorts by issued_date (newest first); group neighbours that share a date
  const groups = [];
  shown.forEach((l) => {
    const last = groups[groups.length - 1];
    if (last && last.date === l.issued_date) last.lists.push(l);
    else groups.push({ date: l.issued_date, lists: [l] });
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin
        active="issued"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 w-full max-w-3xl">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Create Issued List
          </button>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Issued lists{" "}
            <span className="text-gray-400 font-normal">({shown.length})</span>
          </h2>
          <MonthSelect
            options={monthOptions}
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>

        {undoError && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
            {undoError}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error && lists.length === 0 ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">
            {lists.length === 0
              ? "No issued lists yet. Tap “Create Issued List” to reduce stock from a list."
              : "No issued lists for this month."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.date}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {formatIssuedDate(g.date)}
                </h3>
                <div className="space-y-2">
                  {g.lists.map((list) => {
                    const open = openId === list.id;
                    const covered = list.covered_requests || [];
                    const units = list.items.reduce(
                      (sum, m) => sum + m.quantity,
                      0,
                    );
                    const productCount = new Set([
                      ...list.items.map((m) => m.product_id),
                      ...covered.map((r) => r.product_id),
                    ]).size;
                    return (
                      <div
                        key={list.id}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => setOpenId(open ? null : list.id)}
                          aria-expanded={open}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                        >
                          <div className="p-2 rounded-full bg-amber-50 text-amber-600 shrink-0">
                            <ClipboardList size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {list.responsible_by}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {list.description ||
                                `Created ${formatDateTime(list.created_at)}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-amber-600">
                              −{units}
                            </p>
                            <p className="text-xs text-gray-400">
                              {productCount}{" "}
                              {productCount === 1 ? "item" : "items"}
                              {covered.length > 0 &&
                                ` · ${covered.length} via requests`}
                            </p>
                          </div>
                          <ChevronDown
                            size={18}
                            className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                          />
                        </button>

                        {open && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                            {list.description && (
                              <p className="text-sm text-gray-600 whitespace-pre-line">
                                {list.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              Created {formatDateTime(list.created_at)}
                            </p>

                            {list.items.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Deducted by this list
                                </p>
                                {list.items
                                  .slice()
                                  .sort((a, b) =>
                                    compareNames(
                                      a.product?.name || "",
                                      b.product?.name || "",
                                    ),
                                  )
                                  .map((m) => (
                                    <div
                                      key={m.id}
                                      className="flex justify-between items-center gap-3 text-sm"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-gray-900 truncate">
                                          {m.product?.name ||
                                            `Product #${m.product_id}`}
                                        </p>
                                      </div>
                                      <span className="font-semibold text-amber-600 shrink-0">
                                        −{m.quantity}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {covered.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Already deducted via approved requests
                                </p>
                                {covered.map((r) => (
                                  <div
                                    key={r.id}
                                    className="flex justify-between items-center gap-3 text-sm"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-gray-900 truncate">
                                        {r.product?.name ||
                                          `Product #${r.product_id}`}
                                      </p>
                                      <p className="text-xs text-gray-400 truncate">
                                        {r.requested_by || "-"}
                                        {r.resolved_at
                                          ? ` · approved ${formatDateTime(r.resolved_at)}`
                                          : ""}
                                      </p>
                                    </div>
                                    <span className="font-medium text-gray-500 shrink-0">
                                      {r.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                              <p className="text-xs text-gray-400">
                                Entered by mistake? Undo puts the deducted stock
                                back.
                              </p>
                              <button
                                onClick={() => handleUndo(list)}
                                disabled={undoingId === list.id}
                                className="shrink-0 text-sm font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                              >
                                {undoingId === list.id
                                  ? "Undoing..."
                                  : "Undo list"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Ctrl+N / Ctrl+B / Ctrl+I admin shortcuts, anywhere in the app ----------
// ---------- Keyboard shortcuts (QuickBooks style) ----------
// A page calls useQuickNew(openItsNewForm). Ctrl+N then opens that page's "New" form.
// pendingNew covers "go to another page AND open its New form" (e.g. Ctrl+I from anywhere).
let pendingNew = false;
function useQuickNew(open) {
  const ref = useRef(open);
  ref.current = open;
  const active = useWindowActive();
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (pendingNew) {
      pendingNew = false;
      ref.current();
    }
    const onNew = (e) => {
      if (!activeRef.current) return; // a page in a background window must not react
      e.detail.handled = true;
      ref.current();
    };
    window.addEventListener("app:new", onNew);
    return () => window.removeEventListener("app:new", onNew);
  }, []);
}

const SHORTCUT_HELP = [
  [
    "Create",
    [
      [
        "Ctrl + N",
        "New - customer, invoice, bill... whatever page you are on (otherwise a new item)",
      ],
      ["Alt + A", "Same as Ctrl + N (works in a normal browser tab too)"],
      ["Ctrl + I", "Create invoice"],
      ["Ctrl + W", "Pay a vendor (new payment made)"],
      ["Ctrl + B", "New stock bill"],
    ],
  ],
  [
    "Go to",
    [
      ["Ctrl + A", "Chart of accounts"],
      ["Ctrl + J", "Customers"],
      ["Ctrl + L", "Items"],
      ["Ctrl + R", "Banking"],
      ["Ctrl + Y", "Manual journals"],
      ["Ctrl + Q", "Quick report on the account you last clicked"],
      ["Alt + R", "Reports"],
      ["Alt + H", "Home / dashboard"],
      ["Alt + C", "Customers"],
      ["Alt + V", "Vendors"],
      ["Alt + Q", "Quotes"],
      ["Alt + S", "Sales orders"],
      ["Alt + I", "Invoices"],
      ["Alt + P", "Payments received"],
      ["Alt + N", "Credit notes"],
      ["Alt + B", "Bills"],
      ["Alt + M", "Payments made"],
      ["Alt + X", "Taxes"],
      ["Alt + U", "Issued"],
      ["Alt + G", "Manage items"],
    ],
  ],
  [
    "Windows",
    [
      ["Alt + W", "Open a new window (a copy of this page)"],
      [
        "Alt + Shift + letter",
        "Open that page in a new window (Alt + Shift + I = Invoices, ...)",
      ],
      ["Ctrl + click", "Open a menu page (side or top menu) in a new window"],
      ["Alt + T", "Tile all windows side by side"],
      ["Alt + Shift + T", "Cascade all windows"],
      ["Alt + 1 ... 9", "Bring window 1 ... 9 to the front"],
      ["Alt + ]  /  Alt + [", "Next / previous window"],
      [
        "Alt + Shift + W  or  Esc",
        "Close this window (Esc: when no form is open in it)",
      ],
      
    ],
  ],
  [
    "Anywhere",
    [
      ["Ctrl + F  or  /", "Find (search)"],
      ["Ctrl + Enter", "Save the open form"],
      ["Esc", "Close the open form"],
      ["F1  or  ?", "Show this list"],
    ],
  ],
];

// the account the user last clicked on - Ctrl+Q opens a quick report on it (QuickBooks QuickReport)
let lastQuickAccount = null;

function QuickReportModal({ accountId, onClose }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [txOpen, setTxOpen] = useState(null);
  const { data, loading, error } = useReport(
    () => getAccountTransactions(accountId, to, false, from),
    [accountId, from, to],
  );
  const th = "px-2 py-1.5 text-xs font-semibold text-gray-500";
  const dateBox = (label, value, set) => (
    <label className="text-xs text-gray-500">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="block border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1"
      />
    </label>
  );
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 truncate">
            Quick report
            {data && <span className="text-gray-400 font-normal"> · {data.account.name}</span>}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            Close
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-gray-100">
          {dateBox("From", from, setFrom)}
          {dateBox("To", to, setTo)}
          {(from || to) && (
            <button
              type="button"
              onClick={() => { setFrom(""); setTo(""); }}
              className="text-sm text-blue-700 underline pb-1.5"
            >
              All dates
            </button>
          )}
          {!from && !to && <span className="text-xs text-gray-400 pb-2">All dates</span>}
        </div>
        <div className="overflow-auto p-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {loading && !data && <p className="text-gray-400 text-center py-10">Loading...</p>}
          {data && (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className={th}>Date</th>
                  <th className={th}>Transaction</th>
                  <th className={th}>Name / memo</th>
                  <th className={`${th} text-right`}>Debit</th>
                  <th className={`${th} text-right`}>Credit</th>
                  <th className={`${th} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {from && (
                  <tr className="border-b border-gray-100 text-gray-500">
                    <td className="px-2 py-1.5" colSpan={5}>Opening balance</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{plNum(data.opening_balance)}</td>
                  </tr>
                )}
                {data.rows.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400">No transactions.</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatJournalDate(r.date)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <button type="button" onClick={() => setTxOpen(r)} className="text-blue-700 underline font-medium">
                        {r.type} {r.number}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      {r.name}
                      {r.account && r.account !== data.account.name && <span className="text-gray-400"> · {r.account}</span>}
                      {r.memo && <span className="text-gray-400"> - {r.memo}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.debit ? plNum(r.debit) : ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.credit ? plNum(r.credit) : ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{plNum(r.balance)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-2 py-2" colSpan={5}>Balance</td>
                  <td className="px-2 py-2 text-right tabular-nums">{plNum(data.closing_balance)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
      {txOpen && <PLTransactionModal tx={txOpen} onClose={() => setTxOpen(null)} />}
    </div>
  );
}

const CTRL_GO = {
  a: "accounting",
  j: "customers",
  l: "items",
  r: "banking",
  y: "journals"
};
const ALT_GO = {
  KeyH: "",
  KeyC: "customers",
  KeyV: "vendors",
  KeyQ: "quotes",
  KeyS: "salesorders",
  KeyI: "invoices",
  KeyP: "payments",
  KeyN: "creditnotes",
  KeyB: "purchases",
  KeyM: "vendorpayments",
  KeyX: "taxes",
  KeyU: "issued",
  KeyG: "manage",
  KeyR: "reports",
};

function GlobalAdminShortcuts({ isAdmin, onProductCreated, onNewBill }) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [quickAccount, setQuickAccount] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const wins = useWindows();
  const active = useWindowActive(); // only the window you are looking at listens to the keys
  const floating = useWindowFloating();

    useEffect(() => {
      const track = (e) => {
        const el = e.target?.closest?.("[data-account-id]");
        if (el) lastQuickAccount = Number(el.dataset.accountId);
      };
      document.addEventListener("click", track, true);
      return () => document.removeEventListener("click", track, true);
    }, []);

  useEffect(() => {
    if (!isAdmin || !active) return;
    const typing = () => {
      const el = document.activeElement;
      return (
        !!el &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
          el.isContentEditable)
      );
    };
    // a form / dialog is open: don't navigate away from half-typed work
    const formOpen = () =>
      [...document.querySelectorAll(".fixed.inset-0")].some(
        (el) =>
          isShown(el) && el.querySelector("form, input, select, textarea"),
      );
    const go = (view) => setSearchParams(view ? { view } : {});
    const openNew = (view) => {
      if (searchParams.get("view") === view) {
        window.dispatchEvent(
          new CustomEvent("app:new", { detail: { handled: false } }),
        );
      } else {
        pendingNew = true;
        setSearchParams({ view });
      }
    };
    const overlayButton = (pattern) =>
      [...document.querySelectorAll(".fixed.inset-0 button")]
        .filter(isShown)
        .reverse()
        .find((b) => pattern.test(b.textContent.trim()));

    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // ---- keys that work everywhere ----
      if (e.key === "F1" || (e.key === "?" && !typing() && !mod)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        const btn = overlayButton(/^(cancel|close)$/i);
        if (btn) {
          btn.click();
          return;
        }
        // QuickBooks: Esc closes the window you are in (floating windows only, never while a dialog is open)
        const dialogOpen = [
          ...document.querySelectorAll(".fixed.inset-0"),
        ].some(isShown);
        if (floating && wins && !dialogOpen) {
          if (typing())
            document.activeElement.blur(); // 1st Esc leaves the field
          else wins.closeActive(); // next Esc closes the window
        }
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        const form = [...document.querySelectorAll(".fixed.inset-0 form")]
          .filter(isShown)
          .pop();
        if (form) form.requestSubmit();
        else overlayButton(/^(save|create|record|submit|post|add)\b/i)?.click();
        return;
      }
      if (e.key === "/" && !mod && !e.altKey && !typing()) {
        e.preventDefault();
        [...document.querySelectorAll('input[placeholder^="Search"]')]
          .find((i) => i.offsetParent !== null)
          ?.focus();
        return;
      }

      // ---- windows: these work even while a form is open (the form stays in its own window) ----
      if (wins && e.altKey && !mod) {
        if (e.code === "KeyW") {
          e.preventDefault();
          if (e.shiftKey) wins.closeActive();
          else wins.duplicate();
          return;
        }
        if (e.code === "KeyT") {
          e.preventDefault();
          if (e.shiftKey) wins.cascade();
          else wins.tile();
          return;
        }
        if (e.shiftKey && e.code in ALT_GO) {
          e.preventDefault();
          wins.openWindow(ALT_GO[e.code] ? `view=${ALT_GO[e.code]}` : "");
          return;
        }
        if (!e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
          e.preventDefault();
          wins.goIndex(Number(e.code.slice(5)));
          return;
        }
        if (
          !e.shiftKey &&
          (e.code === "BracketRight" || e.code === "BracketLeft")
        ) {
          e.preventDefault();
          wins.cycle(e.code === "BracketRight" ? 1 : -1);
          return;
        }
      }

      if (formOpen() || helpOpen) return; // everything below would leave an open form

      // ---- Alt + letter: go to a list ----
      if (e.altKey && !mod && !e.shiftKey) {
        if (e.code === "KeyA") {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("app:new", { detail: { handled: false } }),
          );
          return;
        }
        if (e.code in ALT_GO) {
          e.preventDefault();
          go(ALT_GO[e.code]);
        }
        return;
      }

      // ---- Ctrl + letter ----
      if (!mod || e.shiftKey || e.altKey) return;

      if (key === "n") {
        e.preventDefault(); // stop the browser's own "new window" (only possible in the installed app window)
        const detail = { handled: false };
        window.dispatchEvent(new CustomEvent("app:new", { detail }));
        if (!detail.handled) setOpen(true); // no "New" on this page -> new item
      } else if (key === "i") {
        e.preventDefault();
        openNew("invoices");
      } else if (key === "w") {
        e.preventDefault();
        openNew("vendorpayments");
      } else if (key === "b") {
        e.preventDefault(); // stop Chrome's "toggle bookmarks bar"
        onNewBill();
      } else if (key === "q") {
        e.preventDefault();
        if (lastQuickAccount) setQuickAccount(lastQuickAccount);
      } else if (key === "f") {
        e.preventDefault();
        [...document.querySelectorAll('input[placeholder^="Search"]')]
          .find((i) => i.offsetParent !== null)
          ?.focus();
      } else if (key === "a" && typing()) {
        return; // let Ctrl+A select the text inside a field
      } else if (key in CTRL_GO) {
        e.preventDefault();
        go(CTRL_GO[key]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin, active, floating, wins, onNewBill, searchParams, helpOpen]);

  // the "Keyboard shortcuts" link in the sidebar
  useEffect(() => {
    if (!active) return;
    const show = () => setHelpOpen(true);
    window.addEventListener("app:help", show);
    return () => window.removeEventListener("app:help", show);
  }, [active]);

  return (
    <>
      {quickAccount && (
        <QuickReportModal
          accountId={quickAccount}
          onClose={() => setQuickAccount(null)}
        />
      )}
      {open && (
        <ProductForm
          onSubmit={async (values, imageFiles) => {
            await createProduct(values, imageFiles);
            onProductCreated?.();
          }}
          onClose={() => setOpen(false)}
        />
      )}

      {isAdmin && helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {SHORTCUT_HELP.map(([group, rows]) => (
                <div key={group}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                    {group}
                  </h3>
                  {rows.map(([keys, label]) => (
                    <div
                      key={keys}
                      className="flex items-start justify-between gap-3 py-1 text-sm"
                    >
                      <span className="text-gray-600">{label}</span>
                      <kbd className="shrink-0 text-xs bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-gray-700 whitespace-nowrap">
                        {keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              On Mac, use Cmd instead of Ctrl and Option instead of Alt.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// which permission area each sidebar entry / ?view= value needs (convenience only - the server checks again)
const VIEW_AREA = {
  customers: "customers",
  items: "inventory",
  manage: "inventory",
  quotes: "sales_documents",
  salesorders: "sales_documents",
  invoices: "invoices",
  payments: "payments_in",
  creditnotes: "credit_notes",
  vendors: "vendors",
  purchases: "purchase_bills",
  vendorpayments: "payments_out",
  bill: "stock_bills",
  issued: "issued",
  inventory: "requests",
  accounting: "chart_of_accounts",
  journals: "journals",
  banking: "banking",
  taxes: "taxes",
  reports: "reports",
  company: null, // everyone may LOOK at the company profile; only manage_companies may change it (server checks)
};
function viewAllowed(id, can, hasRight, openMode) {
  if (id === "company") return true;
  if (id === "users" || id === "audit")
    return !openMode && can("users", "view") && hasRight("manage_users");
  if (openMode) return true;
  const area = VIEW_AREA[id];
  if (!area) return true; // home, dashboard, unknown values
  if (!can(area, "view")) return false;
  if (id === "reports" && !hasRight("view_reports")) return false;
  return true;
}

const ZOHO_NAV = [
  [
    { id: "home", label: "Home", Icon: Home },
    { id: "customers", label: "Customers", Icon: Users },
    { id: "items", label: "Items", Icon: Tag },
  ],
  [
    { id: "quotes", label: "Quotes", Icon: FileSignature },
    { id: "salesorders", label: "Sales Orders", Icon: ClipboardCheck },
    { id: "invoices", label: "Invoices", Icon: FileText },
    { id: "payments", label: "Payments Received", Icon: Wallet },
    { id: "creditnotes", label: "Credit Notes", Icon: RotateCcw },
  ],
  [
    { id: "vendors", label: "Vendors", Icon: Truck },
    { id: "purchases", label: "Bills", Icon: ShoppingCart },
    { id: "vendorpayments", label: "Payments Made", Icon: CreditCard },
  ],
  [
    { id: "bill", label: "Stock Bill", Icon: Receipt },
    { id: "issued", label: "Issued", Icon: ClipboardList },
    { id: "inventory", label: "Requests & Stock History", Icon: History },
    { id: "manage", label: "Manage", Icon: Settings },
  ],
  [
    { id: "accounting", label: "Chart of Accounts", Icon: Landmark },
    { id: "journals", label: "Manual Journals", Icon: BookOpen },
    { id: "banking", label: "Banking", Icon: Banknote },
    { id: "taxes", label: "Taxes", Icon: Percent },
    { id: "reports", label: "Reports", Icon: TrendingUp },
  ],
  [
    { id: "company", label: "Company Profile", Icon: Building2 },
    { id: "users", label: "Users & Roles", Icon: ShieldCheck },
    { id: "audit", label: "Audit Log", Icon: ScrollText },
  ],
];


// Which menu the user prefers: "side" = the sidebar (default), "top" = QuickBooks-style toolbar. Saved on this device.
const NAV_LAYOUT_KEY = "nav_layout_v1";
function readNavLayout() {
  try {
    return localStorage.getItem(NAV_LAYOUT_KEY) === "top" ? "top" : "side";
  } catch {
    return "side";
  }
}
function useNavLayout() {
  const [layout, setLayout] = useState(readNavLayout);
  useEffect(() => {
    const sync = () => setLayout(readNavLayout());
    window.addEventListener("app:navlayout", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("app:navlayout", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const choose = (value) => {
    try {
      localStorage.setItem(NAV_LAYOUT_KEY, value);
    } catch {}
    window.dispatchEvent(new Event("app:navlayout"));
  };
  return [layout, choose];
}

// QuickBooks-style toolbar at the top (desktop). Click = open that page in its own window
// (or bring the window that already shows it to the front).
function TopToolbar() {
  const [navLayout, setNavLayout] = useNavLayout();
  const { user, logout, openMode, can, hasRight } = useAuth();
  const location = useLocation();
  const wins = useWindows();
  const { activeView, openViews } = useWindowState();
  const isAdmin = openMode
    ? location.pathname.startsWith("/admin")
    : ACCOUNTING_AREAS.some((a) => can(a, "view"));
  if (!isAdmin || !wins || navLayout !== "top") return null;

  const small =
    "px-2 py-1 rounded text-[11px] text-gray-300 hover:bg-white/10 hover:text-white";
  return (
    <div
      data-win-toolbar
      className="hidden md:flex sticky top-0 z-30 h-16 items-stretch bg-[#1f2640] text-white shadow-md"
    >
      <div className="w-52 shrink-0 flex items-center border-r border-white/10">
        <SidebarCompanyHeader />
      </div>

      <nav className="flex-1 min-w-0 flex items-stretch overflow-x-auto px-1">
        {ZOHO_NAV.map((group, gi) => {
          const items = group.filter((n) =>
            viewAllowed(n.id, can, hasRight, openMode),
          );
          if (items.length === 0) return null;
          return (
            <div
              key={gi}
              className={`flex items-stretch ${
                gi > 0 ? "ml-1 pl-1 border-l border-white/10" : ""
              }`}
            >
              {items.map(({ id, label, Icon }) => {
                const on = activeView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={`${label}  (Ctrl + click: open in a new window)`}
                    onClick={(e) =>
                      e.ctrlKey || e.metaKey || e.shiftKey
                        ? wins.openWindow(id === "home" ? "" : `view=${id}`)
                        : wins.go(id)
                    }
                    className={`relative w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 px-1 text-[10px] leading-3 text-center ${
                      on
                        ? "bg-blue-500 text-white"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="line-clamp-2">{label}</span>
                    {openViews.has(id) && !on && (
                      <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 flex items-center gap-1 px-3 border-l border-white/10 text-xs">
        <button type="button" className={small} onClick={() => wins.tile()} title="Tile windows  (Alt + T)">
          Tile
        </button>
        <button type="button" className={small} onClick={() => wins.cascade()} title="Cascade windows  (Alt + Shift + T)">
          Cascade
        </button>
        <button
          type="button"
          className={small}
          onClick={() => window.dispatchEvent(new Event("app:help"))}
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
        <button
          type="button"
          className={small}
          onClick={() => setNavLayout("side")}
          title="Show the menu as a side panel again"
        >
          Side menu
        </button>
        <CompanySwitcher light />
        {!openMode && user && (
          <div className="ml-2 leading-4 max-w-[9rem]">
            <p className="truncate font-medium">{user.full_name}</p>
            <div className="flex gap-3 text-gray-300">
              <button
                type="button"
                className="hover:text-white"
                onClick={() => window.dispatchEvent(new Event("app:profile"))}
              >
                Profile
              </button>
              <button type="button" className="hover:text-white" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// text in a window's title bar
function windowLabel(params) {
  const v = params.get("view") || "home";
  if (v === "dashboard") return "Home";
  return ZOHO_NAV.flat().find((n) => n.id === v)?.label || "Home";
}


function ZohoSidebar({ onNavigate }) {
  const [params, setParams] = useSearchParams();
  const activeId = params.get("view") || "home";
  const { can, hasRight, openMode } = useAuth();

    const wins = useWindows();
    const [, setNavLayout] = useNavLayout();

    // Ctrl / Cmd / Shift + click = open that page in a new window
    const go = (id, inNewWindow = false) => {
      if (inNewWindow && wins) {
        wins.openWindow(id === "home" ? "" : `view=${id}`);
      } else {
        setParams(id === "home" ? {} : { view: id });
      }
      onNavigate?.();
    };
  const rowCls = (active) =>
    `w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition ${
      active
        ? "bg-blue-500 text-white"
        : "text-gray-300 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="flex flex-col min-h-full">
      <SidebarCompanyHeader />

      <nav className="flex-1 px-2 py-3">
        {ZOHO_NAV.map((group, gi) => {
          const items = group.filter((n) =>
            viewAllowed(n.id, can, hasRight, openMode),
          );
          if (items.length === 0) return null;
          return (
            <div
              key={gi}
              className={gi > 0 ? "mt-2 pt-2 border-t border-white/10" : ""}
            >
              {items.map(({ id, label, Icon }) => (
                <div key={id}>
                  <button
                    onClick={(e) =>
                      go(id, e.ctrlKey || e.metaKey || e.shiftKey)
                    }
                    className={rowCls(activeId === id)}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </nav>
      <SidebarUser />
      <button
        onClick={() => window.dispatchEvent(new Event("app:help"))}
        className="m-2 px-3 py-2 rounded-md text-xs text-left text-gray-400 hover:bg-white/10 hover:text-white"
      >
        Keyboard shortcuts (?)
      </button>
      <button
        onClick={() => setNavLayout("top")}
        className="hidden md:block mx-2 mb-2 px-3 py-2 rounded-md text-xs text-left text-gray-400 hover:bg-white/10 hover:text-white"
      >
        Show menu on top
      </button>
    </div>
  );
}

function ZohoLayout({ children }) {
  const { company } = useCompany();
  const [drawer, setDrawer] = useState(false);
  const [navLayout] = useNavLayout(); // "side" (sidebar) or "top" (toolbar)
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside
        className={`${
          navLayout === "side" ? "hidden md:block" : "hidden"
        } w-56 shrink-0 bg-[#1f2640] sticky top-0 self-start h-screen overflow-y-auto`}
      >
        <ZohoSidebar />
      </aside>

      {drawer && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 max-w-[80%] bg-[#1f2640] h-full overflow-y-auto">
            <ZohoSidebar onNavigate={() => setDrawer(false)} />
          </div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setDrawer(false)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="md:hidden flex items-center gap-3 bg-[#1f2640] text-white px-4 py-3">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="p-1 -ml-1 rounded hover:bg-white/10"
          >
            <Menu size={22} />
          </button>
          <span className="font-semibold truncate">{company?.name}</span>
          <HeaderSignOut />
        </div>
        {children}
      </div>
    </div>
  );
}
// shown instead of the dashboard when the user may not see reports (e.g. Sales)
function WelcomeHome({ go }) {
  const { user, can, hasRight, openMode } = useAuth();
  const links = ZOHO_NAV.flat().filter(
    (n) => n.id !== "home" && viewAllowed(n.id, can, hasRight, openMode),
  );
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.full_name}` : ""}
      </h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">Pick where to start:</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {links.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => go({ view: id })}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 hover:border-blue-500 hover:text-blue-600"
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-gray-900">No access</h1>
      <p className="text-sm text-gray-500 mt-1">
        Your role does not include this page. Ask an administrator if you need
        it.
      </p>
    </div>
  );
}

// colours taken from the Zoho dashboard: blue = not due yet, then yellow -> orange -> red the later it is
const AGE_BUCKETS = [
  ["current", "Current", "#2f80ed"],
  ["d1_15", "1-15 Days", "#fdd47a"],
  ["d16_30", "16-30 Days", "#fcb934"],
  ["d31_45", "31-45 Days", "#fba91f"],
  ["d45_plus", "Above 45 days", "#f4623a"],
];

function AgeingCard({ title, ageing, onNew, newLabel = "New" }) {
  const total = ageing?.total || 0;
  const amount = (key) => formatRs(ageing?.[key] || 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-base sm:text-lg font-medium text-gray-800">
          {title}
        </h2>
        {onNew && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600"
          >
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
              <Plus size={13} />
            </span>
            {newLabel}
          </button>
        )}
      </div>

      <div className="px-5 pt-3 pb-4">
        <p className="text-xs text-gray-600 mb-1.5">
          {title} {formatRs(total)}
        </p>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-200">
          {total > 0 &&
            AGE_BUCKETS.map(([key, , color]) =>
              ageing[key] > 0 ? (
                <div
                  key={key}
                  style={{
                    width: `${(ageing[key] / total) * 100}%`,
                    background: color,
                  }}
                />
              ) : null,
            )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-y-4 px-5 py-4 border-t border-gray-200">
        <div className="md:border-r md:border-gray-200 md:pr-4">
          <p className="text-[11px] font-medium uppercase text-blue-500">
            Current
          </p>
          <p className="text-lg sm:text-xl text-gray-900 mt-1">
            {amount("current")}
          </p>
        </div>
        <div className="col-span-2 md:col-span-4 md:pl-4">
          <p className="text-[11px] font-medium uppercase text-orange-500">
            Overdue
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4 mt-1">
            {AGE_BUCKETS.slice(1).map(([key, label]) => (
              <div key={key}>
                <p className="text-lg sm:text-xl text-gray-900">
                  {amount(key)}
                </p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// round the top of the chart up to a "nice" number and return evenly spaced grid lines
function niceTicks(peak) {
  const raw = Math.max(peak, 1) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const count = Math.max(1, Math.ceil(peak / step));
  return {
    ticks: Array.from({ length: count + 1 }, (_, i) => i * step),
    top: count * step,
  };
}
const tickLabel = (n) =>
  n >= 1000 ? `${+(n / 1000).toFixed(1)} K` : String(n);

function SalesExpensesChart({ rows }) {
  const peak = Math.max(
    0,
    ...rows.flatMap((r) => [r.sales, r.receipts, r.expenses]),
  );
  const { ticks, top } = niceTicks(peak || 20000);
  const H = 230;
  const pct = (v) => (v > 0 ? `${Math.max(1, (v / top) * 100)}%` : "0%");
  return (
    <div className="flex">
      <div className="relative w-12 shrink-0" style={{ height: H }}>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-2 text-[11px] text-gray-500 translate-y-1/2"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            {tickLabel(t)}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="relative" style={{ height: H }}>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ bottom: `${(t / top) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex justify-around">
              {rows.map((r) => (
                <div key={r.month} className="flex items-end gap-0.5 h-full">
                  <div
                    className="w-2.5 rounded-t-sm bg-[#2f80ed]"
                    style={{ height: pct(r.sales) }}
                    title={`Sales ${formatRs(r.sales)}`}
                  />
                  <div
                    className="w-2.5 rounded-t-sm bg-[#27ae60]"
                    style={{ height: pct(r.receipts) }}
                    title={`Receipts ${formatRs(r.receipts)}`}
                  />
                  {r.expenses > 0 && (
                    <div
                      className="w-2.5 rounded-t-sm bg-[#eb5757]"
                      style={{ height: pct(r.expenses) }}
                      title={`Expenses ${formatRs(r.expenses)}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-around mt-2">
            {rows.map((r) => (
              <div key={r.month} className="text-center w-8">
                <p className="text-[11px] text-gray-600 leading-tight">
                  {r.month}
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">
                  {r.year}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard layout: which widgets, their order and size (saved on this device) ----------
const DASH_LAYOUT_KEY = "dash_layout_v1";
const DASH_WIDGET_NAMES = {
  receivables: "Total Receivables",
  payables: "Total Payables",
  sales: "Sales and Expenses chart",
  cash: "Cash & Bank",
  expenses: "Top Expenses",
};
const DASH_LAYOUT_DEFAULT = {
  fullWidth: false,
  showStockTab: true,
  widgets: [
    { id: "receivables", visible: true, size: "full" },
    { id: "payables", visible: true, size: "full" },
    { id: "sales", visible: true, size: "full" },
    { id: "cash", visible: true, size: "half" },
    { id: "expenses", visible: true, size: "half" },
  ],
};

function useDashboardLayout() {
  const [layout, setLayout] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DASH_LAYOUT_KEY) || "null");
      if (saved && typeof saved === "object") {
        const savedW = (saved.widgets || []).filter(
          (w) => DASH_WIDGET_NAMES[w.id],
        );
        const missing = DASH_LAYOUT_DEFAULT.widgets.filter(
          (w) => !savedW.some((s) => s.id === w.id),
        );
        return {
          ...DASH_LAYOUT_DEFAULT,
          ...saved,
          widgets: [...savedW, ...missing],
        };
      }
    } catch (e) {
      /* ignore broken saved data */
    }
    return DASH_LAYOUT_DEFAULT;
  });
  const save = (next) => {
    try {
      localStorage.setItem(DASH_LAYOUT_KEY, JSON.stringify(next));
    } catch (e) {
      /* storage blocked */
    }
    return next;
  };
  const update = (patch) => setLayout((prev) => save({ ...prev, ...patch }));
  const reset = () => setLayout(save(DASH_LAYOUT_DEFAULT));
  return [layout, update, reset];
}

function ZohoDashboard({ isAdmin, go, onProductAdded }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState("dashboard");
  const { data, loading, error } = useReport(() => getDashboard(year), [year]);
    const [layout, updateLayout, resetLayout] = useDashboardLayout();
    const { user } = useAuth();
    const { company } = useCompany();
    const [panelOpen, setPanelOpen] = useState(false);

  const tabs = [
    ["dashboard", "Dashboard"],
    ...(layout.showStockTab ? [["stock", "Stock Alerts"]] : []),
  ];
  const activeTab = tabs.some(([id]) => id === tab) ? tab : "dashboard";

  // ---- customize-panel helpers ----
  const moveWidget = (i, d) => {
    const next = [...layout.widgets];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updateLayout({ widgets: next });
  };
  const patchWidget = (id, patch) =>
    updateLayout({
      widgets: layout.widgets.map((w) =>
        w.id === id ? { ...w, ...patch } : w,
      ),
    });

  // each widget = one card; the card root carries its own bottom spacing
  const renderWidget = (id) => {
    switch (id) {
      case "receivables":
        return (
          <AgeingCard
            title="Total Receivables"
            ageing={data.receivables_ageing}
            onNew={() => go({ view: "invoices" })}
          />
        );
      case "payables":
        return (
          <AgeingCard
            title="Total Payables"
            ageing={data.payables_ageing}
            onNew={() => go({ view: "purchases" })}
          />
        );
      case "sales":
        return (
          <div className="bg-white border border-gray-200 rounded-lg mb-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-medium text-gray-800">
                Sales and Expenses
              </h2>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value={thisYear}>This Fiscal Year</option>
                <option value={thisYear - 1}>Last Fiscal Year</option>
              </select>
            </div>
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 min-w-0 p-5">
                <SalesExpensesChart rows={data.fy_chart} />
                <p className="text-xs text-gray-500 mt-5">
                  * Sales value displayed is inclusive of tax.
                </p>
              </div>
              <div className="md:w-60 shrink-0 border-t md:border-t-0 md:border-l border-gray-200 p-5 space-y-6">
                <div>
                  <p className="text-sm text-[#2f80ed]">Total Sales</p>
                  <p className="text-xl sm:text-2xl text-gray-900 mt-1">
                    {formatRs(data.fy_sales)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#27ae60]">Total Receipts</p>
                  <p className="text-xl sm:text-2xl text-gray-900 mt-1">
                    {formatRs(data.fy_receipts)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#eb5757]">Total Expenses</p>
                  <p className="text-xl sm:text-2xl text-gray-900 mt-1">
                    {formatRs(data.fy_expenses)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case "cash":
        return (
          <div className="bg-white border border-gray-200 rounded-lg mb-5 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-base font-medium text-gray-800">
                Cash & Bank
              </h2>
              <button
                onClick={() => go({ view: "banking" })}
                className="text-xs text-blue-600 hover:underline"
              >
                View all
              </button>
            </div>
            <div className="px-5 py-2">
              {data.cash_accounts.length === 0 && (
                <p className="text-xs text-gray-400 py-2">
                  No cash or bank accounts yet
                </p>
              )}
              {data.cash_accounts.map((a) => (
                <ReportLine key={a.id} label={a.name} amount={a.balance} />
              ))}
              {data.cash_accounts.length > 0 && (
                <ReportLine label="Total" amount={data.cash_total} bold />
              )}
            </div>
          </div>
        );
      case "expenses":
        return (
          <div className="bg-white border border-gray-200 rounded-lg mb-5 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-medium text-gray-800">
                Top Expenses (this year)
              </h2>
            </div>
            <div className="px-5 py-2">
              {data.top_expenses.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No expenses yet</p>
              )}
              {data.top_expenses.map((a) => (
                <ReportLine key={a.id} label={a.name} amount={a.amount} />
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const shown = layout.widgets.filter((w) => w.visible);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="home"
        onTab={() => {}}
        onProductAdded={onProductAdded}
      />

      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 pt-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
            <Landmark size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-medium text-gray-900 truncate">
              Hello, {user?.full_name || "Admin"}
            </h1>
            <p className="text-sm text-gray-500 truncate">{company?.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings size={14} /> Customize
          </button>
        </div>
        <div className="flex gap-6 mt-4 overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`pb-3 text-sm whitespace-nowrap border-b-2 ${
                activeTab === id
                  ? "border-blue-500 text-gray-900 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {label}
              {id === "stock" && data?.low_stock_count > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {data.low_stock_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 sm:p-6 w-full">
        <ReportBody loading={loading} error={error} data={data}>
          {data &&
            activeTab === "dashboard" &&
            (shown.length === 0 ? (
              <p className="text-center text-gray-400 py-16">
                All widgets are hidden. Use “Customize” to show them again.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
                {shown.map((w) => (
                  <div
                    key={w.id}
                    className={`min-w-0 ${w.size === "full" ? "lg:col-span-2" : ""}`}
                  >
                    {renderWidget(w.id)}
                  </div>
                ))}
              </div>
            ))}

          {data && activeTab === "stock" && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-2xl">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-base font-medium text-gray-800">
                  Low stock ({data.low_stock_count})
                </h2>
              </div>
              <div className="px-5 py-2">
                {data.low_stock.length === 0 && (
                  <p className="text-xs text-gray-400 py-3">
                    All items are above their reorder level
                  </p>
                )}
                {data.low_stock.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      go({ view: "items", item: String(p.id), from: "home" })
                    }
                    className="w-full flex justify-between gap-3 py-2 text-sm text-left hover:bg-gray-50"
                  >
                    <span className="text-gray-700 truncate">{p.name}</span>
                    <span className="shrink-0 text-red-600">
                      {p.quantity} / min {p.reorder_min}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </ReportBody>
      </main>

      {/* ---------- Customize dashboard panel ---------- */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="w-full max-w-sm h-full overflow-y-auto bg-white text-gray-900 p-5 space-y-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Customize dashboard</h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="text-gray-500 hover:text-gray-900 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setPanelOpen(false);
                window.dispatchEvent(new Event("app:appearance"));
              }}
              className="w-full border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              App theme &amp; colours…
            </button>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Page width
              </h3>
              <div className="flex">
                {[
                  [false, "Contained"],
                  [true, "Full width"],
                ].map(([val, name]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateLayout({ fullWidth: val })}
                    className={`flex-1 px-3 py-1.5 text-sm border ${
                      layout.fullWidth === val
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mt-3">
                <input
                  type="checkbox"
                  checked={layout.showStockTab}
                  onChange={(e) =>
                    updateLayout({ showStockTab: e.target.checked })
                  }
                />
                Show “Stock Alerts” tab
              </label>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Widgets (show, size, order)
              </h3>
              <div className="space-y-1.5">
                {layout.widgets.map((w, i) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={w.visible}
                      onChange={(e) =>
                        patchWidget(w.id, { visible: e.target.checked })
                      }
                    />
                    <span className="flex-1 min-w-0 text-sm truncate">
                      {DASH_WIDGET_NAMES[w.id]}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        patchWidget(w.id, {
                          size: w.size === "full" ? "half" : "full",
                        })
                      }
                      className="text-xs border border-gray-300 rounded px-2 py-0.5 text-gray-700 hover:bg-gray-50"
                      title="Full row or half row (half only applies on wide screens)"
                    >
                      {w.size === "full" ? "Full" : "Half"}
                    </button>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveWidget(i, -1)}
                      className="px-1 text-gray-500 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={i === layout.widgets.length - 1}
                      onClick={() => moveWidget(i, 1)}
                      className="px-1 text-gray-500 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetLayout}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Saved automatically on this device.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ONE window: sidebar + page + shortcuts. <MultiWindow> (see AppShell below) renders one copy per open window.
function AppWindow() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openMode, can, hasRight } = useAuth();
  const floating = useWindowFloating(); // floating windows show just the page, no sidebar
  // Login not enforced yet (AUTH_REQUIRED=false): keep the old behaviour. Enforced: decided by the role.
  const isAdmin = openMode
    ? location.pathname.startsWith("/admin")
    : ACCOUNTING_AREAS.some((a) => can(a, "view"));
  const viewParam = searchParams.get("view");
  const viewBlocked =
    !!viewParam && !viewAllowed(viewParam, can, hasRight, openMode);
  const canDashboard =
    openMode || (can("reports", "view") && hasRight("view_reports"));
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken((n) => n + 1);
  const [quickBillToken, setQuickBillToken] = useState(0);
  const [quickIssuedToken, setQuickIssuedToken] = useState(0);

  const goNewBill = () => {
    setSearchParams({ view: "bill" });
    setQuickBillToken((n) => n + 1);
  };
  const goNewIssued = () => {
    setSearchParams({ view: "issued" });
    setQuickIssuedToken((n) => n + 1);
  };

  let page;
  if (viewBlocked) {
    page = <NoAccess />;
  } else if (searchParams.get("view") === "bill" && isAdmin) {
    page = <BillPage go={setSearchParams} autoCreateToken={quickBillToken} />;
  } else if (searchParams.get("view") === "issued" && isAdmin) {
    page = (
      <IssuedPage go={setSearchParams} autoCreateToken={quickIssuedToken} />
    );
  } else if (searchParams.get("view") === "accounting" && isAdmin) {
    page = searchParams.get("account") ? (
      <AccountDetail
        accountId={searchParams.get("account")}
        go={setSearchParams}
        fromParam={searchParams.get("from")}
      />
    ) : (
      <AccountingPage isAdmin={isAdmin} go={setSearchParams} />
    );
  } else if (searchParams.get("view") === "journals" && isAdmin) {
    page = <JournalsPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "customers" && isAdmin) {
    page = <CustomersPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "quotes" && isAdmin) {
    page = (
      <SalesDocumentsPage
        key="quote"
        isAdmin={isAdmin}
        go={setSearchParams}
        docType="quote"
      />
    );
  } else if (searchParams.get("view") === "salesorders" && isAdmin) {
    page = (
      <SalesDocumentsPage
        key="sales_order"
        isAdmin={isAdmin}
        go={setSearchParams}
        docType="sales_order"
      />
    );
  } else if (searchParams.get("view") === "creditnotes" && isAdmin) {
    page = <CreditNotesPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "invoices" && isAdmin) {
    page = <InvoicesPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "payments" && isAdmin) {
    page = <PaymentsPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "purchases" && isAdmin) {
    page = <PurchaseBillsPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "vendorpayments" && isAdmin) {
    page = <VendorPaymentsPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "taxes" && isAdmin) {
    page = <TaxesPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "banking" && isAdmin) {
    page = (
      <BankingPage
        isAdmin={isAdmin}
        go={setSearchParams}
        accountId={searchParams.get("account")}
        reconcile={searchParams.get("reconcile")}
      />
    );
  } else if (searchParams.get("view") === "reports" && isAdmin) {
    page = <ReportsPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "dashboard" && isAdmin) {
    page = (
      <ZohoDashboard
        isAdmin={isAdmin}
        go={setSearchParams}
        onProductAdded={refresh}
      />
    );
  } else if (searchParams.get("view") === "vendors" && isAdmin) {
    page = <VendorsPage isAdmin={isAdmin} go={setSearchParams} />;
  } else if (searchParams.get("view") === "manage" && isAdmin) {
    page = (
      <ManagePage
        go={setSearchParams}
        refreshToken={refreshToken}
        onProductAdded={refresh}
      />
    );
  } else if (searchParams.get("view") === "inventory" && isAdmin) {
    page = (
      <InventoryView isAdmin={isAdmin} onBack={() => setSearchParams({})} />
    );
  } else if (searchParams.get("view") === "company") {
    page = <CompanyProfilePage />;
  } else if (searchParams.get("view") === "users") {
    page = <UsersAdminPage />;
  } else if (searchParams.get("view") === "audit") {
    page = <AuditLogPage />;
  } else if (searchParams.get("view") === "items") {
    page = (
      <ItemsPage
        isAdmin={isAdmin}
        itemId={searchParams.get("item")}
        fromParam={searchParams.get("from")}
        go={setSearchParams}
        refreshToken={refreshToken}
        onProductAdded={refresh}
      />
    );
  } else if (isAdmin && canDashboard) {
    page = (
      <ZohoDashboard
        isAdmin={isAdmin}
        go={setSearchParams}
        onProductAdded={refresh}
      />
    );
  } else if (isAdmin) {
    page = <WelcomeHome go={setSearchParams} />;
  } else {
    page = <InventoryView isAdmin={isAdmin} />;
  }

  return (
    <>
      {isAdmin && !floating ? <ZohoLayout>{page}</ZohoLayout> : page}
      <GlobalAdminShortcuts
        isAdmin={isAdmin}
        onProductCreated={refresh}
        onNewBill={goNewBill}
        onNewIssued={goNewIssued}
      />
      {!isAdmin && <FloatingSignOut />}
    </>
  );
}

function AppShell() {
  return (
    <>
      <MultiWindow labelFor={windowLabel} toolbar={<TopToolbar />}>
        <AppWindow />
      </MultiWindow>
      <ThemePanel />
      <ProfileModal />
    </>
  );
}

// ---------- App with routes ----------
export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <CompanyProvider>
          <Routes>
            <Route path="/" element={<AppShell />} />
            <Route path="/admin" element={<AppShell />} />
            <Route path="/admin.html" element={<AppShell />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CompanyProvider>
      </AuthGate>
    </AuthProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Page not found
        </h1>
        <p className="text-gray-500 mb-4">This page doesn't exist.</p>
        <a href="/" className="text-blue-600 hover:underline text-sm">
          Go to HOME
        </a>
      </div>
    </div>
  );
}

