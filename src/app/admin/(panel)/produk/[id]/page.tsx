import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { ProductForm } from "@/components/admin/product-form";
import { PackageLimits } from "@/components/admin/package-limits";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Edit Produk" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, categories, variants] = await Promise.all([
    prisma.product.findFirst({ where: { id, deletedAt: null }, include: { images: { orderBy: { sortOrder: "asc" } }, packageOptions: { include: { variant: true } } } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.productVariant.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
  ]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Edit: ${p.name}`} action={<Link href={`/menu/${p.slug}`} target="_blank" className={buttonClass("outline", "sm")}><ExternalLink className="h-4 w-4" /> Lihat di toko</Link>} />
      <ProductForm
        categories={categories}
        variants={variants}
        initial={{
          id: p.id, name: p.name, categoryId: p.categoryId, description: p.description, information: p.information ?? "",
          price: String(p.price), discountPrice: p.discountPrice != null ? String(p.discountPrice) : "", type: p.type,
          isAvailable: p.isAvailable, isPublished: p.isPublished, isFeatured: p.isFeatured, trackStock: p.trackStock,
          stock: p.stock != null ? String(p.stock) : "", packageSize: p.packageSize ? String(p.packageSize) : "2",
          allowDuplicateVariants: p.allowDuplicateVariants, variantIds: p.packageOptions.map((o) => o.variantId), images: p.images.map((i) => i.url),
        }}
      />
      {p.type === "PACKAGE" && p.packageOptions.length > 0 && (
        <div className="mt-6 lg:w-2/3">
          <PackageLimits productId={p.id} packageSize={p.packageSize ?? 0} options={p.packageOptions.map((o) => ({ variantId: o.variantId, name: o.variant.name, max: o.maxPerPackage }))} />
        </div>
      )}
    </>
  );
}
