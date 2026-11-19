import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { prisma } from "@/lib/db";
import { soldCounts, inStock } from "@/lib/catalog";
import { PageHeader } from "@/components/admin/shell";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ProductImage } from "@/components/shop/product-image";
import { ProductRowActions, ProductToggle } from "@/components/admin/product-row";
import { effectivePrice, formatRupiah } from "@/lib/utils";
import { AdminSearch } from "@/components/admin/search";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; kategori?: string; tipe?: string }> }) {
  const sp = await searchParams;
  const [products, categories, sold] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" } } : {}),
        ...(sp.kategori ? { categoryId: sp.kategori } : {}),
        ...(sp.tipe === "PACKAGE" || sp.tipe === "REGULAR" ? { type: sp.tipe } : {}),
      },
      include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 }, _count: { select: { packageOptions: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    soldCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} produk`}
        action={<Link href="/admin/produk/baru" className={buttonClass("primary")}><Plus className="h-4 w-4" /> Tambah Produk</Link>}
      />
      <AdminSearch
        placeholder="Cari nama produk…"
        filters={[
          { name: "kategori", label: "Semua kategori", options: categories.map((c) => ({ value: c.id, label: c.name })) },
          { name: "tipe", label: "Semua jenis", options: [{ value: "REGULAR", label: "Produk biasa" }, { value: "PACKAGE", label: "Paket" }] },
        ]}
      />
      {products.length === 0 ? (
        <EmptyState className="mt-4" icon={<Package className="h-6 w-6" />} title="Belum ada produk" description="Tambahkan produk pertama Hakuu Bakery beserta fotonya." action={<Link href="/admin/produk/baru" className={buttonClass()}>Tambah Produk</Link>} />
      ) : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line bg-cream-100 text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Harga</th>
                <th className="px-4 py-3">Stok / Status</th>
                <th className="px-4 py-3 text-center">Terjual</th>
                <th className="px-4 py-3 text-center">Aktif</th>
                <th className="px-4 py-3 text-center">Tersedia</th>
                <th className="px-4 py-3 text-center">Unggulan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-cream/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl"><ProductImage src={p.images[0]?.url} alt="" /></div>
                      <div>
                        <Link href={`/admin/produk/${p.id}`} className="font-semibold hover:text-maroon">{p.name}</Link>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <Badge tone="brand">{p.category.name}</Badge>
                          {p.type === "PACKAGE" && <Badge tone="maroon">Paket isi {p.packageSize} · {p._count.packageOptions} varian</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{formatRupiah(effectivePrice(p))}</p>
                    {p.discountPrice != null && <p className="text-xs text-muted line-through">{formatRupiah(p.price)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {p.trackStock ? <span className="font-medium">{p.stock} pcs</span> : <span className="text-muted">Tanpa stok</span>}
                    <div className="mt-0.5">{inStock(p) ? <Badge tone="green">Tersedia</Badge> : <Badge tone="red">Habis</Badge>}</div>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{sold.get(p.id) ?? 0}</td>
                  <td className="px-4 py-3 text-center"><ProductToggle id={p.id} field="isPublished" value={p.isPublished} /></td>
                  <td className="px-4 py-3 text-center"><ProductToggle id={p.id} field="isAvailable" value={p.isAvailable} /></td>
                  <td className="px-4 py-3 text-center"><ProductToggle id={p.id} field="isFeatured" value={p.isFeatured} /></td>
                  <td className="px-4 py-3 text-right"><ProductRowActions id={p.id} name={p.name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
