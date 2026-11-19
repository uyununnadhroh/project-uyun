import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/db";
import { buildOrderWhere, type OrderFilters } from "@/lib/admin-orders";
import { expireOverdueOrders } from "@/lib/order-service";
import { PageHeader } from "@/components/admin/shell";
import { AdminSearch } from "@/components/admin/search";
import { DateRangeInputs } from "@/components/admin/date-range";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, FULFILLMENT_LABEL, orderStatusLabel } from "@/lib/constants";
import { displayPhone, formatDateOnly, formatDateTime, formatRupiah } from "@/lib/utils";

export const metadata = { title: "Orders" };
const PER_PAGE = 25;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrderFilters & { page?: string }> }) {
  const sp = await searchParams;
  await expireOverdueOrders();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const where = buildOrderWhere(sp);
  const [orders, total, sum] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { items: { include: { variants: { orderBy: { slotNumber: "asc" } } } }, payment: true } }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where: { ...where, status: { not: "CANCELLED" } }, _sum: { total: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `?${u}`;
  };

  return (
    <>
      <PageHeader title="Orders" description={`${total} pesanan · nilai (tanpa batal) ${formatRupiah(sum._sum.total ?? 0)}`} />
      <AdminSearch
        placeholder="Cari no. pesanan, nama, WhatsApp, produk…"
        filters={[
          { name: "periode", label: "Semua waktu", options: [{ value: "hari", label: "Hari ini" }, { value: "minggu", label: "Minggu ini" }, { value: "bulan", label: "Bulan ini" }, { value: "custom", label: "Rentang tanggal…" }] },
          { name: "status", label: "Semua status", options: Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "statusBayar", label: "Status bayar", options: Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "bayar", label: "Metode bayar", options: [{ value: "CASH", label: "Cash" }, { value: "TRANSFER", label: "Transfer" }] },
          { name: "terima", label: "Penerimaan", options: [{ value: "PICKUP", label: "Pick Up" }, { value: "DELIVERY", label: "Delivery" }] },
        ]}
      >
        {sp.periode === "custom" && <DateRangeInputs />}
      </AdminSearch>

      {orders.length === 0 ? (
        <EmptyState className="mt-4" icon={<ShoppingCart className="h-6 w-6" />} title="Tidak ada pesanan" description="Belum ada pesanan yang cocok dengan filter." />
      ) : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-b border-line bg-cream-100 text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">No. Pesanan</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3 text-center">Jml</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Bayar</th>
                <th className="px-4 py-3">Penerimaan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-cream/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pesanan/${o.id}`} className="font-semibold text-maroon hover:underline">{o.orderNumber}</Link>
                    <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.customerName}</p>
                    <p className="text-xs text-muted">{displayPhone(o.customerPhone)}</p>
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    {o.items.map((it) => (
                      <p key={it.id} className="text-xs">
                        <span className="font-medium">{it.productName}</span> ×{it.quantity}
                        {it.variants.length > 0 && <span className="text-muted"> ({it.variants.map((v) => v.variantName).join(", ")})</span>}
                      </p>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatRupiah(o.total)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs">{PAYMENT_METHOD_LABEL[o.payment!.method]}</p>
                    <Badge tone={PAYMENT_STATUS_TONE[o.payment!.status]} className="mt-1">{PAYMENT_STATUS_LABEL[o.payment!.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{FULFILLMENT_LABEL[o.fulfillmentMethod]}</p>
                    <p className="text-xs text-muted">{formatDateOnly(o.scheduledDate, { day: "numeric", month: "short", year: "numeric" })}, {o.scheduledTime}</p>
                  </td>
                  <td className="px-4 py-3"><Badge tone={ORDER_STATUS_TONE[o.status]}>{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge></td>
                  <td className="px-4 py-3 text-right"><Link href={`/admin/pesanan/${o.id}`} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-caramel">Kelola</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Halaman {page} dari {pages}</p>
          <div className="flex gap-2">
            {page > 1 && <Link href={qs(page - 1)} className="rounded-full border border-line bg-white px-4 py-2 hover:border-caramel">← Sebelumnya</Link>}
            {page < pages && <Link href={qs(page + 1)} className="rounded-full border border-line bg-white px-4 py-2 hover:border-caramel">Berikutnya →</Link>}
          </div>
        </div>
      )}
    </>
  );
}
