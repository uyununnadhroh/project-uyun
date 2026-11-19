import Link from "next/link";
import { Users } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { AdminSearch } from "@/components/admin/search";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { displayPhone, formatDateTime, formatRupiah } from "@/lib/utils";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; urut?: string }> }) {
  const { q = "", urut = "" } = await searchParams;
  const like = `%${q.trim()}%`;
  const digits = q.replace(/\D/g, "").replace(/^0/, "62");
  const order = urut === "nama" ? Prisma.sql`c.name ASC` : urut === "transaksi" ? Prisma.sql`orders DESC` : urut === "terakhir" ? Prisma.sql`last_order DESC NULLS LAST` : Prisma.sql`total DESC`;
  // Total pembelian = pesanan yang tidak batal & sudah lunas
  const rows = await prisma.$queryRaw<{ id: string; name: string; phone: string; address: string | null; orders: bigint; total: bigint; last_order: Date | null }[]>`
    SELECT c.id, c.name, c.phone, c.address,
      COUNT(o.id) FILTER (WHERE o.status <> 'CANCELLED')::bigint AS orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'CANCELLED' AND p.status = 'PAID'), 0)::bigint AS total,
      MAX(o."createdAt") AS last_order
    FROM customers c
    LEFT JOIN orders o ON o."customerId" = c.id AND o."archivedAt" IS NULL
    LEFT JOIN payments p ON p."orderId" = o.id
    WHERE ${q.trim() ? Prisma.sql`(c.name ILIKE ${like} OR c.phone LIKE ${"%" + (digits || "~") + "%"})` : Prisma.sql`TRUE`}
    GROUP BY c.id
    ORDER BY ${order}
    LIMIT 200`;

  return (
    <>
      <PageHeader title="Customers" description="Customer yang pernah melakukan pemesanan (diidentifikasi dari nomor WhatsApp)." />
      <AdminSearch placeholder="Cari nama atau nomor WhatsApp…" filters={[{ name: "urut", label: "Urut: total pembelian", options: [{ value: "transaksi", label: "Jumlah transaksi" }, { value: "terakhir", label: "Pesanan terakhir" }, { value: "nama", label: "Nama (A-Z)" }] }]} />
      {rows.length === 0 ? (
        <EmptyState className="mt-4" icon={<Users className="h-6 w-6" />} title="Belum ada customer" />
      ) : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-cream-100 text-left text-xs tracking-wide text-muted uppercase">
              <tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Alamat</th><th className="px-4 py-3 text-center">Transaksi</th><th className="px-4 py-3 text-right">Total pembelian</th><th className="px-4 py-3">Terakhir</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-cream/60">
                  <td className="px-4 py-3"><Link href={`/admin/pelanggan/${c.id}`} className="font-semibold text-maroon hover:underline">{c.name}</Link></td>
                  <td className="px-4 py-3">{displayPhone(c.phone)}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">{c.address ?? "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{Number(c.orders)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatRupiah(Number(c.total))}</td>
                  <td className="px-4 py-3 text-xs text-muted">{c.last_order ? formatDateTime(c.last_order) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
