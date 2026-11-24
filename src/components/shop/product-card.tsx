import Link from "next/link";
import { Star } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { ProductImage } from "./product-image";
import { Badge } from "@/components/ui/badge";
import { QuickAdd } from "./quick-add";

export type CardProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  finalPrice: number;
  type: "REGULAR" | "PACKAGE";
  packageSize: number | null;
  imageUrl: string | null;
  categoryName: string;
  inStock: boolean;
  isFeatured: boolean;
  sold?: number;
};

export function ProductCard({ p, priority }: { p: CardProduct; priority?: boolean }) {
  const discounted = p.finalPrice < p.price;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <Link href={`/menu/${p.slug}`} className="relative block aspect-[4/3.4] overflow-hidden bg-cream-100">
        <ProductImage src={p.imageUrl} alt={p.name} priority={priority} className="transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {p.type === "PACKAGE" && <Badge tone="maroon">Isi {p.packageSize} · Pilih Varian</Badge>}
          {discounted && <Badge tone="brand">Hemat {Math.round((1 - p.finalPrice / p.price) * 100)}%</Badge>}
        </div>
        {!p.inStock && (
          <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-[1px]">
            <span className="rounded-full bg-espresso px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-cream">Habis</span>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-caramel-dark">{p.categoryName}</p>
          {p.isFeatured && <Badge tone="maroon"><Star aria-hidden="true" className="size-3" /> Best Seller</Badge>}
        </div>
        <Link href={`/menu/${p.slug}`} className="mt-1">
          <h3 className="font-display text-lg leading-snug text-espresso transition group-hover:text-maroon">{p.name}</h3>
        </Link>
        {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            {discounted && <p className="text-xs text-muted line-through">{formatRupiah(p.price)}</p>}
            <p className="text-lg font-bold text-maroon">{formatRupiah(p.finalPrice)}</p>
          </div>
          <QuickAdd productId={p.id} name={p.name} slug={p.slug} isPackage={p.type === "PACKAGE"} disabled={!p.inStock} />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="skeleton aspect-[4/3.4]" />
      <div className="space-y-2.5 p-5">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="flex items-center justify-between pt-3">
          <div className="skeleton h-6 w-24 rounded" />
          <div className="skeleton h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
