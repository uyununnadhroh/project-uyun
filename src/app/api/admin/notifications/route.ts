import { prisma } from "@/lib/db";
import { adminOrNull } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Penghitung untuk badge sidebar & notifikasi admin (di-poll oleh dashboard). */
export async function GET() {
  if (!(await adminOrNull())) return fail("Unauthorized", 401);
  const [pendingConfirm, waitingProofs, latestOrder, latestProof] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING_CONFIRMATION", archivedAt: null } }),
    prisma.paymentProof.count({ where: { reviewStatus: "PENDING", payment: { status: "WAITING_VERIFICATION", order: { status: { not: "CANCELLED" } } } } }),
    prisma.order.findFirst({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, customerName: true, createdAt: true } }),
    prisma.paymentProof.findFirst({ where: { reviewStatus: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, payment: { select: { order: { select: { orderNumber: true } } } } } }),
  ]);
  return ok({
    pendingConfirm,
    waitingProofs,
    latestOrder: latestOrder && { id: latestOrder.id, orderNumber: latestOrder.orderNumber, customerName: latestOrder.customerName, at: latestOrder.createdAt },
    latestProof: latestProof && { id: latestProof.id, orderNumber: latestProof.payment.order.orderNumber, at: latestProof.createdAt },
  });
}
