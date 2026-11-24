import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { effectivePrice } from "./utils";
import type { CardProduct } from "@/components/shop/product-card";

export const publicProductWhere: Prisma.ProductWhereInput = { deletedAt: null, isPublished: true, category: { isActive: true } };

const include = { category: true, images: { orderBy: { sortOrder: "asc" as const }, take: 1 } };
type P = Prisma.ProductGetPayload<{ include: typeof include }>;

export function inStock(p: { isAvailable: boolean; trackStock: boolean; stock: number | null }) {
  return p.isAvailable && (!p.trackStock || (p.stock ?? 0) > 0);
}

export function toCard(p: P, sold = 0): CardProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    finalPrice: effectivePrice(p),
    type: p.type,
    packageSize: p.packageSize,
    imageUrl: p.images[0]?.url ?? null,
    categoryName: p.category.name,
    inStock: inStock(p),
    isFeatured: p.isFeatured,
    sold,
  };
}

/** Jumlah terjual per produk dari pesanan yang tidak dibatalkan */
export async function soldCounts() {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { status: { not: "CANCELLED" }, archivedAt: null } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId!, r._sum.quantity ?? 0]));
}

export async function getCatalog(opts: { q?: string; category?: string; sort?: string; bestSeller?: boolean; availableOnly?: boolean }) {
  const where: Prisma.ProductWhereInput = { ...publicProductWhere };
  if (opts.q) where.OR = [{ name: { contains: opts.q, mode: "insensitive" } }, { description: { contains: opts.q, mode: "insensitive" } }];
  if (opts.category) where.category = { slug: opts.category, isActive: true };
  if (opts.availableOnly) where.isAvailable = true;
  const [products, sold] = await Promise.all([prisma.product.findMany({ where, include, orderBy: [{ createdAt: "asc" }] }), soldCounts()]);
  let cards = products.map((p) => toCard(p, sold.get(p.id) ?? 0));
  if (opts.availableOnly) cards = cards.filter((c) => c.inStock);
  if (opts.bestSeller) cards = cards.filter((c) => (c.sold ?? 0) > 0).sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0));
  if (opts.sort === "price_asc") cards.sort((a, b) => a.finalPrice - b.finalPrice);
  else if (opts.sort === "price_desc") cards.sort((a, b) => b.finalPrice - a.finalPrice);
  else if (opts.sort === "bestseller") cards.sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0));
  else if (opts.sort === "newest") cards.reverse();
  return cards;
}

/** Best seller: berdasarkan data penjualan; bila belum ada penjualan gunakan produk unggulan pilihan admin. */
export async function getBestSellers(limit = 4) {
  const [products, sold] = await Promise.all([prisma.product.findMany({ where: publicProductWhere, include }), soldCounts()]);
  const cards = products.map((p) => toCard(p, sold.get(p.id) ?? 0));
  cards.sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0) || Number(b.isFeatured) - Number(a.isFeatured));
  const withSales = cards.filter((c) => (c.sold ?? 0) > 0 || c.isFeatured);
  return (withSales.length ? withSales : cards).slice(0, limit);
}
