import { useEffect, useRef, useState } from "react";
import { Routes, Route, useLocation, useSearchParams } from "react-router-dom";
import { Pencil, Trash2, PackagePlus, History, ChevronRight, ChevronDown, ArrowLeft, LayoutGrid, Tag, Search, Receipt, Plus, Star, Check, ClipboardList } from "lucide-react";
import "./index.css";


const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ---------- Departments ----------
// slug must match backend/app/departments.py and the logo file name in public/logos/
const DEPARTMENTS = [
  { slug: "dd-engineering", name: "DD Engineering", logo: "/logos/dd-engineering.png" },
  { slug: "i-lab", name: "I Lab", logo: "/logos/i-lab.png" },
  { slug: "i-lab-std", name: "I Lab STD", logo: "/logos/i-lab-std.png" },
];

// ---------- API helpers ----------
async function getProducts(department) {
  const url = department
    ? `${BASE_URL}/products/?department=${department}`
    : `${BASE_URL}/products/`;
  const res = await fetch(url);
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
  formData.append("department", formValues.department);

  if (formValues.category_id) {
    formData.append("category_id", formValues.category_id);
  }
  imageFiles.forEach((file) => formData.append("images", file));

  const res = await fetch(`${BASE_URL}/products/`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : "Failed to create product");
  }
  return res.json();
}

async function updateProduct(id, updates) {
  const res = await fetch(`${BASE_URL}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : "Failed to update product");
  }
  return res.json();
}

async function deleteProduct(id) {
  const res = await fetch(`${BASE_URL}/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete product");
  return res.json();
}

async function getRequests(status, department) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (department) params.set("department", department);
  const qs = params.toString();
  const res = await fetch(`${BASE_URL}/requests/${qs ? `?${qs}` : ""}`);
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

async function getStockMovements(department) {
  const url = department
    ? `${BASE_URL}/stock-movements/?department=${department}`
    : `${BASE_URL}/stock-movements/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch stock history");
  return res.json();
}

async function addProductImages(id, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));
  const res = await fetch(`${BASE_URL}/products/${id}/images`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : "Failed to upload images");
  }
  return res.json();
}

async function setPrimaryImage(id, imageId) {
  const res = await fetch(`${BASE_URL}/products/${id}/images/${imageId}/primary`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to set main image");
  return res.json();
}

async function deleteProductImage(id, imageId) {
  const res = await fetch(`${BASE_URL}/products/${id}/images/${imageId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete image");
  return res.json();
}

async function getIssuedLists() {
  const res = await fetch(`${BASE_URL}/issued/`);
  if (!res.ok) throw new Error("Failed to fetch issued lists");
  return res.json();
}

async function createIssuedList(payload) {
  const res = await fetch(`${BASE_URL}/issued/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : "Failed to save issued list");
  }
  return res.json();
}

async function getBills() {
  const res = await fetch(`${BASE_URL}/bills/`);
  if (!res.ok) throw new Error("Failed to fetch bills");
  return res.json();
}

async function createBill(adderName, items) {
  const res = await fetch(`${BASE_URL}/bills/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adder_name: adderName, items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : "Failed to save bill");
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

function RequestModal({ products, initialProductId, onSubmit, onClose }) {
  const [items, setItems] = useState([{ product_id: initialProductId, quantity: 1 }]);
  const [requestedBy, setRequestedBy] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const requestableProducts = products.filter((p) => p.quantity > 0);

  const getProduct = (id) => products.find((p) => p.id === Number(id));

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    const usedIds = items.map((i) => Number(i.product_id));
    const nextProduct = requestableProducts.find((p) => !usedIds.includes(p.id));
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
      setError("Each product can only appear once — adjust the quantity instead");
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
          })
        )
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
        <p className="text-sm text-gray-500 mb-4">Add one or more items to your request</p>

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

          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Items *</label>
            {items.map((item, index) => {
              const selectedProduct = getProduct(item.product_id);
              return (
                <div key={index} className="flex gap-2 items-start">
                  <select
                    required
                    value={item.product_id}
                    onChange={(e) => handleItemChange(index, "product_id", e.target.value)}
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
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
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

// ---------- ImageManager (edit mode: add / change main / delete images) ----------
function ImageManager({ productId, images, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const sorted = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

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
      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-2">{error}</div>}

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">No images yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {sorted.map((img) => (
            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              {img.is_primary && (
                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">Main</span>
              )}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {!img.is_primary && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setPrimaryImage(productId, img.id))}
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

      <label className={`inline-flex items-center gap-1 text-xs font-medium text-blue-600 ${busy ? "opacity-50" : "cursor-pointer hover:underline"}`}>
        <Plus size={13} />
        {busy ? "Working..." : "Add images"}
        <input type="file" accept="image/*" multiple disabled={busy} onChange={handleFiles} className="hidden" />
      </label>
      <p className="text-[11px] text-gray-400 mt-1">Images save straight away — no need to press Save Changes.</p>
    </div>
  );
}

// ---------- ProductForm (handles both Create and Edit) ----------
function ProductForm({ categories, initialData, defaultDepartment, onSubmit, onClose, onCreateCategory,onImagesChanged  }) {
  const isEditMode = Boolean(initialData);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    sku: initialData?.sku || "",
    description: initialData?.description || "",
    quantity: initialData?.quantity ?? 0,
    price: initialData?.price ?? 0,
    category_id: initialData?.category?.id ? String(initialData.category.id) : "",
    department: initialData?.department || defaultDepartment,
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [images, setImages] = useState(initialData?.images || []); 
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

          <div>
            <label className="block text-xs text-gray-500 mb-1">Department</label>
            <select
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.slug} value={d.slug}>{d.name}</option>
              ))}
            </select>
          </div>

          <CategorySelect categories={categories} value={form.category_id} onChange={(val) => handleChange("category_id", val)} onCreateCategory={onCreateCategory} />

          {!isEditMode && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Product images</label>
              <input type="file" accept="image/*" multiple onChange={handleFileChange} className="w-full text-sm" />
            </div>
          )}

          {isEditMode && (
            <ImageManager
              productId={initialData.id}
              images={images}
              onChange={(imgs) => { setImages(imgs); onImagesChanged?.(); }}
            />
          )}

          {isEditMode && (
            <p className="text-xs text-gray-400">
              Quantity here is a manual override (use it for corrections). To receive new stock, use the "Add stock" button on the product card instead - it logs the addition with a timestamp under Stock History.
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
function InventoryView({ isAdmin, department, onBack }) {
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
    const calls = [getProducts(department.slug), getCategories()];
    if (isAdmin) {
      calls.push(getRequests(undefined, department.slug));
      calls.push(getStockMovements(department.slug));
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
  
    // categories are shared by all departments; only offer the ones used here
  const usedCategories = categories.filter((c) => products.some((p) => p.category?.id === c.id));

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
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Back to departments"
              className="p-2 -ml-2 rounded-full text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft size={20} />
            </button>
            <img
              src={department.logo}
              alt=""
              className="w-10 h-10 object-contain rounded-lg border border-gray-200 bg-white p-1"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{department.name}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                {isAdmin ? "Admin" : "Employee (Read Only)"}
              </span>
            </div>
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
              categories={usedCategories}
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
          defaultDepartment={department.slug}
          onSubmit={editingProduct ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onCreateCategory={handleCreateCategory}
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


// ---------- "+ Add Product" from any admin page (pick the department inside the form) ----------
function AddProductButton({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      setCategories(await getCategories());
      setOpen(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values, imageFiles) => {
    await createProduct(values, imageFiles);
    onCreated?.();
  };

  const handleCreateCategory = async (name) => {
    const created = await createCategory(name);
    setCategories((prev) => [...prev, created]);
    return created;
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "Loading..." : "+ Add Product"}
      </button>
      {open && (
        <ProductForm
          categories={categories}
          defaultDepartment={DEPARTMENTS[0].slug}
          onSubmit={handleCreate}
          onClose={() => setOpen(false)}
          onCreateCategory={handleCreateCategory}
        />
      )}
    </>
  );
}

// ---------- Shared top header (title + admin buttons + tabs) ----------
function AppHeader({ isAdmin, active, onTab, onProductAdded, actions }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900">STD Stock Manager</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
            {isAdmin ? "Admin" : "Employee (Read Only)"}
          </span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {actions}
            <AddProductButton onCreated={onProductAdded} />
          </div>
        )}
      </div>
      <HomeTabs active={active} isAdmin={isAdmin} onChange={onTab} />
    </header>
  );
}

// ---------- Shared helpers for the home tabs / items browser ----------
const UNCATEGORIZED = "uncategorized";
const nameCollator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
const compareNames = (a, b) => nameCollator.compare(a, b); // A-Z, ignores upper/lower case
const getDepartment = (slug) => DEPARTMENTS.find((d) => d.slug === slug);

function HomeTabs({ active, onChange, isAdmin }) {
  const tab = (id, label, Icon) => (
    <button
      key={id}
      onClick={() => onChange(id)}
      className={`pb-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
        active === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
  return (
    <div className="flex gap-5 border-b border-gray-100 -mb-4 mt-3">
      {tab("home", "Home", LayoutGrid)}
      {tab("items", "Items", Tag)}
      {isAdmin && tab("bill", "Bill", Receipt)}
      {isAdmin && tab("issued", "Issued", ClipboardList)}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

function StockBadge({ quantity }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
        quantity > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {quantity > 0 ? `${quantity} in stock` : "Out of stock"}
    </span>
  );
}

function ItemRow({ item, showCategory, onClick }) {
  const image = item.images?.find((i) => i.is_primary) || item.images?.[0];
  const dept = getDepartment(item.department);
  const subtitle = [dept?.name, showCategory ? item.category?.name : null].filter(Boolean).join(" · ");
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 text-left hover:shadow-md hover:border-gray-300 transition"
    >
      <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
        {image ? (
          <img src={image.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-gray-400">No image</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.name}</p>
        {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>
      <StockBadge quantity={item.quantity} />
      <ChevronRight size={18} className="text-gray-400 shrink-0" />
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium text-right break-words">{value}</dd>
    </div>
  );
}

// ---------- Full item card ----------
function ItemDetail({ item, onBack }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = [...(item.images || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const current = images[Math.min(imageIndex, images.length - 1)];
  const dept = getDepartment(item.department);

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader title="Item details" onBack={onBack} />
      <main className="p-4 sm:p-6">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="aspect-square bg-gray-100">
            {current ? (
              <img src={current.image_url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
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
                    img.id === current.id ? "border-blue-600" : "border-transparent"
                  }`}
                >
                  <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5">
            <div className="flex justify-between items-start gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{item.name}</h2>
              <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Rs.{Number(item.price).toFixed(2)}
              </span>
            </div>
            <div className="mt-2">
              <StockBadge quantity={item.quantity} />
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label="SKU" value={item.sku || "—"} />
              <DetailRow label="Category" value={item.category?.name || "Uncategorized"} />
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-gray-500">Department</dt>
                <dd className="flex items-center gap-2 text-gray-900 font-medium">
                  {dept && <img src={dept.logo} alt="" className="w-6 h-6 object-contain" />}
                  {dept?.name || item.department}
                </dd>
              </div>
              {item.description && (
                <div>
                  <dt className="text-gray-500 mb-1">Description</dt>
                  <dd className="text-gray-900 whitespace-pre-line">{item.description}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------- Items inside one category ----------
function CategoryItemsPage({ group, catKey, loading, go }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = group ? group.items.filter((p) => p.name.toLowerCase().includes(q)) : [];
  const title = group ? group.name : catKey === UNCATEGORIZED ? "Uncategorized" : "Category";
  const count = group ? group.items.length : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader
        title={title}
        subtitle={group ? `${count} ${count === 1 ? "item" : "items"}` : undefined}
        onBack={() => go({ view: "items" })}
      />
      <main className="p-4 sm:p-6 max-w-4xl space-y-4">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : !group ? (
          <p className="text-gray-400 text-center py-16">No items in this category.</p>
        ) : (
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Search items in this category..." />
            {shown.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No items match your search.</p>
            ) : (
              <div className="space-y-2">
                {shown.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onClick={() => go({ view: "items", cat: catKey, item: String(item.id) })}
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

// ---------- Items page: categories (A-Z) -> items -> full item card ----------
function ItemsPage({ isAdmin, catKey, itemId, go, refreshToken, onProductAdded }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getProducts(); // every department
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
    return () => { cancelled = true; clearInterval(interval); };
  }, [refreshToken]);

  // group items by category, then sort A-Z ("Uncategorized" always last)
  const groupMap = {};
  products.forEach((p) => {
    const key = p.category ? String(p.category.id) : UNCATEGORIZED;
    if (!groupMap[key]) groupMap[key] = { key, name: p.category ? p.category.name : "Uncategorized", items: [] };
    groupMap[key].items.push(p);
  });
  const groups = Object.values(groupMap);
  groups.forEach((g) => g.items.sort((a, b) => compareNames(a.name, b.name)));
  groups.sort((a, b) =>
    a.key === UNCATEGORIZED ? 1 : b.key === UNCATEGORIZED ? -1 : compareNames(a.name, b.name)
  );

  // 3) full item card
  if (itemId) {
    const back = () => go(catKey ? { view: "items", cat: catKey } : { view: "items" });
    const item = products.find((p) => String(p.id) === itemId);
    if (item) return <ItemDetail item={item} onBack={back} />;
    return (
      <div className="min-h-screen bg-gray-50">
        <SubHeader title="Item details" onBack={back} />
        <p className="text-gray-400 text-center py-16">{loading ? "Loading..." : "This item no longer exists."}</p>
      </div>
    );
  }

  // 2) items inside one category
  if (catKey) {
    return (
      <CategoryItemsPage
        group={groups.find((g) => g.key === catKey)}
        catKey={catKey}
        loading={loading}
        go={go}
      />
    );
  }

  // 1) all categories, with search
  const q = search.trim().toLowerCase();
  const shownGroups = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  const matchedItems = q
    ? products.filter((p) => p.name.toLowerCase().includes(q)).sort((a, b) => compareNames(a.name, b.name))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin={isAdmin}
        active="items"
        onProductAdded={onProductAdded}
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
      />

      <main className="p-4 sm:p-6 max-w-4xl">
        <div className="mb-5">
          <SearchBox value={search} onChange={setSearch} placeholder="Search categories or items..." />
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error && products.length === 0 ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : products.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No items yet.</p>
        ) : q && shownGroups.length === 0 && matchedItems.length === 0 ? (
          <p className="text-gray-400 text-center py-16">Nothing matches "{search.trim()}".</p>
        ) : (
          <div className="space-y-8">
            {shownGroups.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Categories <span className="text-gray-400 font-normal">({shownGroups.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shownGroups.map((g) => (
                    <button
                      key={g.key}
                      onClick={() => go({ view: "items", cat: g.key })}
                      className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 text-left hover:shadow-md hover:border-gray-300 active:scale-[0.99] transition"
                    >
                      <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Tag size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{g.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {g.items.length} {g.items.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchedItems.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Items <span className="text-gray-400 font-normal">({matchedItems.length})</span>
                </h2>
                <div className="space-y-2">
                  {matchedItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      showCategory
                      onClick={() => go({ view: "items", item: String(item.id) })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


// ---------- Department home screen ----------
function DepartmentHome({ isAdmin, onSelect, onTab, refreshToken, onProductAdded }) {
  const [itemCounts, setItemCounts] = useState({});
  const [pendingCounts, setPendingCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [products, pending] = await Promise.all([
          getProducts(),
          isAdmin ? getRequests("pending") : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const items = {};
        products.forEach((p) => { items[p.department] = (items[p.department] || 0) + 1; });
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
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAdmin, refreshToken]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader isAdmin={isAdmin} active="home" onTab={onTab} onProductAdded={onProductAdded} />

      <main className="p-4 sm:p-6">
        <p className="text-sm text-gray-500 mb-4">Select a department</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
          {DEPARTMENTS.map((d) => {
            const count = itemCounts[d.slug] || 0;
            const waiting = pendingCounts[d.slug] || 0;
            return (
              <button
                key={d.slug}
                onClick={() => onSelect(d.slug)}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 text-left hover:shadow-md hover:border-gray-300 active:scale-[0.99] transition"
              >
                <div className="w-14 h-14 shrink-0 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-1.5">
                  <img src={d.logo} alt="" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 uppercase truncate">{d.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{count} {count === 1 ? "item" : "items"}</p>
                </div>
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

// Dropdown you can search in, then pick from
function SearchSelect({
  value,
  onChange,
  options, // [{ value, label, hint? }]
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  disabled = false,
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => (o.search || o.label).toLowerCase().includes(q)) : options;
  const close = () => {
    setOpen(false);
    setQuery("");
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

  useEffect(() => { if (disabled) close(); }, [disabled]);
  useEffect(() => { setActive(0); }, [query, open]);

  const choose = (option) => {
    onChange(option.value);
    close();
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
  };

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2.5 text-sm text-left bg-white transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:border-gray-300 ${
          open ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
              <li className="px-3 py-4 text-sm text-gray-400 text-center">{emptyText}</li>
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
                  <span className="truncate">{o.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {o.hint && <span className="text-xs text-gray-400 font-normal">{o.hint}</span>}
                    {o.value === value && <Check size={14} />}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Inline "create item" panel shown under the Item title
function CreateItemPanel({ department, category, existingNames, onCreate, onCancel }) {
  const [form, setForm] = useState({ name: "", sku: "", price: "" });
  const [imageFiles, setImageFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) return setError("Enter an item name");
    if (existingNames.includes(name.toLowerCase())) {
      return setError("This item already exists in this category — select it from the list");
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
          department,
          category_id: category,
        },
        imageFiles
      );
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 border border-blue-200 bg-blue-50/50 rounded-xl p-3 space-y-2">
      <p className="text-xs font-medium text-blue-700">New item in this department & category</p>
      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}
      <input
        autoFocus
        placeholder="Item name *"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="SKU (optional)" value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
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
        <label className="block text-xs text-gray-500 mb-1">Images (optional — you can add them later)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImageFiles(Array.from(e.target.files))}
          className="w-full text-xs"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 bg-white rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Creating..." : "Create item"}
        </button>
      </div>
    </div>
  );
}

// Asks for the stock adder's name, then saves the whole bill
function SubmitBillModal({ lines, onSubmit, onClose }) {
  const [name, setName] = useState("");
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
          {lines.length} {lines.length === 1 ? "item" : "items"} · {totalUnits} units will be added to stock
        </p>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock adder name *</label>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {submitting ? "Saving..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ---------- New bill form ----------
function NewBillForm({ onBack, onSaved }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [department, setDepartment] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState([]); // [{ product, quantity }]
  const [formError, setFormError] = useState(null);

  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getCategories()])
      .then(([p, c]) => { setProducts(p); setCategories(c); })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedCategories = [...categories].sort((a, b) => compareNames(a.name, b.name));
  const categoryItems = products
    .filter((p) => p.department === department && String(p.category?.id) === categoryId)
    .sort((a, b) => compareNames(a.name, b.name));
  const selectedItem = categoryItems.find((p) => String(p.id) === itemId);
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);
  const qtyNumber = Number(quantity);
  const qtyValid = Number.isInteger(qtyNumber) && qtyNumber > 0;

  const departmentOptions = DEPARTMENTS.map((d) => ({ value: d.slug, label: d.name }));
  const categoryOptions = sortedCategories.map((c) => ({ value: String(c.id), label: c.name }));
  const itemOptions = categoryItems.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.quantity} in stock` }));

  const handleDepartment = (slug) => {
    setDepartment(slug);
    setItemId("");
    setShowCreateItem(false);
    setFormError(null);
  };

  const handleCategory = (id) => {
    setCategoryId(id);
    setItemId("");
    setShowCreateItem(false);
    setFormError(null);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      handleCategory(String(existing.id));
      setNewCategoryName("");
      setCreatingCategory(false);
      return;
    }
    setSavingCategory(true);
    try {
      const created = await createCategory(name);
      setCategories((prev) => [...prev, created]);
      handleCategory(String(created.id));
      setNewCategoryName("");
      setCreatingCategory(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingCategory(false);
    }
  };

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
        return prev.map((l) => (l.product.id === selectedItem.id ? { ...l, quantity: l.quantity + qtyNumber } : l));
      }
      return [...prev, { product: selectedItem, quantity: qtyNumber }];
    });
    setItemId("");
    setQuantity("");
  };

  const stepQuantity = (delta) => setQuantity(String(Math.max(1, (Number(quantity) || 0) + delta)));

  const handleLineQty = (productId, value) => {
    const qty = Math.max(1, Math.floor(Number(value)) || 1);
    setLines((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l)));
  };

  const handleRemoveLine = (productId) => setLines((prev) => prev.filter((l) => l.product.id !== productId));

  const handleSubmitBill = async (adderName) => {
    await createBill(
      adderName,
      lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity }))
    );
    onSaved();
  };

  const deptName = getDepartment(department)?.name;

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader title="New Bill" subtitle="Add stock for many items at once" onBack={onBack} />

      <main className="p-4 sm:p-6 max-w-2xl space-y-4">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : loadError ? (
          <p className="text-red-500 text-center py-16">{loadError}</p>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-5">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}

              {/* Department */}
              <div>
                <FieldLabel>Department</FieldLabel>
                <SearchSelect
                  value={department}
                  onChange={handleDepartment}
                  options={departmentOptions}
                  placeholder="Select department"
                  searchable={false}
                />
              </div>

              {/* Category */}
              <div>
                <FieldLabel
                  action={
                    !creatingCategory && (
                      <FieldButton onClick={() => setCreatingCategory(true)}>New Category</FieldButton>
                    )
                  }
                >
                  Category
                </FieldLabel>
                {creatingCategory ? (
                  <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-medium text-blue-700">New category</p>
                    <input
                      autoFocus
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCategory())}
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setCreatingCategory(false); setNewCategoryName(""); }}
                        className="flex-1 border border-gray-300 bg-white rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        disabled={savingCategory || !newCategoryName.trim()}
                        className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingCategory ? "Creating..." : "Create category"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <SearchSelect
                    value={categoryId}
                    onChange={handleCategory}
                    options={categoryOptions}
                    disabled={!department}
                    placeholder={department ? "Search or select category" : "Select a department first"}
                    searchPlaceholder="Search categories..."
                    emptyText="No category found — use “New Category”"
                  />
                )}
              </div>

              {/* Item */}
              <div>
                <FieldLabel
                  action={
                    <FieldButton
                      onClick={() => setShowCreateItem((v) => !v)}
                      disabled={!department || !categoryId}
                      title={!categoryId ? "Select a department and category first" : undefined}
                    >
                      Create Item
                    </FieldButton>
                  }
                >
                  Item
                </FieldLabel>

                {showCreateItem && department && categoryId && (
                  <CreateItemPanel
                    department={department}
                    category={categoryId}
                    existingNames={categoryItems.map((p) => p.name.toLowerCase())}
                    onCreate={handleCreateItem}
                    onCancel={() => setShowCreateItem(false)}
                  />
                )}

                <SearchSelect
                  value={itemId}
                  onChange={setItemId}
                  options={itemOptions}
                  disabled={!department || !categoryId}
                  placeholder={
                    !categoryId ? "Select a category first" : categoryItems.length ? "Search or select item" : "No items yet"
                  }
                  searchPlaceholder="Search items..."
                  emptyText={categoryItems.length ? "No item found" : "No items in this category yet"}
                />
                {department && categoryId && categoryItems.length === 0 && !showCreateItem && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Nothing in this category for {deptName} yet — use “Create Item” to add one.
                  </p>
                )}

                {/* Quantity + add to list, right under the item select */}
                <div className={`mt-4 rounded-xl border p-3 sm:p-4 transition ${selectedItem ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-gray-50/60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity</span>
                    {selectedItem && (
                      <span className="text-xs text-gray-500">
                        In stock: <span className="font-medium text-gray-700">{selectedItem.quantity}</span>
                        {qtyValid && (
                          <> → <span className="font-medium text-green-600">{selectedItem.quantity + qtyNumber}</span></>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className={`flex items-stretch rounded-lg border border-gray-300 bg-white overflow-hidden sm:w-44 ${!selectedItem ? "opacity-50" : ""}`}>
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
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddToList())}
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
                Bill items <span className="text-gray-400 font-normal">({lines.length} · {totalUnits} units)</span>
              </h2>
              {lines.length === 0 ? (
                <p className="text-sm text-gray-400">No items added yet. Pick an item and quantity above, then “Add to list”.</p>
              ) : (
                <div className="space-y-2">
                  {lines.map((l) => {
                    const dept = getDepartment(l.product.department);
                    return (
                      <div key={l.product.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{l.product.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {[dept?.name, l.product.category?.name].filter(Boolean).join(" · ")}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {l.product.quantity} → <span className="font-medium text-green-600">{l.product.quantity + l.quantity}</span>
                          </p>
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={l.quantity}
                          onChange={(e) => handleLineQty(l.product.id, e.target.value)}
                          aria-label={`Quantity for ${l.product.name}`}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => handleRemoveLine(l.product.id)} aria-label="Remove" className="p-1.5 rounded-full text-red-500 hover:bg-red-50">
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
              Submit Bill
            </button>
          </>
        )}
      </main>

      {showSubmit && (
        <SubmitBillModal lines={lines} onSubmit={handleSubmitBill} onClose={() => setShowSubmit(false)} />
      )}
    </div>
  );
}

// ---------- Bill page: list of submitted bills (newest first) ----------
function BillPage({ go }) {
  const [creating, setCreating] = useState(false);
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
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (creating) {
    return (
      <NewBillForm
        onBack={() => setCreating(false)}
        onSaved={() => { setCreating(false); setLoading(true); load(); }}
      />
    );
  }

  const monthOptions = getMonthOptions(bills.map((b) => b.created_at));
  const shown = selectedMonth ? bills.filter((b) => b.created_at?.slice(0, 7) === selectedMonth) : bills;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        isAdmin
        active="bill"
        onTab={(tab) => go(tab === "home" ? {} : { view: tab })}
        actions={
          <button onClick={() => setCreating(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
            + New Bill
          </button>
        }
      />

      <main className="p-4 sm:p-6 max-w-4xl">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Bills <span className="text-gray-400 font-normal">({shown.length})</span>
          </h2>
          <MonthSelect options={monthOptions} value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error && bills.length === 0 ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">
            {bills.length === 0 ? "No bills yet. Tap “New Bill” to add stock in bulk." : "No bills for this month."}
          </p>
        ) : (
          <div className="space-y-2">
            {shown.map((bill) => {
              const open = openId === bill.id;
              const units = bill.items.reduce((sum, m) => sum + m.quantity, 0);
              return (
                <div key={bill.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(open ? null : bill.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                  >
                    <div className="p-2 rounded-full bg-green-50 text-green-600 shrink-0">
                      <Receipt size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{bill.adder_name}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(bill.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">+{units}</p>
                      <p className="text-xs text-gray-400">{bill.items.length} {bill.items.length === 1 ? "item" : "items"}</p>
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                      {bill.items
                        .slice()
                        .sort((a, b) => compareNames(a.product?.name || "", b.product?.name || ""))
                        .map((m) => (
                          <div key={m.id} className="flex justify-between items-center gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="text-gray-900 truncate">{m.product?.name || `Product #${m.product_id}`}</p>
                              {m.product?.department && (
                                <p className="text-xs text-gray-400 truncate">{getDepartment(m.product.department)?.name || m.product.department}</p>
                              )}
                            </div>
                            <span className="font-semibold text-green-600 shrink-0">+{m.quantity}</span>
                          </div>
                        ))}
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
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });
  const now = new Date();
  if (iso === toISODate(now)) return `Today · ${pretty}`;
  if (iso === toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return `Yesterday · ${pretty}`;
  return pretty;
}

// ---------- Create issued list form ----------
function NewIssuedForm({ onBack, onSaved }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [issuedDate, setIssuedDate] = useState(toISODate(new Date()));
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState([]); // [{ product, quantity }]
  const [description, setDescription] = useState("");
  const [responsibleBy, setResponsibleBy] = useState("");
  const [formError, setFormError] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getCategories()])
      .then(([p, c]) => { setProducts(p); setCategories(c); })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedProducts = [...products].sort((a, b) => compareNames(a.name, b.name));
  const itemOptions = sortedProducts.map((p) => {
    const deptName = getDepartment(p.department)?.name || p.department;
    return { value: String(p.id), label: p.name, hint: `${deptName} · ${p.quantity} in stock`, search: `${p.name} ${deptName}` };
  });
  const selectedItem = products.find((p) => String(p.id) === itemId);
  const alreadyInList = lines.find((l) => l.product.id === selectedItem?.id)?.quantity || 0;
  const qtyNumber = Number(quantity);
  const qtyValid = Number.isInteger(qtyNumber) && qtyNumber > 0;
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);

  const handleCreateCategory = async (name) => {
    const created = await createCategory(name);
    setCategories((prev) => [...prev, created]);
    return created;
  };

  // "+ Create Product" uses the same form as the main product screen
  const handleCreateProduct = async (values, imageFiles) => {
    const created = await createProduct(values, imageFiles);
    setProducts((prev) => [...prev, created]);
    setItemId(String(created.id));
  };

  const stepQuantity = (delta) => setQuantity(String(Math.max(1, (Number(quantity) || 0) + delta)));

  const handleAddToList = () => {
    setFormError(null);
    if (!selectedItem) return setFormError("Select an item first");
    if (!qtyValid) return setFormError("Enter a whole quantity greater than 0");
    if (alreadyInList + qtyNumber > selectedItem.quantity) {
      return setFormError(
        `Only ${selectedItem.quantity} of "${selectedItem.name}" in stock` +
          (alreadyInList ? ` (${alreadyInList} already in this list)` : "")
      );
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === selectedItem.id);
      if (existing) {
        return prev.map((l) => (l.product.id === selectedItem.id ? { ...l, quantity: l.quantity + qtyNumber } : l));
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
        const qty = Math.min(l.product.quantity, Math.max(1, Math.floor(Number(value)) || 1));
        return { ...l, quantity: qty };
      })
    );
  };

  const handleRemoveLine = (productId) => setLines((prev) => prev.filter((l) => l.product.id !== productId));

  const handleSubmit = async () => {
    setFormError(null);
    if (lines.length === 0) return setFormError("Add at least one item to the list");
    if (!issuedDate) return setFormError("Select the issued date");
    if (!responsibleBy.trim()) return setFormError("Responsible by is required");

    setSubmitting(true);
    try {
      await createIssuedList({
        issued_date: issuedDate,
        description: description.trim() || null,
        responsible_by: responsibleBy.trim().replace(/\s+/g, " "),
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      onSaved();
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SubHeader title="Create Issued List" subtitle="Reduce stock for items employees took" onBack={onBack} />

      <main className="p-4 sm:p-6 max-w-2xl space-y-4">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : loadError ? (
          <p className="text-red-500 text-center py-16">{loadError}</p>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-5">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}

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
                <p className="text-xs text-gray-400 mt-1.5">The day the employees took these items.</p>
              </div>

              {/* Item */}
              <div>
                <FieldLabel action={<FieldButton onClick={() => setShowProductForm(true)}>Create Product</FieldButton>}>
                  Item
                </FieldLabel>
                <SearchSelect
                  value={itemId}
                  onChange={setItemId}
                  options={itemOptions}
                  placeholder="Search or select item"
                  searchPlaceholder="Search by item or department..."
                  emptyText={products.length ? "No item found — use “Create Product”" : "No products yet — use “Create Product”"}
                />

                {/* Quantity + add to list */}
                <div className={`mt-4 rounded-xl border p-3 sm:p-4 transition ${selectedItem ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-gray-50/60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity taken</span>
                    {selectedItem && (
                      <span className="text-xs text-gray-500">
                        In stock: <span className="font-medium text-gray-700">{selectedItem.quantity - alreadyInList}</span>
                        {qtyValid && (
                          <> → <span className={`font-medium ${selectedItem.quantity - alreadyInList - qtyNumber < 0 ? "text-red-600" : "text-amber-600"}`}>
                            {selectedItem.quantity - alreadyInList - qtyNumber}
                          </span></>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className={`flex items-stretch rounded-lg border border-gray-300 bg-white overflow-hidden sm:w-44 ${!selectedItem ? "opacity-50" : ""}`}>
                      <button type="button" onClick={() => stepQuantity(-1)} disabled={!selectedItem} aria-label="Decrease quantity"
                        className="w-11 text-lg text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:cursor-not-allowed">−</button>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={quantity}
                        disabled={!selectedItem}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddToList())}
                        aria-label="Quantity"
                        className="flex-1 min-w-0 text-center text-sm font-medium border-x border-gray-200 py-2.5 focus:outline-none focus:bg-blue-50 disabled:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button type="button" onClick={() => stepQuantity(1)} disabled={!selectedItem} aria-label="Increase quantity"
                        className="w-11 text-lg text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:cursor-not-allowed">+</button>
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
                Issued items <span className="text-gray-400 font-normal">({lines.length} · {totalUnits} units)</span>
              </h2>
              {lines.length === 0 ? (
                <p className="text-sm text-gray-400">No items added yet. Pick an item and quantity above, then “Add to list”.</p>
              ) : (
                <div className="space-y-2">
                  {lines.map((l) => {
                    const dept = getDepartment(l.product.department);
                    return (
                      <div key={l.product.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{l.product.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {[dept?.name, l.product.category?.name].filter(Boolean).join(" · ")}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {l.product.quantity} → <span className="font-medium text-amber-600">{l.product.quantity - l.quantity}</span>
                          </p>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max={l.product.quantity}
                          value={l.quantity}
                          onChange={(e) => handleLineQty(l.product.id, e.target.value)}
                          aria-label={`Quantity for ${l.product.name}`}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => handleRemoveLine(l.product.id)} aria-label="Remove" className="p-1.5 rounded-full text-red-500 hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description + responsible */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-5">
              <div>
                <FieldLabel>Description <span className="text-gray-400 font-normal">(optional)</span></FieldLabel>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Items from QuickBooks report"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Responsible by <span className="text-red-500">*</span></FieldLabel>
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
                onClick={handleSubmit}
                disabled={submitting || lines.length === 0}
                className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : "Create Issued List"}
              </button>
              {lines.length > 0 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  This will reduce stock for {lines.length} {lines.length === 1 ? "item" : "items"} ({totalUnits} units).
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {showProductForm && (
        <ProductForm
          categories={categories}
          defaultDepartment={DEPARTMENTS[0].slug}
          onSubmit={handleCreateProduct}
          onClose={() => setShowProductForm(false)}
          onCreateCategory={handleCreateCategory}
        />
      )}
    </div>
  );
}

// ---------- Issued page: lists grouped by the selected date (newest first) ----------
function IssuedPage({ go }) {
  const [creating, setCreating] = useState(false);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [openId, setOpenId] = useState(null);

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
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (creating) {
    return (
      <NewIssuedForm
        onBack={() => setCreating(false)}
        onSaved={() => { setCreating(false); setLoading(true); load(); }}
      />
    );
  }

  const monthOptions = getMonthOptions(lists.map((l) => l.issued_date));
  const shown = selectedMonth ? lists.filter((l) => l.issued_date.slice(0, 7) === selectedMonth) : lists;

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
        actions={
          <button onClick={() => setCreating(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
            + Create Issued List
          </button>
        }
      />

      <main className="p-4 sm:p-6 max-w-4xl">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Issued lists <span className="text-gray-400 font-normal">({shown.length})</span>
          </h2>
          <MonthSelect options={monthOptions} value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : error && lists.length === 0 ? (
          <p className="text-red-500 text-center py-16">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">
            {lists.length === 0 ? "No issued lists yet. Tap “Create Issued List” to reduce stock from a list." : "No issued lists for this month."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.date}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{formatIssuedDate(g.date)}</h3>
                <div className="space-y-2">
                  {g.lists.map((list) => {
                    const open = openId === list.id;
                    const units = list.items.reduce((sum, m) => sum + m.quantity, 0);
                    return (
                      <div key={list.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setOpenId(open ? null : list.id)}
                          aria-expanded={open}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                        >
                          <div className="p-2 rounded-full bg-amber-50 text-amber-600 shrink-0">
                            <ClipboardList size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{list.responsible_by}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {list.description || `Created ${formatDateTime(list.created_at)}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-amber-600">−{units}</p>
                            <p className="text-xs text-gray-400">{list.items.length} {list.items.length === 1 ? "item" : "items"}</p>
                          </div>
                          <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>

                        {open && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                            {list.description && <p className="text-sm text-gray-600 whitespace-pre-line">{list.description}</p>}
                            <p className="text-xs text-gray-400">Created {formatDateTime(list.created_at)}</p>
                            <div className="space-y-2 pt-1">
                              {list.items
                                .slice()
                                .sort((a, b) => compareNames(a.product?.name || "", b.product?.name || ""))
                                .map((m) => (
                                  <div key={m.id} className="flex justify-between items-center gap-3 text-sm">
                                    <div className="min-w-0">
                                      <p className="text-gray-900 truncate">{m.product?.name || `Product #${m.product_id}`}</p>
                                      {m.product?.department && (
                                        <p className="text-xs text-gray-400 truncate">{getDepartment(m.product.department)?.name || m.product.department}</p>
                                      )}
                                    </div>
                                    <span className="font-semibold text-amber-600 shrink-0">−{m.quantity}</span>
                                  </div>
                                ))}
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

// ---------- Picks home / items / a department, using the URL query ----------
//   /?dept=i-lab                 -> department stock
//   /?view=items                 -> all categories
//   /?view=items&cat=3           -> items in category 3
//   /?view=items&cat=3&item=12   -> full item card
function AppShell() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = location.pathname.startsWith("/admin");
  const [refreshToken, setRefreshToken] = useState(0); // bumped after "+ Add Product" so lists reload at once
  const refresh = () => setRefreshToken((n) => n + 1);
  const department = DEPARTMENTS.find((d) => d.slug === searchParams.get("dept"));

  if (department) {
    return (
      <InventoryView
        key={department.slug}
        isAdmin={isAdmin}
        department={department}
        onBack={() => setSearchParams({})}
      />
    );
  }

  // Bill is admin-only: on the employee route it falls through to the home screen
  if (searchParams.get("view") === "bill" && isAdmin) {
    return <BillPage go={setSearchParams} />;
  }

    // Issued is admin-only too
  if (searchParams.get("view") === "issued" && isAdmin) {
    return <IssuedPage go={setSearchParams} />;
  }

  if (searchParams.get("view") === "items") {
    return (
      <ItemsPage
        isAdmin={isAdmin}
        catKey={searchParams.get("cat")}
        itemId={searchParams.get("item")}
        go={setSearchParams}
        refreshToken={refreshToken}
        onProductAdded={refresh}
      />
    );
  }

  return (
    <DepartmentHome
      isAdmin={isAdmin}
      onSelect={(slug) => setSearchParams({ dept: slug })}
      refreshToken={refreshToken}
      onProductAdded={refresh}
      onTab={(tab) => tab !== "home" && setSearchParams({ view: tab })}
    />
  );
}

// ---------- App with routes ----------
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/admin" element={<AppShell />} />
      <Route path="/admin.html" element={<AppShell />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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