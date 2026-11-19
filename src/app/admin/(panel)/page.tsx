import Link from "next/link";
import { Hourglass, Wallet, BadgeCheck, ChefHat, CircleCheckBig, ArrowRight, AlertTriangle } from "lucide-react";
import { getDashboard } from "@/lib/reports";
import { expireOverdueOrders } from "@/lib/order-service";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/shell";
import { Card, CardHeader } from "@/components/ui/card";
import { RevenueAreaChart, MonthlyBarChart, TopProductsBars } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, orderStatusLabel } from "@/lib/constants";
import { formatDateTime, formatRupiah, todayWIB, formatDateOnly } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export const metadata = { title: "Dashboard" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl text-maroon">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export default async function Dashboard() {
  await expireOverdueOrders();
  const [d, recent, s, bankCount] = await Promise.all([
    getDashboard(),
    prisma.order.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 6, include: { payment: true } }),
    getSettings(),
    prisma.bankAccount.count({ where: { isActive: true } }),
  ]);
  const c = (k: OrderStatus) => d.statusCount[k] ?? 0;
  const inProduction = c("SCHEDULED") + c("IN_PRODUCTION") + c("PACKING");
  const setupMissing = [!s.whatsappNumber && "nomor WhatsApp", !s.address && "alamat toko", !s.operatingHours && "jam operasional", bankCount === 0 && "rekening bank"].filter(Boolean);

  const actionCards = [
    { label: "Menunggu konfirmasi", value: c("PENDING_CONFIRMATION"), icon: Hourglass, href: "/admin/pesanan?status=PENDING_CONFIRMATION" },
    { label: "Menunggu pembayaran", value: c("AWAITING_PAYMENT"), icon: Wallet, href: "/admin/pesanan?status=AWAITING_PAYMENT" },
    { label: "Pembayaran menunggu verifikasi", value: d.waitingProofs, icon: BadgeCheck, href: "/admin/verifikasi" },
    { label: "Sedang diproduksi", value: inProduction, icon: ChefHat, href: "/admin/pesanan?status=IN_PRODUCTION" },
    { label: "Pesanan selesai", value: c("COMPLETED"), icon: CircleCheckBig, href: "/admin/pesanan?status=COMPLETED" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={formatDateOnly(todayWIB())} />
      {setupMissing.length > 0 && (
        <Alert tone="warning" className="mb-6" title="Lengkapi pengaturan toko">
          Belum diatur: {setupMissing.join(", ")}.{" "}
          <Link href={bankCount === 0 && setupMissing.length === 1 ? "/admin/rekening" : "/admin/pengaturan"} className="font-semibold underline">Atur sekarang</Link>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Penjualan hari ini" value={formatRupiah(d.revenueToday)} sub="Omzet pesanan selesai & lunas" />
        <Stat label="Pesanan hari ini" value={String(d.ordersToday)} sub={`Nilai ${formatRupiah(d.orderValueToday)} (tidak termasuk batal)`} />
        <Stat label="Pesanan bulan ini" value={String(d.ordersMonth)} sub="Semua pesanan masuk" />
        <Stat label="Pendapatan bulan ini" value={formatRupiah(d.revenueMonth)} sub="Omzet pesanan selesai & lunas" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {actionCards.map((a) => (
          <Link key={a.label} href={a.href} className="group flex flex-col justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-caramel">
            <a.icon className="h-5 w-5 text-caramel-dark" />
            <div>
              <p className="text-2xl font-bold text-espresso">{a.value}</p>
              <p className="flex items-center gap-1 text-xs text-muted">{a.label} <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" /></p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Penjualan harian" description="Omzet 30 hari terakhir (pesanan selesai & lunas)" />
          <div className="p-4"><RevenueAreaChart data={d.daily} /></div>
        </Card>
        <Card>
          <CardHeader title="Produk paling laris" description="30 hari terakhir" />
          <div className="p-5"><TopProductsBars data={d.topProducts} /></div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Penjualan bulanan" description="12 bulan terakhir" />
          <div className="p-4"><MonthlyBarChart data={d.monthly} /></div>
        </Card>
        <Card>
          <CardHeader title="Ringkasan status pesanan" />
          <ul className="divide-y divide-line px-5 py-2 text-sm">
            {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((k) => (
              <li key={k} className="flex items-center justify-between py-2">
                <Link href={`/admin/pesanan?status=${k}`} className="hover:text-maroon">{ORDER_STATUS_LABEL[k]}</Link>
                <span className="font-semibold tabular-nums">{c(k)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Pesanan terbaru" action={<Link href="/admin/pesanan" className="text-sm font-semibold text-maroon hover:underline">Lihat semua</Link>} />
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Belum ada pesanan.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pesanan/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-cream-100">
                  <div>
                    <p className="font-semibold">{o.orderNumber} <span className="font-normal text-muted">· {o.customerName}</span></p>
                    <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.payment?.status === "WAITING_VERIFICATION" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    <span className="text-sm font-semibold">{formatRupiah(o.total)}</span>
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
