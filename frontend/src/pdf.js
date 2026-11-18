// Downloadable PDFs for invoices, quotes, sales orders and credit notes.
// Needs:  npm install jspdf jspdf-autotable
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BASE_URL, apiFetch } from "./api.js";

// The company details (name, address, phone, email, logo, footer) come from the API: GET /company/profile.
// Loaded once per session and kept here; call clearCompanyProfileCache() after the profile is edited.
// (After switching company the page reloads, so the cache starts empty again.)
let cachedCompany = null;
let companyLoading = null;

const EMPTY_COMPANY = { name: "", lines: [], footer: "", logo: null };

function toPdfCompany(p) {
  const lines = String(p.address_lines || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  if (p.email) lines.push(`Email: ${p.email}`);
  return { name: p.name || "", lines, footer: p.invoice_footer || "", logo: p.logo_url || null };
}

export function clearCompanyProfileCache() {
  cachedCompany = null;
}

export async function loadCompanyProfile() {
  if (cachedCompany) return cachedCompany;
  if (!companyLoading) {
    companyLoading = (async () => {
      try {
        const res = await apiFetch(`${BASE_URL}/company/profile`);
        if (res.ok) cachedCompany = toPdfCompany(await res.json());
      } catch {
        /* offline / server error: the PDF is still made, just without company details */
      }
      return cachedCompany || EMPTY_COMPANY;
    })().finally(() => { companyLoading = null; });
  }
  return companyLoading;
}

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


function drawPaidSeal(doc, cx, cy, size = 40, tiltDeg = -10) {
  const green = [0, 145, 65];
  const r = size / 2;
  const t = (tiltDeg * Math.PI) / 180;
  const rotPt = (x, y) => [
    cx + x * Math.cos(t) - y * Math.sin(t),
    cy + x * Math.sin(t) + y * Math.cos(t),
  ];

  doc.saveGraphicsState();
  doc.setDrawColor(...green);
  doc.setFillColor(...green);
  doc.setTextColor(...green);

  // ---- scalloped edge: a disc plus a ring of small circles ----
  const scallops = 36;
  const rho = r * 0.09;
  doc.circle(cx, cy, r - rho, "F");
  for (let i = 0; i < scallops; i++) {
    const a = (2 * Math.PI * i) / scallops;
    doc.circle(cx + Math.cos(a) * (r - rho), cy + Math.sin(a) * (r - rho), rho, "F");
  }

  // ---- white face + two thin rings ----
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r - rho - r * 0.07, "F");
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r * 0.8, "S");
  doc.setLineWidth(0.35);
  doc.circle(cx, cy, r * 0.5, "S");

  // ---- curved THANK YOU (top and bottom, both read left to right) ----
  const fs = size * 0.24;
  const capH = fs * 0.3528 * 0.72;
  const mid = r * 0.65; // middle of the text ring

  const arcText = (text, bottom) => {
    doc.setFont("helvetica", "bold").setFontSize(fs).setTextColor(...green);
    const R = bottom ? mid + capH / 2 : mid - capH / 2; // baseline radius
    const chars = [...text];
    const gap = 0.35;
    const widths = chars.map((ch) => doc.getTextWidth(ch));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    let pos = -total / 2;
    chars.forEach((ch, i) => {
      const w = widths[i];
      const angDeg = ((pos + w / 2) / R) * (180 / Math.PI);
      pos += w + gap;
      if (ch === " ") return;

      const thetaDeg = (bottom ? 90 - angDeg : -90 + angDeg) + tiltDeg; // position on circle
      const phiDeg = (bottom ? -angDeg : angDeg) + tiltDeg;              // letter rotation (clockwise)
      const th = (thetaDeg * Math.PI) / 180;
      const ph = (phiDeg * Math.PI) / 180;

      const px = cx + Math.cos(th) * R;
      const py = cy + Math.sin(th) * R;
      doc.text(ch, px - (Math.cos(ph) * w) / 2, py - (Math.sin(ph) * w) / 2, { angle: -phiDeg });
    });
  };
  arcText("THANK YOU", false);
  arcText("THANK YOU", true);

  // ---- PAID ribbon band across the centre ----
  const fs2 = size * 0.55;
  doc.setFont("helvetica", "bold").setFontSize(fs2);
  const capH2 = fs2 * 0.3528 * 0.72;
  const hh = capH2 / 2 + r * 0.08;
  const bw = r * 0.83;

  const p0 = rotPt(-bw, -hh);
  const p1 = rotPt(bw, -hh);
  const p2 = rotPt(bw, hh);
  const p3 = rotPt(-bw, hh);

  doc.setFillColor(255, 255, 255);
  doc.lines(
    [[p1[0] - p0[0], p1[1] - p0[1]], [p2[0] - p1[0], p2[1] - p1[1]], [p3[0] - p2[0], p3[1] - p2[1]]],
    p0[0], p0[1], [1, 1], "F", true
  );
  doc.setDrawColor(...green).setLineWidth(0.7);
  doc.line(p0[0], p0[1], p1[0], p1[1]);
  doc.line(p3[0], p3[1], p2[0], p2[1]);

  doc.setTextColor(...green);
  const w = doc.getTextWidth("PAID");
  const [sx, sy] = rotPt(-w / 2, capH2 / 2);
  doc.text("PAID", sx, sy, { angle: -tiltDeg });

  doc.restoreGraphicsState();
}



export function renderPdf(spec, images = {}, COMPANY = cachedCompany || EMPTY_COMPANY) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14; // page margin
  const dark = [31, 41, 55];
  const grey = [107, 114, 128];

  // ---- header: logo + company (left), title (right) ----
  let leftY = M;
  let textX = M;
  const logo = COMPANY.logo ? images[COMPANY.logo] : null;   // null when it could not be loaded: no logo, PDF still works
  if (logo) {
    const h = 16;
    const w = Math.min(40, (logo.w / logo.h) * h);
    doc.addImage(logo.data, "JPEG", M, M - 2, w, h);
    leftY = M + h + 1;
  }
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(COMPANY.name || "", textX, leftY + 4);
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
    margin: { left: M, right: M, bottom: COMPANY.footer ? 24 : 12 },
    head: [spec.simple ? ["#", spec.simple, "Amount"] : ["#", "Item", "Qty", "Rate", "Amount"]],
    body: spec.items.map((it, i) =>
      spec.simple
        ? [String(i + 1), it.description || it.item_name, money(it.amount)]
        : [
            String(i + 1),
            it.description || it.item_name,
            String(it.quantity),
            money(it.rate),
            money(it.amount),
          ],
    ),
    theme: "plain",
    styles: { fontSize: 9, textColor: dark, cellPadding: 2.5, valign: "middle", lineColor: [229, 231, 235], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: [243, 244, 246], textColor: grey, fontStyle: "bold", fontSize: 8 },
    columnStyles: spec.simple
      ? {
          0: { cellWidth: 9 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 40 },
        }
      : {
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
  if (y + spec.totals.length * 6 + 30 > pageH - 26) {
    doc.addPage();
    y = M + 4;
  }
  const totX = pageW - M - 80;
  const totalsTop = y;
  spec.totals.forEach(([label, value, strong]) => {
    doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(strong ? 11 : 9.5).setTextColor(...dark);
    if (strong) {
      doc.setFillColor(243, 244, 246).rect(totX - 3, y - 4.6, 83, 7.4, "F");
    }
    doc.text(label, totX, y);
    doc.text(value, pageW - M - 1, y, { align: "right" });
    y += 7;
  });

  if (String(spec.status || "").toLowerCase() === "paid") {
  drawPaidSeal(doc, M + 50, totalsTop + 15, 38); 
}

  // ---- notes ----
  if (spec.notes) {
    y += 4;
    if (y + 20 > pageH - 26) { doc.addPage(); y = M + 4; }
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...grey);
    doc.text((spec.notesTitle || "NOTES").toUpperCase(), M, y);
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...dark);
    const wrapped = doc.splitTextToSize(String(spec.notes), pageW - M * 2);
    doc.text(wrapped, M, y + 5);
  }

  // ---- invoice footer (company setting) + page numbers ----
  const pages = doc.getNumberOfPages();
  const footerLines = COMPANY.footer ? doc.splitTextToSize(String(COMPANY.footer), pageW - M * 2).slice(0, 3) : [];
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (footerLines.length) {
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...grey);
      doc.text(footerLines, pageW / 2, pageH - 8 - 4 - footerLines.length * 3.8, { align: "center" });
    }
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...grey);
    doc.text(`${spec.number}  -  Page ${p} of ${pages}`, pageW / 2, pageH - 8, { align: "center" });
  }
  return doc;
}

async function makePdf(spec) {
  const company = await loadCompanyProfile();
  const urls = [...new Set(spec.items.map((i) => i.imageUrl).filter(Boolean))];
  const images = {};
  await Promise.all(urls.map(async (u) => { images[u] = await loadImage(u); }));
  if (company.logo) images[company.logo] = await loadImage(company.logo, 300);   // null on CORS/blocked: PDF is made without it
  return renderPdf(spec, images, company);
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
    items: inv.items.map((l) => ({ ...l, imageUrl: null })), // invoices are printed without item pictures
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

export async function downloadCreditNotePdf(cn, customer, asFile = false) {
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
  if (asFile) return new File([doc.output("blob")], `${cn.credit_number}.pdf`, { type: "application/pdf" });
  doc.save(`${cn.credit_number}.pdf`);
}

// Payment received (money in) - lists the invoices it paid
export async function downloadPaymentPdf(p, customer, asFile = false) {
  const doc = await makePdf({
    title: "PAYMENT RECEIPT",
    number: p.payment_number,
    partyLabel: "RECEIVED FROM",
    customer,
    customerName: p.customer_name,
    meta: [
      ["Payment date", dateText(p.payment_date)],
      ["Mode", p.payment_mode],
      ["Deposited to", p.deposit_account_name],
      ["Reference #", p.reference],
    ],
    simple: "Applied to invoice",
    items: (p.allocations || []).map((a) => ({ description: a.invoice_number, amount: a.amount })),
    totals: [["Amount received", money(p.amount), true]],
    notes: p.notes,
  });
  if (asFile) return new File([doc.output("blob")], `${p.payment_number}.pdf`, { type: "application/pdf" });
  doc.save(`${p.payment_number}.pdf`);
}

// Payment made to a vendor (money out) - lists the bills it paid
export async function downloadVendorPaymentPdf(p, vendor, asFile = false) {
  const doc = await makePdf({
    title: "PAYMENT MADE",
    number: p.payment_number,
    partyLabel: "PAID TO",
    customer: vendor ? { display_name: vendor.name, billing_address: vendor.address, phone: vendor.phone, email: vendor.email } : null,
    customerName: p.vendor_name,
    meta: [
      ["Payment date", dateText(p.payment_date)],
      ["Mode", p.payment_mode],
      ["Paid from", p.paid_from_account_name],
      ["Reference #", p.reference],
    ],
    simple: "Applied to bill",
    items: (p.allocations || []).map((a) => ({ description: a.bill_number, amount: a.amount })),
    totals: [["Amount paid", money(p.amount), true]],
    notes: p.notes,
  });
  if (asFile) return new File([doc.output("blob")], `${p.payment_number}.pdf`, { type: "application/pdf" });
  doc.save(`${p.payment_number}.pdf`);
}

// Purchase bill (from a vendor)
export async function downloadPurchaseBillPdf(b, vendor, asFile = false) {
  const doc = await makePdf({
    title: "BILL",
    number: b.bill_number,
    status: b.status === "void" ? "Void" : b.balance_due <= 0.004 ? "Paid" : "",
    partyLabel: "VENDOR",
    customer: vendor ? { display_name: vendor.name, billing_address: vendor.address, phone: vendor.phone, email: vendor.email } : null,
    customerName: b.vendor_name,
    meta: [
      ["Bill date", dateText(b.bill_date)],
      ["Due date", dateText(b.due_date)],
      ["Vendor ref #", b.vendor_ref],
    ],
    items: (b.items || []).map((l) => ({ ...l, imageUrl: null })),
    totals: [
      ["Total", money(b.total)],
      ["Paid", money(b.amount_paid)],
      ["Balance due", money(b.balance_due), true],
    ],
    notes: b.notes,
  });
  if (asFile) return new File([doc.output("blob")], `${b.bill_number}.pdf`, { type: "application/pdf" });
  doc.save(`${b.bill_number}.pdf`);
}

// ---------- Daily Sales & Collection report (one day) ----------
export async function makeDailySalesPdf(day, rep, det) {
  const company = await loadCompanyProfile();
  const logo = company.logo ? await loadImage(company.logo, 300) : null; // null if it can't load: PDF still works
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const dark = [31, 41, 55];
  const grey = [107, 114, 128];

  // ---- header: logo + company (left), title + date (right) ----
  let leftY = M;
  if (logo) {
    const h = 16;
    const w = Math.min(40, (logo.w / logo.h) * h);
    doc.addImage(logo.data, "JPEG", M, M - 2, w, h);
    leftY = M + h + 1;
  }
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(company.name || "", M, leftY + 4);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...grey);
  company.lines.forEach((l, i) => doc.text(l, M, leftY + 9 + i * 4.2));
  const headerBottom = leftY + 9 + company.lines.length * 4.2;

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("DAILY SALES REPORT", pageW - M, M + 6, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(dateText(day), pageW - M, M + 13, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...grey);
  doc.text(`Printed ${new Date().toLocaleString("en-GB")}`, pageW - M, M + 18, { align: "right" });

  let y = Math.max(headerBottom, M + 22) + 6;
  doc.setDrawColor(229, 231, 235).line(M, y - 3, pageW - M, y - 3);

  // ---- tables ----
  const baseTable = {
    margin: { left: M, right: M, bottom: 14 },
    theme: "plain",
    styles: { fontSize: 9, textColor: dark, cellPadding: 2.5, lineColor: [229, 231, 235], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: [243, 244, 246], textColor: grey, fontStyle: "bold", fontSize: 8 },
  };
  const section = (title, head, body, rightCols = []) => {
    if (doc.lastAutoTable) y = doc.lastAutoTable.finalY + 8;
    if (y > pageH - 40) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...grey);
    doc.text(title, M, y);
    const columnStyles = {};
    rightCols.forEach((c) => { columnStyles[c] = { halign: "right" }; });
    autoTable(doc, {
      ...baseTable,
      startY: y + 2,
      head: [head],
      body: body.length ? body : [[{ content: "None", colSpan: head.length, styles: { textColor: grey } }]],
      columnStyles,
      didParseCell: (d) => {
        if (d.section === "head" && rightCols.includes(d.column.index)) d.cell.styles.halign = "right";
      },
    });
    y = doc.lastAutoTable.finalY;
  };

  const r = rep.rows[0] || { invoices: 0, sales: 0, returns: 0, net_sales: 0, payments: 0, collection: 0 };
  const byMode = {};
  for (const p of det.payments) byMode[p.mode || "Other"] = (byMode[p.mode || "Other"] || 0) + p.amount;

  section("SUMMARY", ["Item", "Count", "Amount"], [
    ["Sales (invoices)", String(r.invoices), money(r.sales)],
    ["Returns (credit notes)", "", money(r.returns)],
    ["Net sales", "", money(r.net_sales)],
    ["Collection (payments)", String(r.payments), money(r.collection)],
    ["Net sales - collection", "", money(r.net_sales - r.collection)],
  ], [1, 2]);

  section("COLLECTION BY PAYMENT MODE", ["Mode", "Amount"],
    Object.entries(byMode).map(([mode, amt]) => [mode, money(amt)]), [1]);

  section("INVOICES", ["Number", "Customer", "Total", "Paid"],
    det.invoices.map((i) => [i.number, i.customer, money(i.total), money(i.paid)]), [2, 3]);

  section("PAYMENTS RECEIVED", ["Number", "Customer", "Mode", "Amount"],
    det.payments.map((p) => [p.number, p.customer, p.mode || "", money(p.amount)]), [3]);

  // ---- page numbers ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...grey);
    doc.text(`Daily Sales Report ${day}  -  Page ${p} of ${pages}`, pageW / 2, pageH - 8, { align: "center" });
  }
  return doc;
}