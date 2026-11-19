import "server-only";
import type { Prisma, OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABEL } from "./constants";
import { addDaysYmd, startOfDayWIB, todayWIB } from "./utils";
import { resolvePeriod } from "./reports";

export type OrderFilters = { q?: string; periode?: string; dari?: string; sampai?: string; status?: string; bayar?: string; terima?: string; statusBayar?: string; jadwal?: string };

export function buildOrderWhere(f: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { archivedAt: null };
  const today = todayWIB();
  if (f.periode === "hari") where.createdAt = { gte: startOfDayWIB(today), lt: startOfDayWIB(addDaysYmd(today, 1)) };
  else if (f.periode === "minggu" || f.periode === "bulan") {
    const r = resolvePeriod(f.periode === "minggu" ? "weekly" : "monthly");
    where.createdAt = { gte: startOfDayWIB(r.from), lt: startOfDayWIB(addDaysYmd(r.to, 1)) };
  } else if (f.periode === "custom" && (f.dari || f.sampai)) {
    const r = resolvePeriod("custom", f.dari, f.sampai);
    where.createdAt = { gte: startOfDayWIB(r.from), lt: startOfDayWIB(addDaysYmd(r.to, 1)) };
  }
  if (f.jadwal && /^\d{4}-\d{2}-\d{2}$/.test(f.jadwal)) where.scheduledDate = new Date(`${f.jadwal}T00:00:00Z`);
  if (f.status && f.status in ORDER_STATUS_LABEL) where.status = f.status as OrderStatus;
  if (f.terima === "PICKUP" || f.terima === "DELIVERY") where.fulfillmentMethod = f.terima;
  const pay: Prisma.PaymentWhereInput = {};
  if (f.bayar === "CASH" || f.bayar === "TRANSFER") pay.method = f.bayar;
  if (f.statusBayar && ["UNPAID", "WAITING_VERIFICATION", "REJECTED", "PAID", "VOID", "REFUNDED"].includes(f.statusBayar)) pay.status = f.statusBayar as never;
  if (Object.keys(pay).length) where.payment = pay;
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 4 ? [{ customerPhone: { contains: digits.replace(/^0/, "62") } }] : []),
      { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
    ];
  }
  return where;
}
