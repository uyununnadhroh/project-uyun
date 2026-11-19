import "server-only";
import { prisma } from "./db";
import { OrderError } from "./order-service";
import { getSettings } from "./settings";
import { savePaymentProof } from "./storage";
import { ALLOWED_PROOF_TYPES } from "./constants";

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

  const saved = await savePaymentProof(file, ALLOWED_PROOF_TYPES);
  const s = await getSettings();

  const proof = await prisma.$transaction(async (tx) => {
    // Cegah unggah ganda bersamaan
    const res = await tx.payment.updateMany({
      where: { id: order.payment!.id, status: { in: ["UNPAID", "REJECTED"] } },
      data: { status: "WAITING_VERIFICATION" },
    });
    if (res.count !== 1) throw new OrderError("Status pembayaran sudah berubah. Muat ulang halaman.", undefined, 409);
    const p = await tx.paymentProof.create({
      data: {
        paymentId: order.payment!.id,
        filePath: saved.key,
        mimeType: saved.mimeType,
        fileSize: saved.size,
        ocrStatus: s.ocrEnabled ? "PENDING" : "NEEDS_REVIEW",
        ocrNote: s.ocrEnabled ? null : "OCR dinonaktifkan. Periksa manual.",
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: "AWAITING_VERIFICATION" } });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: "AWAITING_VERIFICATION", actor: "customer", note: "Customer mengunggah bukti transfer." },
    });
    return p;
  });
  return { proof, ocrEnabled: s.ocrEnabled };
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
