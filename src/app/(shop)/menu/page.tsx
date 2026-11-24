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

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function MenuPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const q = param(sp.q).trim().slice(0, 60);
  const sort = param(sp.urut);
  const bestSeller = param(sp.terlaris) === "1";
  const availableOnly = param(sp.tersedia) === "1";
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true },
  });
  const active = categories.find((c) => c.slug === param(sp.kategori));
  const category = active?.slug ?? "";
  const products = await getCatalog({ q, category, sort, bestSeller, availableOnly });

  return (
    <div className="container-page pt-6 pb-10 sm:pt-10">
      <div className="max-w-2xl">
        <p className="eyebrow">Menu Hakuu</p>
        <h1 className="mt-3 text-4xl text-maroon sm:text-5xl">{active ? active.name : "Semua Menu"}</h1>
        <p className="mt-3 text-muted">Dipanggang dengan sepenuh hati. Pilih favoritmu, atau racik Paket Hemat sesuai selera.</p>
      </div>
      <CatalogFilters
        key={JSON.stringify([q, category, sort, bestSeller, availableOnly])}
        categories={categories}
        q={q}
        category={category}
        sort={sort}
        bestSeller={bestSeller}
        availableOnly={availableOnly}
      />
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
