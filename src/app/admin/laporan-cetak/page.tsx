import { requireAdmin } from "@/lib/auth";
import { getReport, parseReportParams, PERIOD_LABEL, type ReportParams } from "@/lib/reports";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, orderStatusLabel } from "@/lib/constants";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Cetak Laporan" };

export default async function PrintReport({ searchParams }: { searchParams: Promise<ReportParams> }) {
  await requireAdmin();
  const p = parseReportParams(await searchParams);
  const r = await getReport(p.from, p.to, p.q);
  const s = r.summary;
  const rows: [string, string][] = [
    ["Total omzet", formatRupiah(s.revenue)], ["Omzet Cash", formatRupiah(s.revenueCash)], ["Omzet Transfer", formatRupiah(s.revenueTransfer)],
    ["Pembayaran diterima", formatRupiah(s.paymentsReceived)], ["Belum lunas", formatRupiah(s.unpaidTotal)], ["Total pesanan", String(s.totalOrders)],
    ["Produk terjual", String(s.productsSold)], ["Pesanan selesai", String(s.completedOrders)], ["Pesanan dibatalkan", String(s.cancelledOrders)],
  ];
  return (
    <div className="min-h-dvh bg-white p-6 text-xs text-espresso print:p-0">
      <div className="no-print mb-4 flex justify-end"><PrintButton label="Cetak laporan" /></div>
      <div className="flex items-end justify-between border-b-2 border-maroon pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-maroon.png" alt="Hakuu Bakery" className="h-9" />
        <div className="text-right">
          <p className="font-display text-lg text-maroon">Laporan Penjualan</p>
          <p>{PERIOD_LABEL[p.period]} · {p.from} s/d {p.to}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {rows.map(([k, v]) => <div key={k} className="rounded border border-line p-2"><p className="text-muted">{k}</p><p className="text-sm font-bold">{v}</p></div>)}
      </div>
      <h2 className="mt-5 mb-1 font-sans text-sm font-bold">Produk terlaris</h2>
      <table className="w-full border-collapse">
        <tbody>{r.topProducts.map((t, i) => <tr key={t.name} className="border-b border-line"><td className="py-1">{i + 1}. {t.name}</td><td className="text-right">{t.qty} pcs</td><td className="text-right">{formatRupiah(t.revenue)}</td></tr>)}</tbody>
      </table>
      <h2 className="mt-5 mb-1 font-sans text-sm font-bold">Rincian transaksi</h2>
      <table className="w-full border-collapse">
        <thead><tr className="border-b-2 border-maroon text-left"><th className="py-1">Tanggal</th><th>No.</th><th>Customer</th><th>Produk</th><th className="text-right">Jml</th><th className="text-right">Total</th><th>Metode</th><th>Bayar</th><th>Status</th></tr></thead>
        <tbody>
          {r.transactions.map((o) => (
            <tr key={o.id} className="border-b border-line align-top">
              <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(o.createdAt)}</td><td className="pr-2">{o.orderNumber}</td><td className="pr-2">{o.customerName}</td>
              <td className="pr-2">{o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}</td><td className="text-right">{o.items.reduce((a, i) => a + i.quantity, 0)}</td>
              <td className="pr-2 text-right">{formatRupiah(o.total)}</td><td>{PAYMENT_METHOD_LABEL[o.payment!.method]}</td><td>{PAYMENT_STATUS_LABEL[o.payment!.status]}</td><td>{orderStatusLabel(o.status, o.fulfillmentMethod)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-muted">Omzet = pesanan selesai & lunas. Pesanan batal tidak dihitung. Dicetak {formatDateTime(new Date())}.</p>
    </div>
  );
}
