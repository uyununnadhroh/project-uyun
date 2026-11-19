import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { displayPhone, formatDateOnly, formatDateTime, formatRupiah } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Invoice" };

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [o, s] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { items: { include: { variants: { orderBy: { slotNumber: "asc" } } } }, payment: true } }),
    getSettings(),
  ]);
  if (!o) notFound();
  return (
    <div className="min-h-dvh bg-white p-6 text-sm text-espresso print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-2xl justify-end"><PrintButton /></div>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between border-b-2 border-maroon pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-maroon.png" alt="Hakuu Bakery" className="h-11 w-auto" />
          <div className="text-right">
            <p className="font-display text-2xl text-maroon">INVOICE</p>
            <p className="font-mono">{o.orderNumber}</p>
            <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Dari</p>
            <p className="font-semibold">{s.storeName}</p>
            {s.address && <p className="whitespace-pre-line text-xs">{s.address}</p>}
            {s.whatsappNumber && <p className="text-xs">WA {displayPhone(s.whatsappNumber)}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Kepada</p>
            <p className="font-semibold">{o.customerName}</p>
            <p className="text-xs">{displayPhone(o.customerPhone)}</p>
            {o.deliveryAddress && <p className="text-xs">{o.deliveryAddress}{o.addressLandmark && ` (${o.addressLandmark})`}</p>}
          </div>
        </div>
        <p className="mt-4 text-xs">{FULFILLMENT_LABEL[o.fulfillmentMethod]} · {formatDateOnly(o.scheduledDate)}, {o.scheduledTime}</p>
        <table className="mt-5 w-full">
          <thead className="border-y border-line text-left text-xs uppercase">
            <tr><th className="py-2">Produk</th><th className="py-2 text-right">Harga</th><th className="py-2 text-center">Qty</th><th className="py-2 text-right">Jumlah</th></tr>
          </thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.id} className="border-b border-line align-top">
                <td className="py-2">
                  {it.productName}
                  {it.variants.length > 0 && <p className="text-xs text-muted">{it.variants.map((v) => `${v.slotNumber}. ${v.variantName}`).join(" · ")}</p>}
                </td>
                <td className="py-2 text-right">{formatRupiah(it.unitPrice)}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{formatRupiah(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-64 space-y-1">
          <p className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(o.subtotal)}</span></p>
          <p className="flex justify-between"><span>Ongkos kirim</span><span>{formatRupiah(o.deliveryFee)}</span></p>
          <p className="flex justify-between border-t border-maroon pt-1 text-base font-bold"><span>Total</span><span>{formatRupiah(o.total)}</span></p>
          <p className="flex justify-between text-xs"><span>Pembayaran</span><span>{PAYMENT_METHOD_LABEL[o.payment!.method]} — {PAYMENT_STATUS_LABEL[o.payment!.status]}</span></p>
        </div>
        {o.notes && <p className="mt-6 text-xs">Catatan: {o.notes}</p>}
        <p className="mt-10 text-center font-display text-maroon">Terima kasih telah berbelanja di Hakuu Bakery</p>
      </div>
    </div>
  );
}
