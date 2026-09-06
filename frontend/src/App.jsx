import { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Pencil, Trash2, PackagePlus, History } from "lucide-react";

import "./index.css";

// ---------- ManifestSync ----------
// Swaps the linked PWA manifest (and title/theme-color) based on the current
// route, so "Install this site as an app" / "Add to Home Screen" produces a
// separate installable app for /admin vs / with its own start_url.
function ManifestSync() {
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith("/admin");
    const manifestHref = isAdminRoute ? "/manifest-admin.json" : "/manifest-employee.json";
    const title = isAdminRoute ? "STD Stock Manager — Admin" : "STD Stock Manager";
    const themeColor = isAdminRoute ? "#7c3aed" : "#2563eb";
    const appleTitle = isAdminRoute ? "Stock Admin" : "Stock Manager";

    let link = document.getElementById("app-manifest");
    if (!link) {
      link = document.createElement("link");
      link.id = "app-manifest";
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.setAttribute("href", manifestHref);

    document.title = title;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", themeColor);

    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) appleTitleMeta.setAttribute("content", appleTitle);
  }, [location.pathname]);

  return null;
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ---------- API helpers ----------
async function getProducts() {
  const res = await fetch(`${BASE_URL}/products/`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

async function getCategories() {
  const res = await fetch(`${BASE_URL}/categories/`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

async function createCategory(name) {
  const res = await fetch(`${BASE_URL}/categories/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create category");
  return res.json();
}

async function createProduct(formValues, imageFiles) {
  const formData = new FormData();
  formData.append("name", formValues.name);
  formData.append("sku", formValues.sku || "");
  formData.append("description", formValues.description || "");
  formData.append("quantity", formValues.quantity || 0);
  formData.append("price", formValues.price || 0);
  if (formValues.category_id) {
    formData.append("category_id", formValues.category_id);
  }
  imageFiles.forEach((file) => formData.append("images", file));

  const res = await fetch(`${BASE_URL}/products/`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Failed to create product");
  return res.json();
}

async function updateProduct(id, updates) {
  const res = await fetch(`${BASE_URL}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update product");
  return res.json();
}

async function deleteProduct(id) {
  const res = await fetch(`${BASE_URL}/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete product");
  return res.json();
}

async function getRequests(status) {
  const url = status ? `${BASE_URL}/requests/?status=${status}` : `${BASE_URL}/requests/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

async function createRequest(payload) {
  const res = await fetch(`${BASE_URL}/requests/`, {
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
  const res = await fetch(`${BASE_URL}/requests/${id}/approve`, { method: "PUT" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to approve request");
  }
  return res.json();
}

async function rejectRequest(id) {
  const res = await fetch(`${BASE_URL}/requests/${id}/reject`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to reject request");
  return res.json();
}

async function restockProduct(id, quantity, note) {
  const res = await fetch(`${BASE_URL}/products/${id}/restock`, {
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
  const res = await fetch(`${BASE_URL}/stock-movements/`);
  if (!res.ok) throw new Error("Failed to fetch stock history");
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
        <option key={m} value={m}>{formatMonthLabel(m)}</option>
      ))}
    </select>
  );
}

// ---------- ProductCard ----------
function ProductCard({ product, isAdmin, onDelete, onEdit, onRequest, onRestock }) {
  const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100">
        {primaryImage ? (
          <img src={primaryImage.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
          <span className="text-sm font-medium text-gray-600">Rs.{Number(product.price).toFixed(2)}</span>
        </div>

        {product.sku && <p className="text-xs text-gray-400 mb-2">SKU: {product.sku}</p>}

        <div className="flex justify-between items-center mt-3">
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              product.quantity > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {product.quantity > 0 ? `${product.quantity} in stock` : "Out of stock"}
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
function GroupedProductGrid({ products, categories, isAdmin, onDelete, onEdit, onRequest, onRestock }) {
  if (products.length === 0) {
    return <div className="text-center py-16 text-gray-400">No products match your filters.</div>;
  }

  const grouped = {};
  products.forEach((p) => {
    const key = p.category?.id ?? "uncategorized";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const orderedKeys = [
    ...categories.map((c) => c.id).filter((id) => grouped[id]),
    ...(grouped["uncategorized"] ? ["uncategorized"] : []),
  ];

  return (
    <div className="space-y-8">
      {orderedKeys.map((key) => {
        const groupProducts = grouped[key];
        const label = key === "uncategorized" ? "Uncategorized" : categories.find((c) => c.id === key)?.name;

        return (
          <div key={key}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              {label} <span className="text-gray-400 font-normal">({groupProducts.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupProducts.map((product) => (
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
          </div>
        );
      })}
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
          {product.name} — currently {product.quantity} in stock
        </p>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity received *</label>
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
            <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
            <input
              placeholder="e.g. Supplier invoice #234"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {Number(quantity) > 0 && (
            <p className="text-xs text-gray-400">New total: {product.quantity + Number(quantity)}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
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
          Stock Additions <span className="text-gray-400 font-normal">({filtered.length})</span>
        </h2>
        <MonthSelect options={monthOptions} value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No stock movements found for this period.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-50 text-green-600 shrink-0">
                  <PackagePlus size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{m.product?.name || `Product #${m.product_id}`}</p>
                  {m.note && <p className="text-xs text-gray-400 mt-0.5">{m.note}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">+{m.quantity}</p>
                <p className="text-xs text-gray-400">{formatDateTime(m.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- CategorySelect ----------
function CategorySelect({ categories, value, onChange, onCreateCategory }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const newCategory = await onCreateCategory(newName.trim());
      onChange(String(newCategory.id));
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
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={handleCreate} disabled={saving} className="bg-blue-600 text-white px-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? "..." : "Add"}
        </button>
        <button type="button" onClick={() => setCreating(false)} className="border border-gray-300 px-3 rounded-lg text-sm hover:bg-gray-50">✕</button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">No category</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
      <button type="button" onClick={() => setCreating(true)} className="border border-gray-300 px-3 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
        + New
      </button>
    </div>
  );
}

function RequestModal({ product, onSubmit, onClose }) {
  const [quantity, setQuantity] = useState(1);
  const [requestedBy, setRequestedBy] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!requestedBy.trim()) {
      setError("Please enter your name");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        product_id: product.id,
        quantity: Number(quantity),
        requested_by: requestedBy.trim(),
        note: note.trim() || null,
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
        <h2 className="text-lg font-semibold mb-1">Request Item</h2>
        <p className="text-sm text-gray-500 mb-4">{product.name} — {product.quantity} in stock</p>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Your name *</label>
            <input
              required
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              max={product.quantity}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
        <MonthSelect options={monthOptions} value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-gray-400 text-sm">No pending requests{selectedMonth ? " for this month" : ""}.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="font-medium text-gray-900">{r.product?.name}</p>
                  <p className="text-sm text-gray-500">
                    {r.quantity} requested by <span className="font-medium">{r.requested_by}</span>
                  </p>
                  {r.note && <p className="text-xs text-gray-400 mt-1">"{r.note}"</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(r.created_at)}</p>
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
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">History</h2>
        {resolved.length === 0 ? (
          <p className="text-gray-400 text-sm">No resolved requests{selectedMonth ? " for this month" : " yet"}.</p>
        ) : (
          <div className="space-y-2">
            {resolved.map((r) => (
              <div key={r.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{r.product?.name}</p>
                  <p className="text-xs text-gray-500">{r.quantity} requested by {r.requested_by}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(r.created_at)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
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

// ---------- ProductForm (handles both Create and Edit) ----------
function ProductForm({ categories, initialData, onSubmit, onClose, onCreateCategory }) {
  const isEditMode = Boolean(initialData);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    sku: initialData?.sku || "",
    description: initialData?.description || "",
    quantity: initialData?.quantity ?? 0,
    price: initialData?.price ?? 0,
    category_id: initialData?.category?.id ? String(initialData.category.id) : "",
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const handleFileChange = (e) => setImageFiles(Array.from(e.target.files));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEditMode) {
        await onSubmit(initialData.id, form);
      } else {
        await onSubmit(form, imageFiles);
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
        <h2 className="text-lg font-semibold mb-4">{isEditMode ? "Edit Product" : "Add Product"}</h2>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Product name" value={form.name} onChange={(e) => handleChange("name", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <input placeholder="SKU (optional)" value={form.sku} onChange={(e) => handleChange("sku", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <textarea placeholder="Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quantity</label>
              <input type="number" min="0" value={form.quantity} onChange={(e) => handleChange("quantity", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => handleChange("price", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <CategorySelect categories={categories} value={form.category_id} onChange={(val) => handleChange("category_id", val)} onCreateCategory={onCreateCategory} />

          {!isEditMode && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Product images</label>
              <input type="file" accept="image/*" multiple onChange={handleFileChange} className="w-full text-sm" />
            </div>
          )}
          {isEditMode && (
            <p className="text-xs text-gray-400">
              Quantity here is a manual override (use it for corrections). To receive new stock, use the "Add stock" button on the product card instead — it logs the addition with a timestamp under Stock History.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Saving..." : isEditMode ? "Save Changes" : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Shared inventory view (used by both routes) ----------
function InventoryView({ isAdmin }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [activeTab, setActiveTab] = useState("products"); // "products" | "requests" | "history"
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [requestingProduct, setRequestingProduct] = useState(null);
  const [restockingProduct, setRestockingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    const calls = [getProducts(), getCategories()];
    if (isAdmin) {
      calls.push(getRequests());
      calls.push(getStockMovements());
    }
    const results = await Promise.all(calls);
    setProducts(results[0]);
    setCategories(results[1]);
    if (isAdmin) {
      setRequests(results[2]);
      setStockMovements(results[3]);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const modalOpen = showForm || requestingProduct || restockingProduct;
      if (!modalOpen) {
        loadData(true); // silent = no loading spinner flash
      }
    }, 5000);

    return () => clearInterval(interval);
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

  const handleCreateCategory = async (name) => {
    const newCategory = await createCategory(name);
    setCategories((prev) => [...prev, newCategory]);
    return newCategory;
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

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      (selectedCategory === "uncategorized" ? !p.category : String(p.category?.id) === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-wrap gap-3 justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">STD Stock Manager</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
              {isAdmin ? "Admin" : "Employee (Read Only)"}
            </span>
          </div>
          {isAdmin && activeTab === "products" && (
            <button onClick={() => { setEditingProduct(null); setShowForm(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + Add Product
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex gap-4 border-b border-gray-100 -mb-4">
            <button
              onClick={() => setActiveTab("products")}
              className={`pb-2 text-sm font-medium border-b-2 ${
                activeTab === "products" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
                activeTab === "requests" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
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
              className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
                activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
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
          <RequestsPanel requests={requests} onApprove={handleApprove} onReject={handleReject} />
        ) : activeTab === "history" ? (
          <StockHistoryPanel movements={stockMovements} />
        ) : (
          <>
            <FilterBar
              categories={categories}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
            <GroupedProductGrid
              products={filteredProducts}
              categories={categories}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onEdit={(product) => { setEditingProduct(product); setShowForm(true); }}
              onRequest={(product) => setRequestingProduct(product)}
              onRestock={(product) => setRestockingProduct(product)}
            />
          </>
        )}
      </main>

      {showForm && (
        <ProductForm
          categories={categories}
          initialData={editingProduct}
          onSubmit={editingProduct ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onCreateCategory={handleCreateCategory}
        />
      )}

      {requestingProduct && (
        <RequestModal
          product={requestingProduct}
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
    </div>
  );
}

function FilterBar({ categories, searchTerm, onSearchChange, selectedCategory, onCategoryChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <input
        type="text"
        placeholder="Search products by name..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
      >
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
        <option value="uncategorized">Uncategorized</option>
      </select>
    </div>
  );
}

// ---------- App with routes ----------
export default function App() {
  const isAdminEntry = window.location.pathname.startsWith("/admin");
  return (
    <>
      <ManifestSync />
      <Routes>
        <Route path="/" element={<InventoryView isAdmin={isAdminEntry} />} />
        <Route path="/admin" element={<InventoryView isAdmin={true} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-4">This page doesn't exist.</p>
        <a href="/" className="text-blue-600 hover:underline text-sm">Go to home</a>
      </div>
    </div>
  );
}