"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, ScanText, Loader2, ZoomIn, Info } from "lucide-react";
import type { OcrStatus, ProofReviewStatus } from "@prisma/client";
import { approveProofAction, rejectProofAction, rerunOcrAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { OCR_STATUS_LABEL } from "@/lib/constants";
import { cn, formatDateTime, formatRupiah } from "@/lib/utils";

export type ProofView = {
  id: string;
  url: string;
  createdAt: string;
  ocrStatus: OcrStatus;
  ocrAmount: number | null;
  ocrDate: string | null;
  ocrSenderName: string | null;
  ocrNote: string | null;
  ocrText: string | null;
  reviewStatus: ProofReviewStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export function ProofReview({ proof, expected, canReview, compact }: { proof: ProofView; expected: number; canReview: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [zoom, setZoom] = useState(false);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);

  // OCR berjalan di background — segarkan otomatis sampai selesai
  useEffect(() => {
    if (proof.ocrStatus !== "PENDING") return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [proof.ocrStatus, router]);

  const diff = proof.ocrAmount != null ? proof.ocrAmount - expected : null;
  const ocrTone = proof.ocrStatus === "MATCH" ? "green" : proof.ocrStatus === "PENDING" ? "blue" : "amber";

  function exec(fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <div className={cn("grid gap-4 rounded-2xl border border-line p-4", !compact && "sm:grid-cols-[180px_1fr]", compact && "sm:grid-cols-[150px_1fr]")}>
      <button onClick={() => setZoom(true)} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-cream-100" aria-label="Perbesar bukti transfer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={proof.url} alt="Bukti transfer" className="h-full w-full object-cover object-top" />
        <span className="absolute inset-0 grid place-items-center bg-espresso/0 text-white opacity-0 transition group-hover:bg-espresso/40 group-hover:opacity-100"><ZoomIn className="h-6 w-6" /></span>
      </button>
      <div className="min-w-0 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ocrTone}>{proof.ocrStatus === "PENDING" && <Loader2 className="h-3 w-3 animate-spin" />}OCR: {OCR_STATUS_LABEL[proof.ocrStatus]}</Badge>
          {proof.reviewStatus === "APPROVED" && <Badge tone="green">Disetujui</Badge>}
          {proof.reviewStatus === "REJECTED" && <Badge tone="red">Ditolak</Badge>}
          {proof.reviewStatus === "PENDING" && <Badge tone="blue">Menunggu keputusan admin</Badge>}
          <span className="text-xs text-muted">Diunggah {formatDateTime(proof.createdAt)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-cream-100 p-3 sm:grid-cols-4">
          <div><dt className="text-xs text-muted">Total pesanan</dt><dd className="font-bold">{formatRupiah(expected)}</dd></div>
          <div>
            <dt className="text-xs text-muted">Nominal terbaca</dt>
            <dd className={cn("font-bold", diff === 0 ? "text-emerald-700" : diff != null ? "text-amber-700" : "text-muted")}>{proof.ocrAmount != null ? formatRupiah(proof.ocrAmount) : "—"}</dd>
            {diff != null && diff !== 0 && <dd className="text-[0.7rem] text-amber-700">selisih {formatRupiah(Math.abs(diff))}</dd>}
          </div>
          <div><dt className="text-xs text-muted">Tanggal terbaca</dt><dd className="font-medium">{proof.ocrDate ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted">Nama pengirim</dt><dd className="truncate font-medium">{proof.ocrSenderName ?? "—"}</dd></div>
        </dl>
        {proof.ocrNote && <p className="text-xs text-espresso/80">{proof.ocrNote}</p>}
        {proof.ocrText && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-muted">Teks hasil OCR</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-cream-100 p-2 whitespace-pre-wrap font-mono text-[0.7rem]">{proof.ocrText}</pre>
          </details>
        )}
        <p className="flex gap-1.5 text-[0.7rem] text-muted"><Info className="h-3.5 w-3.5 shrink-0" /> OCR hanya alat bantu & tidak membuktikan keaslian transfer. Selalu cocokkan dengan mutasi rekening sebelum menyetujui.</p>
        {proof.reviewStatus === "REJECTED" && <p className="text-xs text-red-700">Alasan penolakan: {proof.rejectionReason}</p>}
        {proof.reviewedBy && <p className="text-xs text-muted">Diperiksa oleh {proof.reviewedBy} · {proof.reviewedAt && formatDateTime(proof.reviewedAt)}</p>}
        {canReview && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="success" onClick={() => setDialog("approve")}><Check className="h-4 w-4" /> Terima Pembayaran</Button>
            <Button variant="danger" onClick={() => setDialog("reject")}><X className="h-4 w-4" /> Tolak Pembayaran</Button>
            {proof.ocrStatus !== "PENDING" && (
              <Button variant="ghost" size="sm" loading={pending && !dialog} onClick={() => exec(() => rerunOcrAction(proof.id), "OCR dijalankan ulang")}><ScanText className="h-4 w-4" /> Baca ulang</Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={zoom} onClose={() => setZoom(false)} title="Bukti transfer" size="lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={proof.url} alt="Bukti transfer" className="mx-auto max-h-[75dvh] w-auto rounded-xl" />
        <a href={proof.url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-sm font-semibold text-maroon hover:underline">Buka ukuran penuh</a>
      </Dialog>
      <ConfirmDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title="Terima pembayaran?"
        description={`Pastikan dana ${formatRupiah(expected)} sudah benar-benar masuk ke rekening (cek mutasi). Status pembayaran akan menjadi Lunas.`}
        tone="success"
        confirmText="Ya, terima"
        loading={pending}
        onConfirm={() => exec(() => approveProofAction(proof.id), "Pembayaran diterima — Lunas")}
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Tolak bukti transfer?"
        description="Customer akan melihat alasan penolakan dan dapat mengunggah ulang bukti."
        tone="danger"
        confirmText="Tolak"
        requireReason
        reasonLabel="Alasan penolakan"
        loading={pending}
        onConfirm={(reason) => exec(() => rejectProofAction(proof.id, reason), "Bukti transfer ditolak")}
      />
    </div>
  );
}
