import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCatalog } from "@/lib/catalog";
import { ProductCard } from "@/components/shop/product-card";
import { CatalogFilters } from "@/components/shop/catalog-filters";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Menu" };

type SP = Promise<Record<string, string | undefined>>;

export default async function MenuPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const category = sp.kategori ?? "";
  const sort = sp.urut ?? "";
  const bestSeller = sp.terlaris === "1";
  const availableOnly = sp.tersedia === "1";
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } }),
    getCatalog({ q, category, sort, bestSeller, availableOnly }),
  ]);
  const active = categories.find((c) => c.slug === category);

  return (
    <div className="container-page pt-6 pb-10 sm:pt-10">
      <div className="max-w-2xl">
        <p className="eyebrow">Menu Hakuu</p>
        <h1 className="mt-3 text-4xl text-maroon sm:text-5xl">{active ? active.name : "Semua Menu"}</h1>
        <p className="mt-3 text-muted">Dipanggang dengan sepenuh hati. Pilih favoritmu, atau racik Paket Hemat sesuai selera.</p>
      </div>
      <CatalogFilters categories={categories} />
      <p className="mt-6 text-sm text-muted">
        {products.length} produk{q && <> untuk “<span className="font-semibold text-espresso">{q}</span>”</>}
      </p>
      {products.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          icon={<SearchX className="h-6 w-6" />}
          title="Produk tidak ditemukan"
          description={bestSeller ? "Belum ada data penjualan untuk menentukan produk terlaris." : "Coba kata kunci lain atau hapus filter."}
          action={<Link href="/menu" className={buttonClass("outline")}>Reset filter</Link>}
        />
      )}
    </div>
  );
}
