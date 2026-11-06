// Downloadable PDFs for invoices, quotes, sales orders and credit notes.
// Needs:  npm install jspdf jspdf-autotable
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// >>> EDIT THIS: the details printed at the top of every PDF
const COMPANY = {
  name: "I LAB std",
  lines: ["NO 17/A", "Hollycross road, Gampaha", "Phone: +94 00 000 0000"],
  logo: "/logos/i-lab-std.png", // a file in public/logos/ (or null for no logo)
};

const money = (n) =>
  `Rs.${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateText = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

const primaryImageUrl = (product) =>
  (product?.images?.find((i) => i.is_primary) || product?.images?.[0])?.image_url || null;

// Downloads an image and shrinks it to a small JPEG. Returns null when it can't be loaded,
// so a missing / blocked picture never stops the PDF from being made.
async function loadImage(url, maxSize = 120) {
  if (!url || typeof document === "undefined") return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmapUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = bitmapUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(bitmapUrl);
    return { data: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

// images: { url -> { data, w, h } }.  Kept separate from loading so it is easy to test.
export function renderPdf(spec, images = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14; // page margin
  const dark = [31, 41, 55];
  const grey = [107, 114, 128];

  // ---- header: logo + company (left), title (right) ----
  let leftY = M;
  let textX = M;
  const logo = images[COMPANY.logo];
  if (logo) {
    const h = 16;
    const w = Math.min(40, (logo.w / logo.h) * h);
    doc.addImage(logo.data, "JPEG", M, M - 2, w, h);
    leftY = M + h + 1;
  }
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(COMPANY.name, textX, leftY + 4);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...grey);
  COMPANY.lines.forEach((l, i) => doc.text(l, textX, leftY + 9 + i * 4.2));
  const headerBottom = leftY + 9 + COMPANY.lines.length * 4.2;

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold").setFontSize(22);
  doc.text(spec.title, pageW - M, M + 6, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...grey);
  doc.text(`# ${spec.number}`, pageW - M, M + 12, { align: "right" });
  if (spec.status) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...dark);
    doc.text(spec.status.toUpperCase(), pageW - M, M + 18, { align: "right" });
  }

  // ---- bill to (left) + dates / reference (right) ----
  let y = Math.max(headerBottom, M + 22) + 6;
  doc.setDrawColor(229, 231, 235).line(M, y - 3, pageW - M, y - 3);

  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...grey);
  doc.text(spec.partyLabel || "BILL TO", M, y + 2);
  const c = spec.customer || {};
  const partyLines = [
    c.display_name || spec.customerName,
    c.company_name && c.company_name !== c.display_name ? c.company_name : null,
    ...(c.billing_address ? String(c.billing_address).split(/\r?\n/) : []),
    c.phone,
    c.email,
  ].filter(Boolean);
  doc.setFontSize(10).setTextColor(...dark);
  partyLines.forEach((l, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.text(String(l), M, y + 7 + i * 4.8);
  });
  const partyBottom = y + 7 + partyLines.length * 4.8;

  const metaX = pageW - M - 62;
  spec.meta.filter(([, v]) => v).forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...grey);
    doc.text(label, metaX, y + 2 + i * 5.5);
    doc.setFont("helvetica", "bold").setTextColor(...dark);
    doc.text(String(value), pageW - M, y + 2 + i * 5.5, { align: "right" });
  });
  const metaBottom = y + 2 + spec.meta.filter(([, v]) => v).length * 5.5;
  y = Math.max(partyBottom, metaBottom) + 4;

  // ---- items table (a small picture sits inside each Item cell) ----
  const THUMB = 12;
  const hasPics = spec.items.some((it) => images[it.imageUrl]);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["#", "Item", "Qty", "Rate", "Amount"]],
    body: spec.items.map((it, i) => [
      String(i + 1),
      it.description || it.item_name,
      String(it.quantity),
      money(it.rate),
      money(it.amount),
    ]),
    theme: "plain",
    styles: { fontSize: 9, textColor: dark, cellPadding: 2.5, valign: "middle", lineColor: [229, 231, 235], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: [243, 244, 246], textColor: grey, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: "auto", ...(hasPics ? { cellPadding: { top: 2.5, bottom: 2.5, right: 2.5, left: THUMB + 5 } } : {}) },
      2: { halign: "right", cellWidth: 16 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 32 },
    },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index >= 2) d.cell.styles.halign = "right";
      if (d.section === "body" && hasPics && d.column.index === 1) d.cell.styles.minCellHeight = THUMB + 4;
    },
    didDrawCell: (d) => {
      if (d.section !== "body" || d.column.index !== 1) return;
      const img = images[spec.items[d.row.index]?.imageUrl];
      if (!img) return;
      const ratio = img.w / img.h;
      const w = ratio >= 1 ? THUMB : THUMB * ratio;
      const h = ratio >= 1 ? THUMB / ratio : THUMB;
      doc.addImage(img.data, "JPEG", d.cell.x + 2 + (THUMB - w) / 2, d.cell.y + (d.cell.height - h) / 2, w, h);
    },
  });

  // ---- totals ----
  y = doc.lastAutoTable.finalY + 6;
  if (y + spec.totals.length * 6 + 30 > pageH - 20) {
    doc.addPage();
    y = M + 4;
  }
  const totX = pageW - M - 80;
  spec.totals.forEach(([label, value, strong]) => {
    doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(strong ? 11 : 9.5).setTextColor(...dark);
    if (strong) {
      doc.setFillColor(243, 244, 246).rect(totX - 3, y - 4.6, 83, 7.4, "F");
    }
    doc.text(label, totX, y);
    doc.text(value, pageW - M - 1, y, { align: "right" });
    y += 7;
  });

  // ---- notes ----
  if (spec.notes) {
    y += 4;
    if (y + 20 > pageH - 20) { doc.addPage(); y = M + 4; }
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...grey);
    doc.text((spec.notesTitle || "NOTES").toUpperCase(), M, y);
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...dark);
    const wrapped = doc.splitTextToSize(String(spec.notes), pageW - M * 2);
    doc.text(wrapped, M, y + 5);
  }

  // ---- page numbers ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...grey);
    doc.text(`${spec.number}  -  Page ${p} of ${pages}`, pageW / 2, pageH - 8, { align: "center" });
  }
  return doc;
}

async function makePdf(spec) {
  const urls = [...new Set(spec.items.map((i) => i.imageUrl).filter(Boolean))];
  const images = {};
  await Promise.all(urls.map(async (u) => { images[u] = await loadImage(u); }));
  if (COMPANY.logo) images[COMPANY.logo] = await loadImage(COMPANY.logo, 300);
  return renderPdf(spec, images);
}

const lines = (items) =>
  items.map((l) => ({ ...l, imageUrl: primaryImageUrl(l.product) }));

export async function downloadInvoicePdf(inv, customer, asFile = false) {
  const status = inv.status === "void" ? "Void" : inv.balance_due <= 0.004 ? "Paid" : "";
  const doc = await makePdf({
    title: "INVOICE",
    number: inv.invoice_number,
    status,
    customer,
    customerName: inv.customer_name,
    meta: [
      ["Invoice date", dateText(inv.invoice_date)],
      ["Due date", dateText(inv.due_date)],
      ["Terms", customer?.payment_terms],
      ["PO / Order #", inv.order_number],
    ],
    items: lines(inv.items),
    totals: [
      ...(Number(inv.discount_amount) > 0
        ? [
            ["Subtotal", money(inv.subtotal)],
            [
              inv.discount_type === "percent" ? `Discount (${Number(inv.discount_value)}%)` : "Discount",
              `- ${money(inv.discount_amount)}`,
            ],
          ]
        : []),
      ["Total", money(inv.total)],
      ["Paid", money(inv.amount_paid)],
      ["Balance due", money(inv.balance_due), true],
    ],
    notes: inv.notes,
  });
  if (asFile) return new File([doc.output("blob")], `${inv.invoice_number}.pdf`, { type: "application/pdf" });
  doc.save(`${inv.invoice_number}.pdf`);
}

export async function downloadSalesDocPdf(d, customer, asFile = false) {
  const isQuote = d.doc_type === "quote";
  const doc = await makePdf({
    title: isQuote ? "QUOTE" : "SALES ORDER",
    number: d.doc_number,
    status: ["accepted", "declined", "invoiced", "converted"].includes(d.status) ? d.status : "",
    partyLabel: isQuote ? "QUOTE FOR" : "ORDER FOR",
    customer,
    customerName: d.customer_name,
    meta: [
      [isQuote ? "Quote date" : "Order date", dateText(d.doc_date)],
      [isQuote ? "Expiry date" : "Expected shipment", dateText(d.expiry_date)],
      ["Reference #", d.reference],
    ],
    items: lines(d.items),
    totals: [["Total", money(d.total), true]],
    notes: d.notes,
  });
  if (asFile) return new File([doc.output("blob")], `${d.doc_number}.pdf`, { type: "application/pdf" });
  doc.save(`${d.doc_number}.pdf`);
}

export async function downloadCreditNotePdf(cn, customer) {
  const doc = await makePdf({
    title: "CREDIT NOTE",
    number: cn.credit_number,
    status: cn.status === "void" ? "Void" : "",
    partyLabel: "CREDIT TO",
    customer,
    customerName: cn.customer_name,
    meta: [
      ["Credit date", dateText(cn.credit_date)],
      ["Invoice", cn.invoice_number],
    ],
    items: lines(cn.items),
    totals: [
      ["Total", money(cn.total)],
      ["Used on invoices", money(cn.amount_applied)],
      ["Credit left", money(cn.balance), true],
    ],
    notes: cn.reason,
    notesTitle: "Reason",
  });
  doc.save(`${cn.credit_number}.pdf`);
}