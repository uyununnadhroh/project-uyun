import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";

/** Data pesanan yang aman ditampilkan ke customer pemilik pesanan */
export async function getCustomerOrder(orderNumber: string) {
  const o = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { include: { variants: { orderBy: { slotNumber: "asc" } } } },
      payment: { include: { proofs: { orderBy: { createdAt: "desc" }, take: 5 } } },
      histories: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!o || o.archivedAt) return null;
  const s = await getSettings();
  const p = o.payment!;
  return {
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    fulfillmentMethod: o.fulfillmentMethod,
    deliveryAddress: o.deliveryAddress,
    addressLandmark: o.addressLandmark,
    scheduledDate: o.scheduledDate.toISOString().slice(0, 10),
    scheduledTime: o.scheduledTime,
    notes: o.notes,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    status: o.status,
    cancelReason: o.cancelReason,
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      productType: i.productType,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      variants: i.variants.map((v) => ({ slotNumber: v.slotNumber, variantName: v.variantName })),
    })),
    payment: {
      method: p.method,
      status: p.status,
      amount: p.amount,
      bankName: p.bankName,
      bankAccountNumber: p.bankAccountNumber,
      bankAccountHolder: p.bankAccountHolder,
      deadline: p.deadline?.toISOString() ?? null,
      paidAt: p.paidAt?.toISOString() ?? null,
      proofs: p.proofs.map((pr) => ({
        id: pr.id,
        createdAt: pr.createdAt.toISOString(),
        reviewStatus: pr.reviewStatus,
        rejectionReason: pr.rejectionReason,
        url: `/api/files/${pr.filePath}`,
      })),
    },
    histories: o.histories
      .filter((h) => h.fromStatus !== h.toStatus || h.note)
      .map((h) => ({ toStatus: h.toStatus, note: h.note, createdAt: h.createdAt.toISOString(), actor: h.actor })),
    store: { whatsappNumber: s.whatsappNumber, address: s.address, mapsUrl: s.mapsUrl, pickupInstructions: s.pickupInstructions, operatingHours: s.operatingHours },
    updatedAt: o.updatedAt.toISOString(),
  };
}
export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;
