import { getReport, parseReportParams, PERIOD_LABEL, type ReportParams } from "@/lib/reports";
import { PageHeader } from "@/components/admin/shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { ReportControls } from "@/components/admin/report-controls";
import { RevenueAreaChart, MonthlyBarChart, DailyCountChart, TopProductsBars } from "@/components/admin/charts";
import { ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, orderStatusLabel } from "@/lib/constants";
import { formatDateOnly, formatDateTime, formatRupiah } from "@/lib/utils";

export const metadata = { title: "Sales Reports" };

function Metric({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl bg-maroon p-4 text-cream" : "rounded-2xl border border-line bg-white p-4"}>
      <p className={strong ? "text-xs text-cream/70 uppercase" : "text-xs text-muted uppercase"}>{label}</p>
      <p className={strong ? "mt-1 font-display text-2xl" : "mt-1 font-display text-2xl text-maroon"}>{value}</p>
      {hint && <p className={strong ? "mt-0.5 text-[0.7rem] text-cream/60" : "mt-0.5 text-[0.7rem] text-muted"}>{hint}</p>}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportParams> }) {
  const sp = await searchParams;
  const p = parseReportParams(sp);
  const r = await getReport(p.from, p.to, p.q);
  const s = r.summary;
  const days = r.daily.length;

  return (
    <>
      <PageHeader title="Sales Reports" description={`${PERIOD_LABEL[p.period]} · ${formatDateOnly(p.from, { day: "numeric", month: "long", year: "numeric" })}${p.from !== p.to ? ` – ${formatDateOnly(p.to, { day: "numeric", month: "long", year: "numeric" })}` : ""}`} />
      <ReportControls />

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Metric strong label="Total omzet" value={formatRupiah(s.revenue)} hint={`${s.completedOrders} pesanan selesai & lunas`} />
        <Metric label="Pembayaran diterima" value={formatRupiah(s.paymentsReceived)} hint={`${s.paymentsReceivedCount} pembayaran lunas pada periode`} />
        <Metric label="Belum lunas" value={formatRupiah(s.unpaidTotal)} hint={`${s.unpaidCount} pesanan aktif`} />
        <Metric label="Omzet Cash" value={formatRupiah(s.revenueCash)} />
        <Metric label="Omzet Transfer" value={formatRupiah(s.revenueTransfer)} />
        <Metric label="Total pesanan" value={String(s.totalOrders)} hint="Pesanan masuk pada periode" />
        <Metric label="Produk terjual" value={s.productsSold.toLocaleString("id-ID")} hint="Dari pesanan selesai" />
        <Metric label="Pesanan selesai" value={String(s.completedOrders)} />
        <Metric label="Pesanan dibatalkan" value={String(s.cancelledOrders)} hint="Tidak dihitung sebagai penjualan" />
        <Metric label="Ongkir (termasuk omzet)" value={formatRupiah(s.deliveryFees)} />
      </div>
      <Alert className="mt-4">
        <b>Definisi:</b> Omzet = pesanan berstatus <i>Selesai</i> dan pembayaran <i>Lunas</i>, dihitung pada tanggal selesai. Pembayaran diterima = pembayaran lunas berdasarkan tanggal lunas (bisa termasuk pesanan yang belum selesai). Belum lunas = pesanan aktif periode ini yang pembayarannya belum lunas. Pesanan batal tidak pernah dihitung.
      </Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Omzet harian" />
          <div className="p-4">{days <= 400 ? <RevenueAreaChart data={r.daily} /> : <p className="text-sm text-muted">Rentang terlalu panjang.</p>}</div>
        </Card>
        <Card>
          <CardHeader title="Omzet bulanan" />
          <div className="p-4"><MonthlyBarChart data={r.monthly} /></div>
        </Card>
        <Card>
          <CardHeader title="Jumlah pesanan per hari" description="Termasuk pesanan batal" />
          <div className="p-4"><DailyCountChart data={r.daily} /></div>
        </Card>
        <Card>
          <CardHeader title="Produk terlaris" description="Berdasarkan jumlah terjual (pesanan selesai)" />
          <div className="p-5"><TopProductsBars data={r.topProducts.map((t) => ({ name: t.name, qty: t.qty }))} /></div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Produk terlaris (rinci)" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.topProducts.length === 0 && <tr><td className="px-5 py-6 text-center text-muted">Belum ada penjualan.</td></tr>}
              {r.topProducts.map((t, i) => (
                <tr key={t.name}><td className="px-5 py-2.5">{i + 1}. {t.name}</td><td className="px-3 py-2.5 text-right tabular-nums">{t.qty} pcs</td><td className="px-5 py-2.5 text-right tabular-nums">{formatRupiah(t.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Penjualan terendah" description="Termasuk produk aktif yang belum terjual" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.lowestProducts.map((t) => (
                <tr key={t.name}><td className="px-5 py-2.5">{t.name}</td><td className="px-3 py-2.5 text-right tabular-nums">{t.qty} pcs</td><td className="px-5 py-2.5 text-right tabular-nums">{formatRupiah(t.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto">
        <CardHeader title="Rincian transaksi" description={`${r.transactions.length} transaksi (berdasarkan tanggal pesanan dibuat)`} />
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-line bg-cream-100 text-left text-xs tracking-wide text-muted uppercase">
            <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">No. Pesanan</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Produk</th><th className="px-4 py-3 text-center">Jml</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Metode</th><th className="px-4 py-3">Status bayar</th><th className="px-4 py-3">Status pesanan</th></tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {r.transactions.map((o) => (
              <tr key={o.id} className="hover:bg-cream/60">
                <td className="px-4 py-2.5 text-xs whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                <td className="px-4 py-2.5"><a href={`/admin/pesanan/${o.id}`} className="font-semibold text-maroon hover:underline">{o.orderNumber}</a></td>
                <td className="px-4 py-2.5">{o.customerName}</td>
                <td className="max-w-60 px-4 py-2.5 text-xs">{o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}</td>
                <td className="px-4 py-2.5 text-center">{o.items.reduce((a, i) => a + i.quantity, 0)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatRupiah(o.total)}</td>
                <td className="px-4 py-2.5 text-xs">{PAYMENT_METHOD_LABEL[o.payment!.method]}</td>
                <td className="px-4 py-2.5"><Badge tone={PAYMENT_STATUS_TONE[o.payment!.status]}>{PAYMENT_STATUS_LABEL[o.payment!.status]}</Badge></td>
                <td className="px-4 py-2.5"><Badge tone={ORDER_STATUS_TONE[o.status]}>{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge></td>
              </tr>
            ))}
            {r.transactions.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">Tidak ada transaksi pada periode ini.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
