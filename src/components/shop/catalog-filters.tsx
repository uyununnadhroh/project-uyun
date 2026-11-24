"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

type CatalogFiltersProps = {
  categories: { name: string; slug: string }[];
  q: string;
  category: string;
  sort: string;
  bestSeller: boolean;
  availableOnly: boolean;
};

export function CatalogFilters({ categories, q, category, sort, bestSeller, availableOnly }: CatalogFiltersProps) {
  return (
    <form action="/menu" method="get" role="search" className="sticky top-16 z-30 -mx-4 mt-8 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur sm:top-20 sm:mx-0 sm:rounded-2xl sm:border sm:bg-white">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            maxLength={60}
            placeholder="Cari roti, paket, rasa…"
            className="h-11 w-full rounded-full border border-line bg-white pr-4 pl-10 text-sm focus:border-caramel focus:ring-4 focus:ring-caramel/20 focus:outline-none"
            aria-label="Cari produk"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:contents">
          <Select name="kategori" defaultValue={category} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="rounded-full" aria-label="Kategori produk">
            <option value="">Semua Produk</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
          <Select name="urut" defaultValue={sort} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="rounded-full" aria-label="Urutkan">
            <option value="">Urutan default</option>
            <option value="price_asc">Harga termurah</option>
            <option value="price_desc">Harga termahal</option>
            <option value="bestseller">Terlaris</option>
            <option value="newest">Terbaru</option>
          </Select>
        </div>
        <Button type="submit">Cari</Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="terlaris" value="1" defaultChecked={bestSeller} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="accent-maroon" />
          Produk terlaris
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="tersedia" value="1" defaultChecked={availableOnly} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="accent-maroon" />
          Hanya yang tersedia
        </label>
      </div>
    </form>
  );
}
