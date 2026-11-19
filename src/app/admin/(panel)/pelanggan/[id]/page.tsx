import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsAppLink } from "@/components/shop/whatsapp-button";
import { ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, orderStatusLabel } from "@/lib/constants";
import { displayPhone, formatDateTime, formatRupiah } from "@/lib/utils";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { where: { archivedAt: null }, orderBy: { createdAt: "desc" }, include: { payment: true, items: true } } },
  });
  if (!c) notFound();
  const valid = c.orders.filter((o) => o.status !== "CANCELLED");
  const paid = valid.filter((o) => o.payment?.status === "PAID").reduce((s, o) => s + o.total, 0);
  return (
    <>
      <Link href="/admin/pelanggan" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-maroon"><ChevronLeft className="h-4 w-4" /> Semua customer</Link>
      <PageHeader title={c.name} description={`${displayPhone(c.phone)} · customer sejak ${formatDateTime(c.createdAt)}`} action={<WhatsAppLink number={c.phone} className="h-9 px-4">Chat WhatsApp</WhatsAppLink>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs text-muted uppercase">Jumlah transaksi</p><p className="mt-1 font-display text-3xl text-maroon">{valid.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted uppercase">Total pembelian (lunas)</p><p className="mt-1 font-display text-3xl text-maroon">{formatRupiah(paid)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted uppercase">Alamat terakhir</p><p className="mt-1 text-sm">{c.address ?? "—"}</p></Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Riwayat pesanan" />
        <ul className="divide-y divide-line">
          {c.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/pesanan/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-cream-100">
                <div>
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-muted">{formatDateTime(o.createdAt)} · {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatRupiah(o.total)}</span>
                  <Badge tone={PAYMENT_STATUS_TONE[o.payment!.status]}>{PAYMENT_STATUS_LABEL[o.payment!.status]}</Badge>
                  <Badge tone={ORDER_STATUS_TONE[o.status]}>{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
