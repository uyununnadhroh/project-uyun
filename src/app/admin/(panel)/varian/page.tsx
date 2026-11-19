import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { EntityManager } from "@/components/admin/entity-manager";
import { deleteVariant, saveVariant } from "@/app/admin/actions";

export const metadata = { title: "Varian Paket" };

export default async function VariantsPage() {
  const variants = await prisma.productVariant.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { packageOptions: true, orderSelections: true } } } });
  return (
    <>
      <PageHeader title="Varian Paket" description="Daftar varian rasa yang dapat dipilih customer pada produk paket. Atur varian per paket di halaman edit produk." />
      <EntityManager
        title="Varian"
        addLabel="Tambah Varian"
        emptyTitle="Belum ada varian"
        items={variants.map((v) => ({ id: v.id, name: v.name, description: v.description ?? "", isActive: v.isActive, sortOrder: v.sortOrder, packages: v._count.packageOptions, ordered: v._count.orderSelections }))}
        columns={[{ key: "name", label: "Varian" }, { key: "packages", label: "Dipakai di paket" }, { key: "ordered", label: "Kali dipesan" }, { key: "sortOrder", label: "Urutan" }, { key: "isActive", label: "Status", render: "badge-active" }]}
        fields={[
          { name: "name", label: "Nama varian", required: true, placeholder: "Cokelat" },
          { name: "description", label: "Keterangan (opsional)" },
          { name: "sortOrder", label: "Urutan tampil", type: "number" },
          { name: "isActive", label: "Tersedia", type: "switch", hint: "Varian nonaktif tidak bisa dipilih customer di semua paket" },
        ]}
        defaults={{ name: "", description: "", sortOrder: variants.length, isActive: true }}
        onSave={saveVariant}
        onDelete={deleteVariant}
        deleteWarning="Varian akan dihapus dari semua paket. Riwayat pesanan tetap menyimpan nama varian. Untuk sementara, sebaiknya nonaktifkan saja."
      />
    </>
  );
}
