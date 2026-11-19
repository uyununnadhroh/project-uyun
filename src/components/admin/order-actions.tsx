"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Banknote, Archive, ArrowRight } from "lucide-react";
import type { OrderStatus, FulfillmentMethod, PaymentMethod, PaymentStatus } from "@prisma/client";
import { archiveOrderAction, markOrderPaid, updateOrderStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { orderStatusLabel } from "@/lib/constants";

export function OrderActions(props: {
  orderId: string;
  status: OrderStatus;
  fulfillment: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transitions: OrderStatus[];
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [dialog, setDialog] = useState<"cancel" | "paid" | "archive" | null>(null);

  const forward = props.transitions.filter((s) => s !== "CANCELLED");
  const canCancel = props.transitions.includes("CANCELLED");
  const unpaidCash = props.paymentMethod === "CASH" && props.paymentStatus !== "PAID";

  function exec(fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      setTarget(null);
      setDialog(null);
      setNote("");
      router.refresh();
    });
  }

  const waitingTransfer = props.paymentMethod === "TRANSFER" && (props.status === "AWAITING_PAYMENT" || props.status === "AWAITING_VERIFICATION");

  return (
    <div className="space-y-4">
      {props.status === "PENDING_CONFIRMATION" && <Alert tone="warning">Pesanan cash menunggu konfirmasi. Konfirmasi untuk memasukkan ke jadwal produksi.</Alert>}
      {waitingTransfer && (
        <Alert tone="info">
          {props.status === "AWAITING_PAYMENT" ? "Menunggu customer melakukan transfer & mengunggah bukti." : "Bukti transfer menunggu verifikasi — periksa di bawah atau di halaman Payment Verification."}
        </Alert>
      )}
      {forward.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Ubah status ke</p>
          <div className="flex flex-wrap gap-2">
            {forward.map((s) => (
              <Button key={s} variant={s === "COMPLETED" ? "success" : "primary"} onClick={() => { setTarget(s); setNote(""); setMarkPaid(true); }}>
                {props.status === "PENDING_CONFIRMATION" && s === "SCHEDULED" ? "Konfirmasi Pesanan" : orderStatusLabel(s, props.fulfillment)} <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {unpaidCash && props.status !== "CANCELLED" && (
          <Button variant="outline" onClick={() => setDialog("paid")}><Banknote className="h-4 w-4" /> Tandai Lunas (Cash)</Button>
        )}
        {canCancel && <Button variant="outline" className="text-red-700" onClick={() => setDialog("cancel")}><Ban className="h-4 w-4" /> Batalkan Pesanan</Button>}
        {props.status === "CANCELLED" && !props.archived && <Button variant="ghost" onClick={() => setDialog("archive")}><Archive className="h-4 w-4" /> Arsipkan</Button>}
        {props.status === "COMPLETED" && <p className="text-xs text-muted">Pesanan selesai tidak dapat dihapus / dibatalkan (menjaga integritas laporan).</p>}
      </div>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Ubah status ke “${target ? orderStatusLabel(target, props.fulfillment) : ""}”?`}
        description="Perubahan tercatat di riwayat dan langsung terlihat di halaman pelacakan customer."
        tone={target === "COMPLETED" ? "success" : "primary"}
        confirmText="Simpan status"
        loading={pending}
        onConfirm={() => exec(() => updateOrderStatus(props.orderId, target!, note, target === "COMPLETED" && unpaidCash ? markPaid : false), "Status diperbarui")}
      >
        {target === "COMPLETED" && unpaidCash && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3">
            <Checkbox checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} label="Pembayaran cash sudah diterima — tandai Lunas" />
            {!markPaid && <p className="mt-1 text-xs text-amber-800">Pesanan hanya dapat diselesaikan bila sudah lunas.</p>}
          </div>
        )}
        <Field label="Catatan (opsional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-16" />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Batalkan pesanan?"
        description={
          props.paymentStatus === "PAID"
            ? "Pesanan ini sudah LUNAS. Status pembayaran akan menjadi “Dikembalikan” — lakukan pengembalian dana secara manual kepada customer."
            : "Stok produk akan dikembalikan dan pesanan tidak dihitung sebagai penjualan."
        }
        tone="danger"
        confirmText="Batalkan pesanan"
        requireReason
        reasonLabel="Alasan pembatalan (terlihat oleh customer)"
        loading={pending}
        onConfirm={(reason) => exec(() => updateOrderStatus(props.orderId, "CANCELLED", reason), "Pesanan dibatalkan")}
      />
      <ConfirmDialog
        open={dialog === "paid"}
        onClose={() => setDialog(null)}
        title="Tandai pembayaran cash Lunas?"
        description="Pastikan uang sudah diterima. Tindakan ini tercatat di audit log."
        tone="success"
        confirmText="Ya, sudah diterima"
        loading={pending}
        onConfirm={() => exec(() => markOrderPaid(props.orderId), "Pembayaran ditandai lunas")}
      />
      <ConfirmDialog
        open={dialog === "archive"}
        onClose={() => setDialog(null)}
        title="Arsipkan pesanan batal?"
        description="Pesanan disembunyikan dari daftar & laporan, namun tetap tersimpan di database dan audit log."
        tone="danger"
        confirmText="Arsipkan"
        requireReason
        loading={pending}
        onConfirm={(reason) => exec(() => archiveOrderAction(props.orderId, reason), "Pesanan diarsipkan")}
      />
    </div>
  );
}
