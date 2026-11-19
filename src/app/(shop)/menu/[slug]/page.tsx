import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { publicProductWhere, inStock, getCatalog } from "@/lib/catalog";
import { effectivePrice, formatRupiah } from "@/lib/utils";
import { ProductGallery } from "@/components/shop/product-gallery";
import { AddToCart } from "@/components/shop/add-to-cart";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/shop/product-card";

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  return prisma.product.findFirst({
    where: { ...publicProductWhere, slug },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      packageOptions: { where: { variant: { isActive: true } }, include: { variant: true }, orderBy: { variant: { sortOrder: "asc" } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load((await params).slug);
  return { title: p?.name ?? "Produk", description: p?.description?.slice(0, 150) };
}

export default async function ProductPage({ params }: { params: Params }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const price = effectivePrice(p);
  const available = inStock(p);
  const related = (await getCatalog({ category: p.category.slug })).filter((r) => r.id !== p.id).slice(0, 4);

  return (
    <div className="container-page pt-4 pb-10 sm:pt-8">
      <Link href="/menu" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-maroon">
        <ChevronLeft className="h-4 w-4" /> Kembali ke menu
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={p.images.map((i) => i.url)} name={p.name} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{p.category.name}</Badge>
            {p.type === "PACKAGE" && <Badge tone="maroon">Paket isi {p.packageSize}</Badge>}
            {available ? <Badge tone="green">Tersedia</Badge> : <Badge tone="red">Habis</Badge>}
            {available && p.trackStock && (p.stock ?? 0) <= 10 && <Badge tone="amber">Sisa {p.stock}</Badge>}
          </div>
          <h1 className="mt-4 text-4xl leading-tight text-maroon sm:text-5xl">{p.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <p className="text-3xl font-bold text-maroon">{formatRupiah(price)}</p>
            {price < p.price && <p className="text-lg text-muted line-through">{formatRupiah(p.price)}</p>}
          </div>
          {p.description && <p className="mt-5 whitespace-pre-line leading-relaxed text-muted">{p.description}</p>}

          <div className="mt-8">
            <AddToCart
              product={{
                id: p.id,
                name: p.name,
                price,
                type: p.type,
                packageSize: p.packageSize ?? 0,
                allowDuplicate: p.allowDuplicateVariants,
                available,
                maxQty: p.trackStock ? Math.max(0, p.stock ?? 0) : 999,
                variants: p.packageOptions.map((o) => ({
                  id: o.variant.id,
                  name: o.variant.name,
                  max: o.maxPerPackage,
                  price: o.variant.packagePrice ?? 0,
                })),

              }}
            />
          </div>

          {p.information && (
            <div className="mt-8 rounded-2xl border border-line bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-espresso">
                <Info className="h-4 w-4 text-caramel-dark" /> Informasi Produk
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{p.information}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl text-maroon sm:text-3xl">Mungkin kamu juga suka</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
