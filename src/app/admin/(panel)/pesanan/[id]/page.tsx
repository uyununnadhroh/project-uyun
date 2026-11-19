import { notFound } from "next/navigation";
import Link from "next/link";
import { Printer, ChevronLeft, MapPin, CalendarDays, Phone, User, StickyNote } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { OrderActions } from "@/components/admin/order-actions";
import { ProofReview } from "@/components/admin/proof-review";
import { WhatsAppLink } from "@/components/shop/whatsapp-button";
import { ADMIN_TRANSITIONS, FULFILLMENT_LABEL, ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, orderStatusLabel } from "@/lib/constants";
import { displayPhone, formatDateOnly, formatDateTime, formatRupiah } from "@/lib/utils";

export const metadata = { title: "Detail Pesanan" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { variants: { orderBy: { slotNumber: "asc" } } } },
      payment: { include: { proofs: { orderBy: { createdAt: "desc" }, include: { reviewedBy: { select: { name: true } } } }, verifiedBy: { select: { name: true } } } },
      histories: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
      customer: { select: { id: true, _count: { select: { orders: true } } } },
    },
  });
  if (!o) notFound();
  const p = o.payment!;
  const statusMsg = `Halo ${o.customerName}, update pesanan Hakuu Bakery ${o.orderNumber}: ${orderStatusLabel(o.status, o.fulfillmentMethod)}.`;
  const transitions = ADMIN_TRANSITIONS[o.status].filter((s) => !(s === "OUT_FOR_DELIVERY" && o.fulfillmentMethod === "PICKUP"));

  return (
    <>
      <Link href="/admin/pesanan" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-maroon"><ChevronLeft className="h-4 w-4" /> Semua pesanan</Link>
      <PageHeader
        title={o.orderNumber}
        description={`Dibuat ${formatDateTime(o.createdAt)}`}
        action={
          <>
            <WhatsAppLink number={o.customerPhone} text={statusMsg} className="h-9 px-4">Chat customer</WhatsAppLink>
            <Link href={`/admin/invoice/${o.id}`} target="_blank" className={buttonClass("outline", "sm")}><Printer className="h-4 w-4" /> Cetak Invoice</Link>
          </>
        }
      />
      {o.archivedAt && <Alert tone="warning" className="mb-4">Pesanan ini telah diarsipkan pada {formatDateTime(o.archivedAt)}.</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
              <Badge tone={ORDER_STATUS_TONE[o.status]} className="px-3 py-1 text-sm">{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge>
              <Badge tone={PAYMENT_STATUS_TONE[p.status]} className="px-3 py-1 text-sm">{PAYMENT_METHOD_LABEL[p.method]} · {PAYMENT_STATUS_LABEL[p.status]}</Badge>
              {o.cancelReason && <p className="w-full text-sm text-red-700">Alasan batal: {o.cancelReason}</p>}
            </div>
            <div className="p-5">
              <OrderActions
                orderId={o.id}
                status={o.status}
                fulfillment={o.fulfillmentMethod}
                paymentMethod={p.method}
                paymentStatus={p.status}
                transitions={transitions}
                archived={!!o.archivedAt}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Produk dipesan" />
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted uppercase">
                <tr><th className="px-5 py-2">Produk</th><th className="px-3 py-2 text-right">Harga</th><th className="px-3 py-2 text-center">Qty</th><th className="px-5 py-2 text-right">Subtotal</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {o.items.map((it) => (
                  <tr key={it.id} className="align-top">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{it.productName}</p>
                      {it.variants.length > 0 && (
                        <ol className="mt-1.5 grid gap-1 sm:grid-cols-2">
                          {it.variants.map((v) => (
                            <li key={v.id} className="rounded-lg bg-cream-100 px-2.5 py-1 text-xs"><span className="text-muted">Pilihan {v.slotNumber}:</span> <b>{v.variantName}</b></li>
                          ))}
                        </ol>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(it.unitPrice)}</td>
                    <td className="px-3 py-3 text-center">{it.quantity}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatRupiah(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line text-sm">
                <tr><td colSpan={3} className="px-5 pt-3 text-right text-muted">Subtotal</td><td className="px-5 pt-3 text-right">{formatRupiah(o.subtotal)}</td></tr>
                <tr><td colSpan={3} className="px-5 text-right text-muted">Ongkos kirim</td><td className="px-5 text-right">{formatRupiah(o.deliveryFee)}</td></tr>
                <tr><td colSpan={3} className="px-5 pb-4 text-right font-bold">Total</td><td className="px-5 pb-4 text-right text-lg font-bold text-maroon">{formatRupiah(o.total)}</td></tr>
              </tfoot>
            </table>
          </Card>

          {p.method === "TRANSFER" && (
            <Card>
              <CardHeader title="Pembayaran transfer" description={`Ke ${p.bankName} ${p.bankAccountNumber} a.n. ${p.bankAccountHolder}${p.deadline ? ` · batas ${formatDateTime(p.deadline)}` : ""}`} />
              <div className="space-y-4 p-5">
                {p.proofs.length === 0 && <p className="text-sm text-muted">Customer belum mengunggah bukti transfer.</p>}
                {p.proofs.map((pr) => (
                  <ProofReview
                    key={pr.id}
                    proof={{
                      id: pr.id, url: `/api/files/${pr.filePath}`, createdAt: pr.createdAt.toISOString(), ocrStatus: pr.ocrStatus, ocrAmount: pr.ocrAmount, ocrDate: pr.ocrDate,
                      ocrSenderName: pr.ocrSenderName, ocrNote: pr.ocrNote, ocrText: pr.ocrText, reviewStatus: pr.reviewStatus, rejectionReason: pr.rejectionReason,
                      reviewedBy: pr.reviewedBy?.name ?? null, reviewedAt: pr.reviewedAt?.toISOString() ?? null,
                    }}
                    expected={p.amount}
                    canReview={pr.reviewStatus === "PENDING" && p.status === "WAITING_VERIFICATION" && o.status !== "CANCELLED"}
                  />
                ))}
                {p.paidAt && <p className="text-sm text-emerald-700">Lunas {formatDateTime(p.paidAt)}{p.verifiedBy && ` · diverifikasi oleh ${p.verifiedBy.name}`}</p>}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" action={<Link href={`/admin/pelanggan/${o.customer.id}`} className="text-xs font-semibold text-maroon hover:underline">{o.customer._count.orders} pesanan →</Link>} />
            <div className="space-y-2.5 p-5 text-sm">
              <p className="flex gap-2"><User className="h-4 w-4 text-muted" /> {o.customerName}</p>
              <p className="flex gap-2"><Phone className="h-4 w-4 text-muted" /> {displayPhone(o.customerPhone)}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title={FULFILLMENT_LABEL[o.fulfillmentMethod]} />
            <div className="space-y-2.5 p-5 text-sm">
              <p className="flex gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-muted" /> {formatDateOnly(o.scheduledDate)}, {o.scheduledTime}</p>
              {o.fulfillmentMethod === "DELIVERY" && (
                <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-muted" /> <span>{o.deliveryAddress}{o.addressLandmark && <><br /><span className="text-muted">Patokan: {o.addressLandmark}</span></>}</span></p>
              )}
              {o.notes && <p className="flex gap-2 rounded-xl bg-amber-50 p-3"><StickyNote className="h-4 w-4 shrink-0 text-amber-700" /> {o.notes}</p>}
              <p className="text-xs text-muted">Kapasitas produksi: {o.productionUnits} pcs</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Riwayat status" />
            <ol className="space-y-4 p-5">
              {o.histories.map((h) => (
                <li key={h.id} className="relative border-l-2 border-sand pl-4 text-sm">
                  <span className="absolute top-1 -left-[5px] h-2 w-2 rounded-full bg-maroon" />
                  <p className="font-semibold">{orderStatusLabel(h.toStatus, o.fulfillmentMethod)}</p>
                  {h.note && <p className="text-xs text-espresso/80">{h.note}</p>}
                  <p className="text-xs text-muted">{formatDateTime(h.createdAt)} · {h.changedBy?.name ?? (h.actor === "customer" ? "Customer" : "Sistem")}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
