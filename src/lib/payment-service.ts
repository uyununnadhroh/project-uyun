import "server-only";
import { prisma } from "./db";
import { OrderError } from "./order-service";
import { getSettings } from "./settings";
import { deletePaymentProof, savePaymentProof } from "./storage";

/** Customer mengunggah bukti transfer. */
export async function submitPaymentProof(orderNumber: string, file: File) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { payment: true } });
  if (!order || order.archivedAt || !order.payment) throw new OrderError("Pesanan tidak ditemukan.", undefined, 404);
  if (order.payment.method !== "TRANSFER") throw new OrderError("Pesanan ini menggunakan pembayaran cash.");
  if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
  if (order.payment.status === "PAID") throw new OrderError("Pembayaran sudah dikonfirmasi lunas.");
  if (order.payment.status === "WAITING_VERIFICATION") throw new OrderError("Bukti transfer sebelumnya sedang diperiksa admin.");
  if (order.payment.deadline && order.payment.deadline < new Date())
    throw new OrderError("Batas waktu pembayaran sudah terlewati. Hubungi Hakuu Bakery melalui WhatsApp.");

  const settings = await getSettings();
  const saved = await savePaymentProof(file);
  const paymentId = order.payment.id;

  try {
    const proof = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const payment = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ["UNPAID", "REJECTED"] }, OR: [{ deadline: null }, { deadline: { gte: now } }] },
        data: { status: "WAITING_VERIFICATION" },
      });
      if (payment.count !== 1) throw new OrderError("Status atau batas waktu pembayaran sudah berubah. Muat ulang halaman.", undefined, 409);
      const updatedOrder = await tx.order.updateMany({
        where: { id: order.id, archivedAt: null, status: "AWAITING_PAYMENT" },
        data: { status: "AWAITING_VERIFICATION" },
      });
      if (updatedOrder.count !== 1) throw new OrderError("Status pesanan sudah berubah. Muat ulang halaman.", undefined, 409);

      const proof = await tx.paymentProof.create({
        data: {
          paymentId,
          filePath: saved.key,
          mimeType: saved.mimeType,
          fileSize: saved.size,
          ocrStatus: settings.ocrEnabled ? "PENDING" : "NEEDS_REVIEW",
          ocrNote: settings.ocrEnabled ? null : "OCR dinonaktifkan. Periksa manual.",
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: "AWAITING_PAYMENT", toStatus: "AWAITING_VERIFICATION", actor: "customer", note: "Customer mengunggah bukti transfer." },
      });
      return proof;
    });
    return { proof, ocrEnabled: settings.ocrEnabled };
  } catch (error) {
    try {
      const stored = await prisma.paymentProof.findFirst({ where: { filePath: saved.key }, select: { id: true } });
      if (!stored) await deletePaymentProof(saved.key);
    } catch {
      console.error("[payment] gagal membersihkan bukti transfer yang belum terhubung");
    }
    throw error;
  }
}

export async function approveProof(proofId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const proof = await tx.paymentProof.findUnique({ where: { id: proofId }, include: { payment: { include: { order: true } } } });
    if (!proof) throw new OrderError("Bukti tidak ditemukan.", undefined, 404);
    if (proof.reviewStatus !== "PENDING") throw new OrderError("Bukti ini sudah diperiksa.");
    const { payment } = proof;
    const order = payment.order;
    if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
    const now = new Date();
    await tx.paymentProof.update({ where: { id: proofId }, data: { reviewStatus: "APPROVED", reviewedAt: now, reviewedById: adminId } });
    await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: now, verifiedById: adminId } });
    if (order.status === "AWAITING_VERIFICATION" || order.status === "AWAITING_PAYMENT") {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_CONFIRMED" } });
    }
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: "PAYMENT_CONFIRMED", actor: "admin", changedById: adminId, note: "Bukti transfer diverifikasi admin. Pembayaran Lunas." },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: "payment.approve", entityType: "payment_proof", entityId: proofId, data: { orderNumber: order.orderNumber, amount: payment.amount, ocrAmount: proof.ocrAmount } } });
  });
}

export async function rejectProof(proofId: string, adminId: string, reason: string) {
  const r = (reason || "").trim();
  if (r.length < 5) throw new OrderError("Alasan penolakan wajib diisi (min. 5 karakter).", "reason");
  const s = await getSettings();
  return prisma.$transaction(async (tx) => {
    const proof = await tx.paymentProof.findUnique({ where: { id: proofId }, include: { payment: { include: { order: true } } } });
    if (!proof) throw new OrderError("Bukti tidak ditemukan.", undefined, 404);
    if (proof.reviewStatus !== "PENDING") throw new OrderError("Bukti ini sudah diperiksa.");
    const { payment } = proof;
    const order = payment.order;
    const now = new Date();
    await tx.paymentProof.update({ where: { id: proofId }, data: { reviewStatus: "REJECTED", rejectionReason: r, reviewedAt: now, reviewedById: adminId } });
    // Beri waktu lagi kepada customer untuk mengunggah ulang
    const newDeadline = new Date(Math.max(payment.deadline?.getTime() ?? 0, now.getTime() + s.paymentDeadlineHours * 3600_000));
    await tx.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", deadline: newDeadline } });
    if (order.status === "AWAITING_VERIFICATION") {
      await tx.order.update({ where: { id: order.id }, data: { status: "AWAITING_PAYMENT" } });
    }
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: "AWAITING_PAYMENT", actor: "admin", changedById: adminId, note: `Bukti transfer ditolak: ${r}` },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: "payment.reject", entityType: "payment_proof", entityId: proofId, reason: r, data: { orderNumber: order.orderNumber } } });
  });
}
