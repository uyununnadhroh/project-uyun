"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/input";

export function CatalogFilters({ categories }: { categories: { name: string; slug: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q.trim()) update({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const cat = sp.get("kategori") ?? "";
  const chip = (activeState: boolean) =>
    cn("whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition", activeState ? "border-maroon bg-maroon text-cream" : "border-line bg-white text-espresso hover:border-caramel");

  return (
    <div className="sticky top-16 z-30 -mx-4 mt-8 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur sm:top-20 sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari roti, paket, rasa…"
            className="h-11 w-full rounded-full border border-line bg-white pr-10 pl-10 text-sm focus:border-caramel focus:ring-4 focus:ring-caramel/20 focus:outline-none"
            aria-label="Cari produk"
          />
          {pending ? (
            <Loader2 className="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
          ) : q ? (
            <button onClick={() => setQ("")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-cream-200" aria-label="Hapus pencarian">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Select value={sp.get("urut") ?? ""} onChange={(e) => update({ urut: e.target.value || null })} className="h-11 rounded-full lg:w-48" aria-label="Urutkan">
            <option value="">Urutkan: Default</option>
            <option value="price_asc">Harga termurah</option>
            <option value="price_desc">Harga termahal</option>
            <option value="bestseller">Terlaris</option>
            <option value="newest">Terbaru</option>
          </Select>
        </div>
      </div>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <button className={chip(!cat)} onClick={() => update({ kategori: null })}>Semua</button>
        {categories.map((c) => (
          <button key={c.slug} className={chip(cat === c.slug)} onClick={() => update({ kategori: c.slug })}>
            {c.name}
          </button>
        ))}
        <span className="mx-1 my-1 w-px shrink-0 bg-line" />
        <button className={chip(sp.get("terlaris") === "1")} onClick={() => update({ terlaris: sp.get("terlaris") === "1" ? null : "1" })}>
          ★ Produk terlaris
        </button>
        <button className={chip(sp.get("tersedia") === "1")} onClick={() => update({ tersedia: sp.get("tersedia") === "1" ? null : "1" })}>
          Hanya yang tersedia
        </button>
      </div>
    </div>
  );
}
