import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { EntityManager } from "@/components/admin/entity-manager";
import { deleteBank, saveBank } from "@/app/admin/actions";

export const metadata = { title: "Bank Accounts" };

export default async function BanksPage() {
  const banks = await prisma.bankAccount.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { payments: true } } } });
  return (
    <>
      <PageHeader title="Bank Accounts" description="Rekening tujuan transfer. Customer hanya melihat rekening yang aktif." />
      <EntityManager
        title="Rekening"
        addLabel="Tambah Rekening"
        emptyTitle="Belum ada rekening"
        emptyDescription="Tambahkan minimal satu rekening aktif agar metode Transfer Bank muncul saat checkout."
        items={banks.map((b) => ({ id: b.id, bankName: b.bankName, accountNumber: b.accountNumber, accountHolder: b.accountHolder, isActive: b.isActive, used: b._count.payments }))}
        columns={[{ key: "bankName", label: "Bank" }, { key: "accountNumber", label: "No. Rekening", render: "mono" }, { key: "accountHolder", label: "Atas Nama" }, { key: "used", label: "Dipakai" }, { key: "isActive", label: "Status", render: "badge-active" }]}
        fields={[
          { name: "bankName", label: "Nama bank", required: true, placeholder: "BCA / BRI / Mandiri / BSI" },
          { name: "accountNumber", label: "Nomor rekening", required: true },
          { name: "accountHolder", label: "Nama pemilik rekening", required: true },
          { name: "isActive", label: "Aktif", type: "switch", hint: "Tampilkan rekening ini kepada customer" },
        ]}
        defaults={{ bankName: "", accountNumber: "", accountHolder: "", isActive: true }}
        onSave={saveBank}
        onDelete={deleteBank}
        deleteWarning="Pesanan lama tetap menyimpan data rekening tujuannya. Untuk menyembunyikan sementara, cukup nonaktifkan."
      />
    </>
  );
}
