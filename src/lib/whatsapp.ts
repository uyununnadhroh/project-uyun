import { formatRupiah, formatDateOnly } from "./utils";
import { FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL } from "./constants";

/**
 * WhatsApp Click-to-Chat (wa.me). Tautan ini HANYA membuka WhatsApp dengan pesan terisi;
 * pesan baru benar-benar terkirim bila customer menekan tombol kirim di WhatsApp.
 * Pengiriman otomatis membutuhkan WhatsApp Business (Cloud) API — lihat docs/WHATSAPP.md.
 */
export function waLink(number: string, text?: string) {
  const n = (number || "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

type SummaryOrder = {
  orderNumber: string;
  customerName: string;
  fulfillmentMethod: keyof typeof FULFILLMENT_LABEL;
  scheduledDate: Date | string;
  scheduledTime: string;
  deliveryAddress?: string | null;
  total: number;
  deliveryFee: number;
  paymentMethod: keyof typeof PAYMENT_METHOD_LABEL;
  items: { productName: string; quantity: number; lineTotal: number; variants: { slotNumber: number; variantName: string }[] }[];
};

export function orderSummaryText(o: SummaryOrder, trackUrl?: string) {
  const lines = [
    `Halo Hakuu Bakery, saya ingin konfirmasi pesanan berikut:`,
    ``,
    `*No. Pesanan:* ${o.orderNumber}`,
    `*Nama:* ${o.customerName}`,
    `*Metode:* ${FULFILLMENT_LABEL[o.fulfillmentMethod]} — ${formatDateOnly(o.scheduledDate)}, ${o.scheduledTime}`,
  ];
  if (o.fulfillmentMethod === "DELIVERY" && o.deliveryAddress) lines.push(`*Alamat:* ${o.deliveryAddress}`);
  lines.push(``, `*Pesanan:*`);
  for (const it of o.items) {
    lines.push(`• ${it.productName} x${it.quantity} — ${formatRupiah(it.lineTotal)}`);
    if (it.variants.length) lines.push(`   (${it.variants.map((v) => v.variantName).join(", ")})`);
  }
  if (o.deliveryFee > 0) lines.push(`• Ongkir — ${formatRupiah(o.deliveryFee)}`);
  lines.push(``, `*Total:* ${formatRupiah(o.total)}`, `*Pembayaran:* ${PAYMENT_METHOD_LABEL[o.paymentMethod]}`);
  if (trackUrl) lines.push(``, `Lacak pesanan: ${trackUrl}`);
  return lines.join("\n");
}
