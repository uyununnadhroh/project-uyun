import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { adminOrNull } from "@/lib/auth";
import { getReport, parseReportParams, PERIOD_LABEL } from "@/lib/reports";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, orderStatusLabel } from "@/lib/constants";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await adminOrNull())) return fail("Unauthorized", 401);
  const url = new URL(req.url);
  const p = parseReportParams(Object.fromEntries(url.searchParams));
  const r = await getReport(p.from, p.to, p.q);
  const s = r.summary;
  const fileBase = `laporan-hakuu-${p.from}_${p.to}`;
  const summaryRows: [string, string | number][] = [
    ["Periode", `${PERIOD_LABEL[p.period]}: ${p.from} s/d ${p.to}`],
    ["Total omzet (selesai & lunas)", s.revenue],
    ["Omzet Cash", s.revenueCash],
    ["Omzet Transfer", s.revenueTransfer],
    ["Ongkos kirim (termasuk omzet)", s.deliveryFees],
    ["Pembayaran diterima (berdasarkan tanggal lunas)", s.paymentsReceived],
    ["Belum lunas (pesanan aktif)", s.unpaidTotal],
    ["Total pesanan", s.totalOrders],
    ["Total produk terjual", s.productsSold],
    ["Pesanan selesai", s.completedOrders],
    ["Pesanan dibatalkan", s.cancelledOrders],
  ];
  const txRows = r.transactions.map((o) => ({
    tanggal: formatDateTime(o.createdAt),
    no: o.orderNumber,
    customer: o.customerName,
    produk: o.items.map((i) => `${i.productName} x${i.quantity}${i.variants.length ? ` (${i.variants.map((v) => v.variantName).join(", ")})` : ""}`).join("; "),
    jumlah: o.items.reduce((a, i) => a + i.quantity, 0),
    total: o.total,
    metode: PAYMENT_METHOD_LABEL[o.payment!.method],
    statusBayar: PAYMENT_STATUS_LABEL[o.payment!.status],
    status: orderStatusLabel(o.status, o.fulfillmentMethod),
  }));

  if (url.searchParams.get("format") === "pdf") {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.setTextColor(77, 12, 20);
    doc.text("Laporan Penjualan Hakuu Bakery", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`${PERIOD_LABEL[p.period]} · ${p.from} s/d ${p.to}${p.q ? ` · pencarian "${p.q}"` : ""} · dicetak ${formatDateTime(new Date())}`, 14, 21);
    const head = { fillColor: [77, 12, 20] as [number, number, number], textColor: 255 };
    autoTable(doc, { startY: 26, head: [["Ringkasan", "Nilai"]], body: summaryRows.map(([k, v]) => [k, typeof v === "number" && k.match(/omzet|Ongkos|Pembayaran|lunas/i) ? formatRupiah(v) : String(v)]), theme: "grid", headStyles: head, styles: { fontSize: 8 }, tableWidth: 130 });
    autoTable(doc, {
      head: [["#", "Produk terlaris", "Terjual", "Pendapatan"]],
      body: r.topProducts.map((t, i) => [i + 1, t.name, t.qty, formatRupiah(t.revenue)]),
      theme: "grid", headStyles: head, styles: { fontSize: 8 }, tableWidth: 130,
    });
    autoTable(doc, {
      head: [["Tanggal", "No. Pesanan", "Customer", "Produk", "Jml", "Total", "Metode", "Status Bayar", "Status Pesanan"]],
      body: txRows.map((t) => [t.tanggal, t.no, t.customer, t.produk, t.jumlah, formatRupiah(t.total), t.metode, t.statusBayar, t.status]),
      theme: "striped", headStyles: head, styles: { fontSize: 7, cellPadding: 1.5 }, columnStyles: { 3: { cellWidth: 70 } },
    });
    const buf = Buffer.from(doc.output("arraybuffer"));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileBase}.pdf"` } });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hakuu Bakery";
  const money = '"Rp"#,##0';
  const header = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4D0C14" } };
  };
  const sum = wb.addWorksheet("Ringkasan");
  sum.columns = [{ header: "Keterangan", key: "k", width: 48 }, { header: "Nilai", key: "v", width: 32 }];
  summaryRows.forEach(([k, v]) => {
    const row = sum.addRow({ k, v });
    if (typeof v === "number" && /omzet|Ongkos|Pembayaran|lunas/i.test(k)) row.getCell(2).numFmt = money;
  });
  header(sum);

  const tx = wb.addWorksheet("Transaksi");
  tx.columns = [
    { header: "Tanggal", key: "tanggal", width: 22 }, { header: "No. Pesanan", key: "no", width: 20 }, { header: "Customer", key: "customer", width: 22 },
    { header: "Produk", key: "produk", width: 60 }, { header: "Jumlah Produk", key: "jumlah", width: 14 }, { header: "Total", key: "total", width: 16, style: { numFmt: money } },
    { header: "Metode Pembayaran", key: "metode", width: 18 }, { header: "Status Pembayaran", key: "statusBayar", width: 20 }, { header: "Status Pesanan", key: "status", width: 26 },
  ];
  tx.addRows(txRows);
  header(tx);
  tx.autoFilter = { from: "A1", to: "I1" };

  const pr = wb.addWorksheet("Produk");
  pr.columns = [{ header: "Produk", key: "name", width: 36 }, { header: "Terjual (pcs)", key: "qty", width: 16 }, { header: "Pendapatan", key: "revenue", width: 18, style: { numFmt: money } }];
  pr.addRows([...r.topProducts, ...r.lowestProducts.filter((l) => !r.topProducts.some((t) => t.name === l.name))]);
  header(pr);

  const daily = wb.addWorksheet("Harian");
  daily.columns = [{ header: "Tanggal", key: "day", width: 14 }, { header: "Omzet", key: "revenue", width: 18, style: { numFmt: money } }, { header: "Pesanan masuk", key: "orders", width: 16 }, { header: "Dibatalkan", key: "cancelled", width: 14 }];
  daily.addRows(r.daily);
  header(daily);

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fileBase}.xlsx"` },
  });
}
