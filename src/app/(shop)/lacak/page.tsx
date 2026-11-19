import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getOrderAccessList } from "@/lib/order-access";
import { TrackForm } from "@/components/shop/track-form";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_TONE, orderStatusLabel } from "@/lib/constants";
import { formatDateTime, formatRupiah } from "@/lib/utils";

export const metadata: Metadata = { title: "Lacak Pesanan" };
export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const { no } = await searchParams;
  const access = await getOrderAccessList();
  const recent = access.length
    ? await prisma.order.findMany({ where: { orderNumber: { in: access }, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { orderNumber: true, status: true, total: true, createdAt: true, fulfillmentMethod: true } })
    : [];
  return (
    <div className="container-page grid gap-10 pt-6 pb-10 sm:pt-10 lg:grid-cols-2">
      <div>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-cream-200 text-maroon"><PackageSearch className="h-6 w-6" /></div>
        <h1 className="mt-5 text-4xl text-maroon sm:text-5xl">Lacak Pesanan</h1>
        <p className="mt-3 max-w-md text-muted">Masukkan nomor pesanan dan nomor WhatsApp yang kamu gunakan saat memesan. Tidak perlu membuat akun.</p>
        <div className="mt-8 max-w-md rounded-3xl border border-line bg-white p-6 shadow-soft">
          <TrackForm defaultOrderNumber={no} />
        </div>
      </div>
      {recent.length > 0 && (
        <div>
          <p className="eyebrow">Pesanan di perangkat ini</p>
          <ul className="mt-4 space-y-3">
            {recent.map((r) => (
              <li key={r.orderNumber}>
                <Link href={`/pesanan/${r.orderNumber}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-caramel">
                  <div>
                    <p className="font-semibold">{r.orderNumber}</p>
                    <p className="text-xs text-muted">{formatDateTime(r.createdAt)} · {formatRupiah(r.total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={ORDER_STATUS_TONE[r.status]}>{orderStatusLabel(r.status, r.fulfillmentMethod)}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
