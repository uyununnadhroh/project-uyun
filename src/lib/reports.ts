import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDaysYmd, startOfDayWIB, todayWIB } from "./utils";

/**
 * DEFINISI LAPORAN (konsisten di dashboard, laporan, dan export):
 * - Omzet           = total pesanan berstatus SELESAI dan pembayaran LUNAS, diakui pada tanggal selesai (completedAt).
 * - Pembayaran diterima = pembayaran berstatus LUNAS berdasarkan tanggal lunas (paidAt), termasuk pesanan yang belum selesai.
 * - Belum lunas     = pesanan aktif (tidak batal) yang dibuat pada periode dan pembayarannya belum LUNAS.
 * - Pesanan dibatalkan tidak pernah dihitung sebagai penjualan.
 * - Jumlah pesanan / dibatalkan dihitung berdasarkan tanggal pesanan dibuat (createdAt).
 */

export type Period = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export function resolvePeriod(period: Period, from?: string, to?: string) {
  const today = todayWIB();
  switch (period) {
    case "daily":
      return { from: from || today, to: from || today };
    case "weekly": {
      const d = new Date(`${today}T00:00:00Z`);
      const dow = (d.getUTCDay() + 6) % 7; // Senin = 0
      const start = addDaysYmd(today, -dow);
      return { from: start, to: addDaysYmd(start, 6) };
    }
    case "monthly":
      return { from: today.slice(0, 8) + "01", to: addDaysYmd(addMonths(today.slice(0, 8) + "01", 1), -1) };
    case "yearly":
      return { from: today.slice(0, 4) + "-01-01", to: today.slice(0, 4) + "-12-31" };
    default: {
      const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : today.slice(0, 8) + "01";
      const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
      return f <= t ? { from: f, to: t } : { from: t, to: f };
    }
  }
}

function addMonths(ymdStr: string, n: number) {
  const d = new Date(`${ymdStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function range(from: string, to: string) {
  return { gte: startOfDayWIB(from), lt: startOfDayWIB(addDaysYmd(to, 1)) };
}

const notArchived = { archivedAt: null };

export async function getReport(from: string, to: string, search = "") {
  const r = range(from, to);
  const completedWhere: Prisma.OrderWhereInput = { ...notArchived, status: "COMPLETED", completedAt: r, payment: { status: "PAID" } };

  const [ordersCreated, cancelled, completedAgg, byMethod, receivedAgg, unpaidAgg, soldItems, dailyRevenue, dailyOrders, products] = await Promise.all([
    prisma.order.count({ where: { ...notArchived, createdAt: r } }),
    prisma.order.count({ where: { ...notArchived, createdAt: r, status: "CANCELLED" } }),
    prisma.order.aggregate({ where: completedWhere, _sum: { total: true, deliveryFee: true }, _count: true }),
    prisma.payment.groupBy({ by: ["method"], where: { order: completedWhere }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "PAID", paidAt: r, order: notArchived }, _sum: { amount: true }, _count: true }),
    prisma.order.aggregate({
      where: { ...notArchived, createdAt: r, status: { not: "CANCELLED" }, payment: { status: { not: "PAID" } } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: completedWhere },
      _sum: { quantity: true, lineTotal: true },
    }),
    prisma.$queryRaw<{ day: string; revenue: bigint; orders: bigint }[]>`
      SELECT to_char(("completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o.total),0)::bigint AS revenue, COUNT(*)::bigint AS orders
      FROM orders o JOIN payments p ON p."orderId" = o.id
      WHERE o.status = 'COMPLETED' AND p.status = 'PAID' AND o."archivedAt" IS NULL
        AND o."completedAt" >= ${r.gte} AND o."completedAt" < ${r.lt}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: string; total: bigint; cancelled: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day,
             COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE status = 'CANCELLED')::bigint AS cancelled
      FROM orders WHERE "archivedAt" IS NULL AND "createdAt" >= ${r.gte} AND "createdAt" < ${r.lt}
      GROUP BY 1 ORDER BY 1`,
    prisma.product.findMany({ where: { deletedAt: null, isPublished: true }, select: { id: true, name: true } }),
  ]);

  // Gabungkan per produk (nama snapshot bisa berbeda bila produk diganti nama)
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const s of soldItems) {
    const key = s.productId ?? `deleted:${s.productName}`;
    const cur = productMap.get(key) ?? { name: s.productName, qty: 0, revenue: 0 };
    cur.qty += s._sum.quantity ?? 0;
    cur.revenue += s._sum.lineTotal ?? 0;
    productMap.set(key, cur);
  }
  for (const p of products) if (!productMap.has(p.id)) productMap.set(p.id, { name: p.name, qty: 0, revenue: 0 });
  const ranked = [...productMap.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const topProducts = ranked.filter((p) => p.qty > 0).slice(0, 10);
  const lowestProducts = [...ranked].sort((a, b) => a.qty - b.qty || a.revenue - b.revenue).slice(0, 5);

  // Isi hari kosong agar grafik kontinu (maks 92 hari; lebih dari itu tetap apa adanya)
  const revMap = new Map(dailyRevenue.map((d) => [d.day, Number(d.revenue)]));
  const ordMap = new Map(dailyOrders.map((d) => [d.day, { total: Number(d.total), cancelled: Number(d.cancelled) }]));
  const daily: { day: string; revenue: number; orders: number; cancelled: number }[] = [];
  let count = 0;
  for (let d = from; d <= to && count < 400; d = addDaysYmd(d, 1), count++) {
    daily.push({ day: d, revenue: revMap.get(d) ?? 0, orders: ordMap.get(d)?.total ?? 0, cancelled: ordMap.get(d)?.cancelled ?? 0 });
  }
  const monthlyMap = new Map<string, { revenue: number; orders: number }>();
  for (const d of daily) {
    const m = d.day.slice(0, 7);
    const cur = monthlyMap.get(m) ?? { revenue: 0, orders: 0 };
    cur.revenue += d.revenue;
    cur.orders += d.orders;
    monthlyMap.set(m, cur);
  }

  const transactions = await getTransactions(from, to, search);

  const method = (m: "CASH" | "TRANSFER") => byMethod.find((b) => b.method === m)?._sum.amount ?? 0;
  return {
    from,
    to,
    summary: {
      totalOrders: ordersCreated,
      cancelledOrders: cancelled,
      completedOrders: completedAgg._count,
      productsSold: [...productMap.values()].reduce((s, p) => s + p.qty, 0),
      revenue: completedAgg._sum.total ?? 0,
      deliveryFees: completedAgg._sum.deliveryFee ?? 0,
      revenueCash: method("CASH"),
      revenueTransfer: method("TRANSFER"),
      paymentsReceived: receivedAgg._sum.amount ?? 0,
      paymentsReceivedCount: receivedAgg._count,
      unpaidTotal: unpaidAgg._sum.total ?? 0,
      unpaidCount: unpaidAgg._count,
    },
    topProducts,
    lowestProducts,
    daily,
    monthly: [...monthlyMap.entries()].map(([month, v]) => ({ month, ...v })),
    transactions,
  };
}

export async function getTransactions(from: string, to: string, search = "", take = 1000) {
  const q = search.trim();
  return prisma.order.findMany({
    where: {
      ...notArchived,
      createdAt: range(from, to),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { customerPhone: { contains: q.replace(/^0/, "62") } },
              { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { items: { include: { variants: { orderBy: { slotNumber: "asc" } } } }, payment: true },
  });
}

export type ReportData = Awaited<ReturnType<typeof getReport>>;

export async function getDashboard() {
  const today = todayWIB();
  const monthStart = today.slice(0, 8) + "01";
  const rToday = range(today, today);
  const rMonth = range(monthStart, today);
  const completedToday = { ...notArchived, status: "COMPLETED" as const, completedAt: rToday, payment: { status: "PAID" as const } };
  const completedMonth = { ...notArchived, status: "COMPLETED" as const, completedAt: rMonth, payment: { status: "PAID" as const } };

  const [revToday, ordersTodayAgg, ordersMonth, revMonth, statusGroups, waitingProofs, last30, top] = await Promise.all([
    prisma.order.aggregate({ where: completedToday, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...notArchived, createdAt: rToday, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { ...notArchived, createdAt: rMonth } }),
    prisma.order.aggregate({ where: completedMonth, _sum: { total: true } }),
    prisma.order.groupBy({ by: ["status"], where: notArchived, _count: true }),
    prisma.paymentProof.count({ where: { reviewStatus: "PENDING", payment: { status: "WAITING_VERIFICATION" } } }),
    getReport(addDaysYmd(today, -29), today).then((r) => r.daily),
    prisma.orderItem.groupBy({
      by: ["productName"],
      where: { order: { ...notArchived, status: "COMPLETED", completedAt: range(addDaysYmd(today, -29), today), payment: { status: "PAID" } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
  ]);

  const monthly = await prisma.$queryRaw<{ month: string; revenue: bigint }[]>`
    SELECT to_char(("completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS month, COALESCE(SUM(o.total),0)::bigint AS revenue
    FROM orders o JOIN payments p ON p."orderId" = o.id
    WHERE o.status='COMPLETED' AND p.status='PAID' AND o."archivedAt" IS NULL
      AND o."completedAt" >= ${startOfDayWIB(addMonths(monthStart, -11))}
    GROUP BY 1 ORDER BY 1`;
  const monthlyFilled: { month: string; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = addMonths(monthStart, -i).slice(0, 7);
    monthlyFilled.push({ month: m, revenue: Number(monthly.find((x) => x.month === m)?.revenue ?? 0) });
  }

  const statusCount = Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) as Record<string, number>;
  return {
    revenueToday: revToday._sum.total ?? 0,
    ordersToday: ordersTodayAgg._count,
    orderValueToday: ordersTodayAgg._sum.total ?? 0,
    ordersMonth,
    revenueMonth: revMonth._sum.total ?? 0,
    statusCount,
    waitingProofs,
    daily: last30,
    monthly: monthlyFilled,
    topProducts: top.map((t) => ({ name: t.productName, qty: t._sum.quantity ?? 0 })),
  };
}

export type ReportParams = { periode?: string; tanggal?: string; dari?: string; sampai?: string; q?: string };

export const PERIOD_LABEL: Record<Period, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan", yearly: "Tahunan", custom: "Rentang tanggal" };

export function parseReportParams(sp: ReportParams) {
  const period = (["daily", "weekly", "monthly", "yearly", "custom"].includes(sp.periode ?? "") ? sp.periode : "monthly") as Period;
  const r = period === "daily" ? resolvePeriod("daily", sp.tanggal) : resolvePeriod(period, sp.dari, sp.sampai);
  return { period, ...r, q: (sp.q ?? "").slice(0, 60) };
}
