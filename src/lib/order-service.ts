import "server-only";
import crypto from "crypto";
import { Prisma, type OrderStatus, type ProductType } from "@prisma/client";
import { prisma } from "./db";
import { getSettings, type StoreSettings } from "./settings";
import { ACTIVE_STATUSES, ADMIN_TRANSITIONS, ORDER_STATUS_LABEL } from "./constants";
import { addDaysYmd, dateOnly, effectivePrice, normalizePhone, todayWIB, ymd } from "./utils";
import type { CartItemInput, CheckoutInput } from "./validation";

export class OrderError extends Error {
  constructor(message: string, public field?: string, public status = 400) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

// ───────────────────────────── Pricing (server-side only) ─────────────────────────────

export type PricedLine = {
  key: string;
  productId: string;
  productName: string;
  productSlug: string;
  productType: ProductType;
  imageUrl: string | null;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  packageSize: number | null;
  variants: { slotNumber: number; variantId: string; variantName: string }[];
  units: number; // kontribusi ke kapasitas produksi (pcs)
  trackStock: boolean;
  stock: number | null;
  error: string | null; // bila ada masalah (habis, varian tidak valid, dll.)
};

const productInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  packageOptions: { include: { variant: true } },
};

/**
 * Hitung ulang keranjang dari database. Harga dari browser TIDAK pernah dipakai.
 */
export async function priceCart(items: CartItemInput[], db: Tx | typeof prisma = prisma) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: productInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Agregasi kebutuhan stok per produk (satu produk bisa muncul di beberapa baris dengan varian berbeda)
  const qtyPerProduct = new Map<string, number>();
  for (const it of items) qtyPerProduct.set(it.productId, (qtyPerProduct.get(it.productId) ?? 0) + it.quantity);

  const lines: PricedLine[] = items.map((it) => {
    const p = byId.get(it.productId);
    if (!p) {
      return {
        key: `${it.productId}:${(it.variants ?? []).join(",")}`,
        productId: it.productId,
        productName: "Produk tidak tersedia",
        productSlug: "",
        productType: "REGULAR",
        imageUrl: null,
        unitPrice: 0,
        originalPrice: 0,
        quantity: it.quantity,
        lineTotal: 0,
        packageSize: null,
        variants: [],
        units: 0,
        trackStock: false,
        stock: null,
        error: "Produk sudah tidak tersedia. Hapus dari keranjang.",
      };
    }
    const unitPrice = effectivePrice(p);
    let error: string | null = null;
    if (!p.isPublished) error = "Produk sedang tidak dijual.";
    else if (!p.isAvailable) error = "Produk sedang habis.";
    else if (p.trackStock && (p.stock ?? 0) < (qtyPerProduct.get(p.id) ?? 0))
      error = (p.stock ?? 0) <= 0 ? "Stok produk habis." : `Stok tersisa ${p.stock} pcs.`;

    let variants: PricedLine["variants"] = [];
    if (p.type === "PACKAGE") {
      const size = p.packageSize ?? 0;
      const chosen = it.variants ?? [];
      const allowed = new Map(p.packageOptions.filter((o) => o.variant.isActive).map((o) => [o.variantId, o]));
      if (chosen.length !== size) error = error ?? `Pilih ${size} varian untuk paket ini.`;
      else {
        const counts = new Map<string, number>();
        for (const vid of chosen) counts.set(vid, (counts.get(vid) ?? 0) + 1);
        for (const [vid, count] of counts) {
          const opt = allowed.get(vid);
          if (!opt) {
            error = error ?? "Ada varian yang sudah tidak tersedia. Silakan pilih ulang.";
            break;
          }
          if (!p.allowDuplicateVariants && count > 1) {
            error = error ?? "Paket ini tidak mengizinkan varian yang sama dipilih lebih dari sekali.";
            break;
          }
          if (opt.maxPerPackage && count > opt.maxPerPackage) {
            error = error ?? `Varian ${opt.variant.name} maksimal ${opt.maxPerPackage}x per paket.`;
            break;
          }
        }
        variants = chosen.map((vid, i) => ({
          slotNumber: i + 1,
          variantId: vid,
          variantName: allowed.get(vid)?.variant.name ?? "?",
        }));
      }
    }

    return {
      key: `${p.id}:${(it.variants ?? []).join(",")}`,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      productType: p.type,
      imageUrl: p.images[0]?.url ?? null,
      unitPrice,
      originalPrice: p.price,
      quantity: it.quantity,
      lineTotal: unitPrice * it.quantity,
      packageSize: p.type === "PACKAGE" ? p.packageSize : null,
      variants,
      units: it.quantity * (p.type === "PACKAGE" ? p.packageSize ?? 1 : 1),
      trackStock: p.trackStock,
      stock: p.stock,
      error,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const units = lines.reduce((s, l) => s + l.units, 0);
  return { lines, subtotal, units, hasError: lines.some((l) => l.error) };
}

// ───────────────────────────── Kapasitas produksi ─────────────────────────────

export type DayAvailability = {
  date: string;
  capacity: number | null; // null = tanpa batas
  used: number;
  remaining: number | null;
  closed: boolean;
  reason: string | null;
};

async function usedUnits(db: Tx | typeof prisma, from: string, to: string) {
  const rows = await db.order.groupBy({
    by: ["scheduledDate"],
    where: {
      scheduledDate: { gte: dateOnly(from), lte: dateOnly(to) },
      status: { in: [...ACTIVE_STATUSES, "COMPLETED"] },
      archivedAt: null,
    },
    _sum: { productionUnits: true },
  });
  return new Map(rows.map((r) => [ymd(r.scheduledDate), r._sum.productionUnits ?? 0]));
}

export async function getAvailability(from: string, to: string, settings?: StoreSettings, db: Tx | typeof prisma = prisma) {
  const s = settings ?? (await getSettings());
  const [overrides, used] = await Promise.all([
    db.dailyProductionCapacity.findMany({ where: { date: { gte: dateOnly(from), lte: dateOnly(to) } } }),
    usedUnits(db, from, to),
  ]);
  const ov = new Map(overrides.map((o) => [ymd(o.date), o]));
  const days: DayAvailability[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) {
    const o = ov.get(d);
    const weekday = dateOnly(d).getUTCDay();
    const u = used.get(d) ?? 0;
    let closed = false;
    let reason: string | null = null;
    if (o?.isClosed) {
      closed = true;
      reason = o.note || "Toko tutup";
    } else if (!o && s.closedWeekdays.includes(weekday)) {
      closed = true;
      reason = "Toko tutup";
    }
    const capacity = o ? o.capacity : s.defaultDailyCapacity > 0 ? s.defaultDailyCapacity : null;
    days.push({ date: d, capacity, used: u, remaining: capacity == null ? null : Math.max(0, capacity - u), closed, reason });
  }
  return days;
}

export function orderWindow(s: StoreSettings) {
  const from = todayWIB(s.minLeadDays);
  const to = todayWIB(Math.max(s.minLeadDays, s.maxAdvanceDays));
  return { from, to };
}

// ───────────────────────────── Order number ─────────────────────────────

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateOrderNumber() {
  const date = todayWIB().replace(/-/g, "").slice(2);
  const bytes = crypto.randomBytes(5);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `HKU-${date}-${code}`;
}

// ───────────────────────────── Create order ─────────────────────────────

export async function createOrder(input: CheckoutInput) {
  const s = await getSettings();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new OrderError("Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxxx", "phone");

  if (input.fulfillmentMethod === "PICKUP" && !s.pickupEnabled) throw new OrderError("Pick up sedang tidak tersedia.", "fulfillmentMethod");
  if (input.fulfillmentMethod === "DELIVERY" && !s.deliveryEnabled) throw new OrderError("Delivery sedang tidak tersedia.", "fulfillmentMethod");
  if (input.paymentMethod === "CASH" && !s.cashEnabled) throw new OrderError("Pembayaran cash sedang tidak tersedia.", "paymentMethod");
  if (input.paymentMethod === "TRANSFER" && !s.transferEnabled) throw new OrderError("Pembayaran transfer sedang tidak tersedia.", "paymentMethod");
  if (!s.timeSlots.includes(input.scheduledTime)) throw new OrderError("Pilihan waktu tidak tersedia.", "scheduledTime");

  const { from, to } = orderWindow(s);
  if (input.scheduledDate < from || input.scheduledDate > to)
    throw new OrderError(`Tanggal harus antara ${from} dan ${to}.`, "scheduledDate");

  let bank: { id: string; bankName: string; accountNumber: string; accountHolder: string } | null = null;
  if (input.paymentMethod === "TRANSFER") {
    bank = await prisma.bankAccount.findFirst({ where: { id: input.bankAccountId ?? "", isActive: true } });
    if (!bank) throw new OrderError("Rekening tujuan tidak tersedia. Pilih rekening lain.", "bankAccountId");
  }

  const isDelivery = input.fulfillmentMethod === "DELIVERY";
  const deliveryFee = isDelivery ? Math.max(0, s.deliveryFee) : 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Kunci per tanggal agar dua checkout bersamaan tidak melampaui kapasitas
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"capacity:" + input.scheduledDate}))`;

          const priced = await priceCart(input.items, tx);
          const bad = priced.lines.find((l) => l.error);
          if (bad) throw new OrderError(`${bad.productName}: ${bad.error}`, "items");

          const [day] = await getAvailability(input.scheduledDate, input.scheduledDate, s, tx);
          if (day.closed) throw new OrderError(`Tanggal ${input.scheduledDate} tidak menerima pesanan (${day.reason}). Pilih tanggal lain.`, "scheduledDate", 409);
          if (day.remaining != null && priced.units > day.remaining)
            throw new OrderError(
              day.remaining === 0
                ? "Kapasitas produksi untuk tanggal tersebut sudah penuh. Silakan pilih tanggal lain."
                : `Kapasitas tanggal tersebut tinggal ${day.remaining} pcs, pesananmu ${priced.units} pcs. Kurangi jumlah atau pilih tanggal lain.`,
              "scheduledDate",
              409,
            );

          // Kurangi stok secara atomik (hanya produk yang memakai sistem stok)
          const stockNeed = new Map<string, number>();
          for (const l of priced.lines) if (l.trackStock) stockNeed.set(l.productId, (stockNeed.get(l.productId) ?? 0) + l.quantity);
          for (const [productId, qty] of stockNeed) {
            const res = await tx.product.updateMany({ where: { id: productId, trackStock: true, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
            if (res.count !== 1) throw new OrderError("Stok salah satu produk tidak mencukupi. Muat ulang keranjang.", "items", 409);
          }

          const customer = await tx.customer.upsert({
            where: { phone },
            update: { name: input.customerName, ...(isDelivery ? { address: input.deliveryAddress } : {}) },
            create: { phone, name: input.customerName, address: isDelivery ? input.deliveryAddress : null },
          });

          const status: OrderStatus = input.paymentMethod === "CASH" ? "PENDING_CONFIRMATION" : "AWAITING_PAYMENT";
          const total = priced.subtotal + deliveryFee;

          const order = await tx.order.create({
            data: {
              orderNumber: generateOrderNumber(),
              customerId: customer.id,
              customerName: input.customerName,
              customerPhone: phone,
              fulfillmentMethod: input.fulfillmentMethod,
              deliveryAddress: isDelivery ? input.deliveryAddress : null,
              addressLandmark: isDelivery ? input.addressLandmark || null : null,
              scheduledDate: dateOnly(input.scheduledDate),
              scheduledTime: input.scheduledTime,
              notes: input.notes || null,
              subtotal: priced.subtotal,
              deliveryFee,
              total,
              productionUnits: priced.units,
              status,
              items: {
                create: priced.lines.map((l) => ({
                  productId: l.productId,
                  productName: l.productName,
                  productType: l.productType,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  lineTotal: l.lineTotal,
                  packageSize: l.packageSize,
                  variants: { create: l.variants.map((v) => ({ slotNumber: v.slotNumber, variantId: v.variantId, variantName: v.variantName })) },
                })),
              },
              payment: {
                create: {
                  method: input.paymentMethod,
                  amount: total,
                  status: "UNPAID",
                  ...(bank
                    ? {
                        bankAccountId: bank.id,
                        bankName: bank.bankName,
                        bankAccountNumber: bank.accountNumber,
                        bankAccountHolder: bank.accountHolder,
                        deadline: new Date(Date.now() + s.paymentDeadlineHours * 3600_000),
                      }
                    : {}),
                },
              },
              histories: {
                create: {
                  toStatus: status,
                  actor: "customer",
                  note: input.paymentMethod === "CASH" ? "Pesanan dibuat (bayar cash saat pengambilan/penerimaan)." : "Pesanan dibuat, menunggu transfer.",
                },
              },
            },
          });
          return order;
        },
        { timeout: 15000 },
      );
    } catch (e) {
      // Tabrakan nomor pesanan (sangat jarang) -> ulangi
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  throw new OrderError("Gagal membuat pesanan, coba lagi.");
}

// ───────────────────────────── Status changes ─────────────────────────────

async function restoreStock(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId, productId: { not: null } }, include: { product: true } });
  for (const it of items) {
    if (it.product?.trackStock) await tx.product.update({ where: { id: it.product.id }, data: { stock: { increment: it.quantity } } });
  }
}

export async function changeOrderStatus(opts: {
  orderId: string;
  to: OrderStatus;
  adminId: string;
  note?: string;
  markPaid?: boolean;
}) {
  const { orderId, to, adminId } = opts;
  const note = opts.note?.trim() || null;
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order || order.archivedAt) throw new OrderError("Pesanan tidak ditemukan.", undefined, 404);
    const allowed = ADMIN_TRANSITIONS[order.status];
    if (!allowed.includes(to))
      throw new OrderError(`Tidak dapat mengubah status dari "${ORDER_STATUS_LABEL[order.status]}" ke "${ORDER_STATUS_LABEL[to]}".`);
    const payment = order.payment!;

    if (to === "OUT_FOR_DELIVERY" && order.fulfillmentMethod !== "DELIVERY") throw new OrderError("Status Dalam Pengiriman hanya untuk pesanan delivery.");

    const data: Prisma.OrderUpdateInput = { status: to };

    if (to === "CANCELLED") {
      if (!note || note.length < 5) throw new OrderError("Alasan pembatalan wajib diisi (min. 5 karakter).", "note");
      data.cancelReason = note;
      data.cancelledAt = new Date();
      await restoreStock(tx, order.id);
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: payment.status === "PAID" ? "REFUNDED" : "VOID" },
      });
      // Bukti yang belum diperiksa tidak lagi relevan
      await tx.paymentProof.updateMany({ where: { paymentId: payment.id, reviewStatus: "PENDING" }, data: { reviewStatus: "REJECTED", rejectionReason: "Pesanan dibatalkan", reviewedAt: new Date(), reviewedById: adminId } });
    }

    if (to === "COMPLETED") {
      if (payment.status !== "PAID") {
        if (opts.markPaid && payment.method === "CASH") {
          await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date(), verifiedById: adminId } });
        } else {
          throw new OrderError("Pesanan belum lunas. Tandai pembayaran sebagai lunas terlebih dahulu.");
        }
      }
      data.completedAt = new Date();
    }

    const updated = await tx.order.update({ where: { id: order.id }, data });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: to, note, actor: "admin", changedById: adminId },
    });
    if (to === "CANCELLED") {
      await tx.auditLog.create({
        data: { userId: adminId, action: "order.cancel", entityType: "order", entityId: order.id, reason: note, data: { orderNumber: order.orderNumber, paymentStatus: payment.status } },
      });
    }
    return updated;
  });
}

/** Tandai pembayaran cash sebagai Lunas */
export async function markCashPaid(orderId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order?.payment) throw new OrderError("Pesanan tidak ditemukan.", undefined, 404);
    if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
    if (order.payment.method !== "CASH") throw new OrderError("Pembayaran transfer harus melalui verifikasi bukti transfer.");
    if (order.payment.status === "PAID") throw new OrderError("Pembayaran sudah lunas.");
    await tx.payment.update({ where: { id: order.payment.id }, data: { status: "PAID", paidAt: new Date(), verifiedById: adminId } });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: order.status, actor: "admin", changedById: adminId, note: "Pembayaran cash diterima (Lunas)." },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: "payment.cash_paid", entityType: "order", entityId: order.id, data: { amount: order.payment.amount } } });
  });
}

/** Arsipkan pesanan (soft delete) — pesanan selesai tidak boleh diarsipkan; semua tercatat di audit log. */
export async function archiveOrder(orderId: string, adminId: string, reason: string) {
  if (!reason || reason.trim().length < 5) throw new OrderError("Alasan wajib diisi (min. 5 karakter).");
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) throw new OrderError("Pesanan tidak ditemukan.", undefined, 404);
    if (order.status !== "CANCELLED") throw new OrderError("Hanya pesanan yang sudah dibatalkan yang dapat diarsipkan. Pesanan selesai tidak dapat dihapus.");
    await tx.order.update({ where: { id: orderId }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: { userId: adminId, action: "order.archive", entityType: "order", entityId: orderId, reason: reason.trim(), data: { orderNumber: order.orderNumber, total: order.total } },
    });
  });
}

/**
 * Batalkan otomatis pesanan transfer yang melewati batas waktu pembayaran
 * dan tidak memiliki bukti transfer yang sedang menunggu pemeriksaan.
 */
export async function expireOverdueOrders() {
  const overdue = await prisma.order.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      archivedAt: null,
      payment: { method: "TRANSFER", status: { in: ["UNPAID", "REJECTED"] }, deadline: { lt: new Date() } },
    },
    select: { id: true },
    take: 100,
  });
  for (const o of overdue) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: o.id }, include: { payment: true } });
      if (!fresh || fresh.status !== "AWAITING_PAYMENT" || !fresh.payment || fresh.payment.status === "WAITING_VERIFICATION" || fresh.payment.status === "PAID") return;
      await restoreStock(tx, o.id);
      await tx.order.update({ where: { id: o.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Batas waktu pembayaran terlewati." } });
      await tx.payment.update({ where: { id: fresh.payment.id }, data: { status: "VOID" } });
      await tx.orderStatusHistory.create({ data: { orderId: o.id, fromStatus: "AWAITING_PAYMENT", toStatus: "CANCELLED", actor: "system", note: "Dibatalkan otomatis: batas waktu pembayaran terlewati." } });
    });
  }
  return overdue.length;
}
