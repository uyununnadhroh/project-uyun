import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { EntityManager } from "@/components/admin/entity-manager";
import { deleteCategory, saveCategory } from "@/app/admin/actions";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const cats = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } });
  return (
    <>
      <PageHeader title="Categories" description="Kategori produk yang tampil di katalog & homepage." />
      <EntityManager
        title="Kategori"
        addLabel="Tambah Kategori"
        emptyTitle="Belum ada kategori"
        items={cats.map((c) => ({ id: c.id, name: c.name, description: c.description ?? "", sortOrder: c.sortOrder, isActive: c.isActive, count: c._count.products, slug: c.slug }))}
        columns={[{ key: "name", label: "Nama" }, { key: "slug", label: "Slug", render: "mono" }, { key: "count", label: "Produk" }, { key: "sortOrder", label: "Urutan" }, { key: "isActive", label: "Status", render: "badge-active" }]}
        fields={[
          { name: "name", label: "Nama kategori", required: true },
          { name: "description", label: "Deskripsi singkat" },
          { name: "sortOrder", label: "Urutan tampil", type: "number" },
          { name: "isActive", label: "Aktif", type: "switch", hint: "Kategori nonaktif menyembunyikan produknya dari katalog" },
        ]}
        defaults={{ name: "", description: "", sortOrder: cats.length + 1, isActive: true }}
        onSave={saveCategory}
        onDelete={deleteCategory}
        deleteWarning="Kategori hanya dapat dihapus bila tidak memiliki produk."
      />
    </>
  );
}
