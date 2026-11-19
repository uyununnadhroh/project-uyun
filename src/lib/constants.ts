import type { OrderStatus, PaymentStatus, PaymentMethod, FulfillmentMethod, OcrStatus } from "@prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Menunggu Konfirmasi",
  AWAITING_PAYMENT: "Menunggu Pembayaran",
  AWAITING_VERIFICATION: "Menunggu Verifikasi Pembayaran",
  PAYMENT_CONFIRMED: "Pembayaran Dikonfirmasi",
  SCHEDULED: "Masuk Jadwal Produksi",
  IN_PRODUCTION: "Sedang Diproduksi",
  PACKING: "Packing",
  READY: "Siap Diambil / Siap Diantar",
  OUT_FOR_DELIVERY: "Dalam Pengiriman",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export function orderStatusLabel(status: OrderStatus, fulfillment?: FulfillmentMethod) {
  if (status === "READY" && fulfillment) return fulfillment === "PICKUP" ? "Siap Diambil" : "Siap Diantar";
  return ORDER_STATUS_LABEL[status];
}

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "amber",
  AWAITING_PAYMENT: "amber",
  AWAITING_VERIFICATION: "blue",
  PAYMENT_CONFIRMED: "green",
  SCHEDULED: "violet",
  IN_PRODUCTION: "violet",
  PACKING: "violet",
  READY: "teal",
  OUT_FOR_DELIVERY: "teal",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Belum Dibayar",
  WAITING_VERIFICATION: "Menunggu Verifikasi",
  REJECTED: "Bukti Ditolak",
  PAID: "Lunas",
  VOID: "Dibatalkan",
  REFUNDED: "Dikembalikan",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  UNPAID: "amber",
  WAITING_VERIFICATION: "blue",
  REJECTED: "red",
  PAID: "green",
  VOID: "gray",
  REFUNDED: "gray",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer Bank",
};

export const FULFILLMENT_LABEL: Record<FulfillmentMethod, string> = {
  PICKUP: "Pick Up",
  DELIVERY: "Delivery",
};

export const OCR_STATUS_LABEL: Record<OcrStatus, string> = {
  PENDING: "Sedang dibaca",
  MATCH: "Nominal cocok",
  NEEDS_REVIEW: "Perlu Pemeriksaan",
  FAILED: "Perlu Pemeriksaan (OCR gagal)",
};

/** Urutan tahapan untuk timeline pelacakan */
export const TRACKING_STEPS: OrderStatus[] = [
  "PENDING_CONFIRMATION",
  "AWAITING_PAYMENT",
  "AWAITING_VERIFICATION",
  "PAYMENT_CONFIRMED",
  "SCHEDULED",
  "IN_PRODUCTION",
  "PACKING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
];

/**
 * Transisi status pesanan yang diizinkan untuk admin.
 * Status pembayaran (AWAITING_VERIFICATION / PAYMENT_CONFIRMED) diatur lewat alur verifikasi,
 * namun admin tetap dapat melanjutkan ke produksi setelah pembayaran beres.
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONFIRMATION: ["SCHEDULED", "CANCELLED"],
  AWAITING_PAYMENT: ["CANCELLED"],
  AWAITING_VERIFICATION: ["CANCELLED"],
  PAYMENT_CONFIRMED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["PACKING", "CANCELLED"],
  PACKING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Status yang menempati kapasitas produksi & stok (pesanan aktif) */
export const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING_CONFIRMATION",
  "AWAITING_PAYMENT",
  "AWAITING_VERIFICATION",
  "PAYMENT_CONFIRMED",
  "SCHEDULED",
  "IN_PRODUCTION",
  "PACKING",
  "READY",
  "OUT_FOR_DELIVERY",
];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png"];
