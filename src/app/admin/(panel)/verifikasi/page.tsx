import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { ProofReview } from "@/components/admin/proof-review";
import { displayPhone, formatRupiah, cn } from "@/lib/utils";

export const metadata = { title: "Payment Verification" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "pending" } = await searchParams;
  const where =
    tab === "pending"
      ? { reviewStatus: "PENDING" as const, payment: { status: "WAITING_VERIFICATION" as const, order: { status: { not: "CANCELLED" as const } } } }
      : { reviewStatus: tab === "approved" ? ("APPROVED" as const) : ("REJECTED" as const) };
  const [proofs, counts] = await Promise.all([
    prisma.paymentProof.findMany({
      where,
      orderBy: { createdAt: tab === "pending" ? "asc" : "desc" },
      take: 50,
      include: { reviewedBy: { select: { name: true } }, payment: { include: { order: { select: { id: true, orderNumber: true, customerName: true, customerPhone: true, total: true } } } } },
    }),
    prisma.paymentProof.groupBy({ by: ["reviewStatus"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.reviewStatus === s)?._count ?? 0;
  const tabs = [
    { k: "pending", l: "Perlu diverifikasi" },
    { k: "approved", l: `Diterima (${count("APPROVED")})` },
    { k: "rejected", l: `Ditolak (${count("REJECTED")})` },
  ];

  return (
    <>
      <PageHeader title="Payment Verification" description="Periksa bukti transfer. Keputusan akhir selalu di tangan admin — cocokkan dengan mutasi rekening." />
      <div className="mb-4 flex gap-1 rounded-full border border-line bg-white p-1 text-sm sm:w-fit">
        {tabs.map((t) => (
          <Link key={t.k} href={`?tab=${t.k}`} className={cn("flex-1 rounded-full px-4 py-2 text-center font-medium whitespace-nowrap", tab === t.k ? "bg-maroon text-cream" : "text-muted hover:text-maroon")}>{t.l}</Link>
        ))}
      </div>
      {proofs.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="h-6 w-6" />} title={tab === "pending" ? "Semua pembayaran sudah diperiksa" : "Belum ada data"} description={tab === "pending" ? "Bukti transfer baru akan muncul di sini dan sebagai notifikasi." : undefined} />
      ) : (
        <div className="space-y-4">
          {proofs.map((pr) => {
            const o = pr.payment.order;
            return (
              <Card key={pr.id} className="p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/admin/pesanan/${o.id}`} className="font-semibold text-maroon hover:underline">{o.orderNumber}</Link>
                    <span className="text-sm text-muted"> · {o.customerName} · {displayPhone(o.customerPhone)}</span>
                  </div>
                  <p className="text-sm">Ke <b>{pr.payment.bankName}</b> {pr.payment.bankAccountNumber} · Total <b>{formatRupiah(pr.payment.amount)}</b></p>
                </div>
                <ProofReview
                  compact
                  expected={pr.payment.amount}
                  canReview={tab === "pending"}
                  proof={{
                    id: pr.id, url: `/api/files/${pr.filePath}`, createdAt: pr.createdAt.toISOString(), ocrStatus: pr.ocrStatus, ocrAmount: pr.ocrAmount, ocrDate: pr.ocrDate,
                    ocrSenderName: pr.ocrSenderName, ocrNote: pr.ocrNote, ocrText: pr.ocrText, reviewStatus: pr.reviewStatus, rejectionReason: pr.rejectionReason,
                    reviewedBy: pr.reviewedBy?.name ?? null, reviewedAt: pr.reviewedAt?.toISOString() ?? null,
                  }}
                />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
