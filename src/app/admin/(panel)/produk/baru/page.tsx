import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "Tambah Produk" };

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ tipe?: string }> }) {
  const { tipe } = await searchParams;
  const [categories, variants] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.productVariant.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
  ]);
  return (
    <>
      <PageHeader title="Tambah Produk" />
      <ProductForm
        categories={categories}
        variants={variants}
        initial={{
          name: "", categoryId: "", description: "", information: "", price: "", discountPrice: "",
          type: tipe === "PACKAGE" ? "PACKAGE" : "REGULAR", isAvailable: true, isPublished: true, isFeatured: false,
          trackStock: false, stock: "", packageSize: "2", allowDuplicateVariants: true, variantIds: [], images: [],
        }}
      />
    </>
  );
}
