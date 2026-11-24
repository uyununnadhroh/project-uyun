"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Clock, Upload, ImageIcon, X, PartyPopper, AlertTriangle, MapPin, CalendarDays, Store, Bike, RefreshCw, Hourglass, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import type { CustomerOrder } from "@/lib/order-view";
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, FULFILLMENT_LABEL, orderStatusLabel, ALLOWED_PROOF_TYPES, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { cn, displayPhone, formatDateOnly, formatDateTime, formatRupiah } from "@/lib/utils";
import { orderSummaryText, waLink } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { WhatsAppIcon } from "./whatsapp-button";

function useCopy() {
  return useCallback(async (text: string, label = "Disalin") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Gagal menyalin. Salin manual ya.");
    }
  }, []);
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="font-bold text-red-600">Waktu habis</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span className="font-mono font-bold tabular-nums">{`${h}j ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}d`}</span>;
}

function steps(o: CustomerOrder): OrderStatus[] {
  const s: OrderStatus[] = [];
  if (o.payment.method === "CASH") s.push("PENDING_CONFIRMATION");
  else s.push("AWAITING_PAYMENT", "AWAITING_VERIFICATION", "PAYMENT_CONFIRMED");
  s.push("SCHEDULED", "IN_PRODUCTION", "PACKING", "READY");
  if (o.fulfillmentMethod === "DELIVERY") s.push("OUT_FOR_DELIVERY");
  s.push("COMPLETED");
  return s;
}

function ProofUploader({ orderNumber, onDone }: { orderNumber: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(f: File | undefined) {
    setErr(null);
    if (!f) return;
    setFile(null);
    setPreview(null);
    if (!f.size) return setErr("File kosong. Pilih gambar bukti transfer.");
    if (!ALLOWED_PROOF_TYPES.includes(f.type)) return setErr("Format harus JPG, JPEG, atau PNG.");
    if (f.size > MAX_UPLOAD_BYTES) return setErr(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function send() {
    if (!file) return setErr("Pilih gambar bukti transfer.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/orders/${orderNumber}/proof`, { method: "POST", body: fd });
      if (r.status === 413) throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
      if (!r.ok) {
        const result = await r.json().catch(() => null);
        throw new Error(result?.error ?? "Bukti pembayaran gagal diunggah. Silakan coba lagi.");
      }
      toast.success("Bukti pembayaran berhasil dikirim!", { description: "Admin akan memverifikasi pembayaranmu." });
      setFile(null);
      setPreview(null);
      onDone();
    } catch (e) {
      setErr(e instanceof TypeError ? "Koneksi gagal. Periksa jaringan lalu coba lagi." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-cream-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview bukti transfer" className="mx-auto max-h-80 object-contain" />
          <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow" aria-label="Hapus gambar">
            <X className="h-4 w-4" />
          </button>
          <p className="border-t border-line bg-white px-3 py-2 text-xs text-muted">{file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-sand bg-cream px-4 py-8 text-center transition hover:border-caramel hover:bg-cream-100"
        >
          <ImageIcon className="h-8 w-8 text-caramel-dark" />
          <span className="text-sm font-semibold">Pilih / tarik gambar bukti transfer</span>
          <span className="text-xs text-muted">JPG, JPEG, PNG · maks {MAX_UPLOAD_LABEL}</span>
        </button>
      )}
      {err && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{err}</p>}
      <Button className="mt-3 w-full" size="lg" loading={busy} disabled={!file} onClick={send}>
        <Upload className="h-4.5 w-4.5" /> Kirim Bukti Pembayaran
      </Button>
    </div>
  );
}

export function OrderTracker({ initial, isNew }: { initial: CustomerOrder; isNew: boolean }) {
  const [o, setO] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const copy = useCopy();
  const lastUpdate = useRef(initial.updatedAt);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const r = await fetch(`/api/orders/${initial.orderNumber}`, { cache: "no-store" });
      if (r.ok) {
        const j: CustomerOrder = await r.json();
        if (j.updatedAt !== lastUpdate.current && !manual) toast.info(`Status pesanan: ${orderStatusLabel(j.status, j.fulfillmentMethod)}`);
        lastUpdate.current = j.updatedAt;
        setO(j);
      }
    } finally {
      setRefreshing(false);
    }
  }, [initial.orderNumber]);

  // Pembaruan otomatis: polling ringan setiap 10 detik selama pesanan belum selesai
  useEffect(() => {
    if (o.status === "COMPLETED" || o.status === "CANCELLED") return;
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 10000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [o.status, refresh]);

  const p = o.payment;
  const trackUrl = typeof window !== "undefined" ? `${window.location.origin}/lacak?no=${o.orderNumber}` : undefined;
  const summaryLink = waLink(o.store.whatsappNumber, orderSummaryText({ ...o, paymentMethod: p.method }, trackUrl));
  const helpLink = waLink(o.store.whatsappNumber, `Halo Hakuu Bakery, saya butuh bantuan untuk pesanan ${o.orderNumber}.`);
  const proofLink = waLink(o.store.whatsappNumber, `Halo Hakuu Bakery, saya sudah mengunggah bukti transfer untuk pesanan ${o.orderNumber} sebesar ${formatRupiah(p.amount)}. Mohon dicek ya, terima kasih.`);
  const flow = steps(o);
  const currentIdx = flow.indexOf(o.status);
  const cancelled = o.status === "CANCELLED";
  const lastRejected = p.status === "REJECTED" ? p.proofs.find((x) => x.reviewStatus === "REJECTED") : null;
  const needsTransfer = p.method === "TRANSFER" && (p.status === "UNPAID" || p.status === "REJECTED") && !cancelled;

  return (
    <div className="container-page pt-6 pb-10 sm:pt-10">
      {isNew && (
        <div className="mb-6 flex items-start gap-4 rounded-3xl bg-maroon p-5 text-cream sm:p-6 animate-fade-in">
          <PartyPopper className="h-7 w-7 shrink-0 text-caramel" />
          <div>
            <p className="font-display text-2xl">Terima kasih, {o.customerName.split(" ")[0]}!</p>
            <p className="mt-1 text-sm text-cream/80">
              Pesananmu sudah kami terima. Simpan nomor pesanan <b className="text-caramel">{o.orderNumber}</b> untuk melacak status pesanan.
              {p.method === "TRANSFER" ? " Selesaikan pembayaran di bawah ini." : " Pembayaran dilakukan secara cash saat pesanan diambil/diterima."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Detail Pesanan</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl text-maroon sm:text-4xl">{o.orderNumber}</h1>
            <button onClick={() => copy(o.orderNumber, "Nomor pesanan disalin")} className="rounded-full p-2 text-muted hover:bg-cream-200" aria-label="Salin nomor pesanan">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">Dibuat {formatDateTime(o.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={ORDER_STATUS_TONE[o.status]} className="px-3 py-1 text-sm">{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge>
          <button onClick={() => refresh(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-maroon">
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Diperbarui otomatis
          </button>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* PEMBAYARAN */}
          {p.method === "TRANSFER" && !cancelled && (
            <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-maroon">Pembayaran Transfer</h2>
                <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
              </div>

              {p.status === "PAID" && (
                <Alert tone="success" className="mt-4" title="Pembayaran telah diverifikasi — Lunas">
                  Terima kasih! Pesananmu akan segera masuk jadwal produksi.
                </Alert>
              )}

              {p.status === "WAITING_VERIFICATION" && (
                <div className="mt-4 space-y-3">
                  <Alert tone="info" title="Bukti pembayaran berhasil dikirim">
                    Admin sedang memverifikasi pembayaranmu. Status akan diperbarui otomatis di halaman ini.
                  </Alert>
                  {proofLink && (
                    <a href={proofLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-5 py-3 text-sm font-semibold text-white hover:bg-[#178a49]">
                      <WhatsAppIcon className="h-4.5 w-4.5" /> Kabari admin via WhatsApp
                    </a>
                  )}
                </div>
              )}

              {needsTransfer && (
                <div className="mt-4 space-y-5">
                  {lastRejected && (
                    <Alert tone="danger" title="Bukti transfer sebelumnya ditolak">
                      Alasan: {lastRejected.rejectionReason}. Silakan unggah ulang bukti yang benar.
                    </Alert>
                  )}
                  <div className="rounded-2xl bg-cream-100 p-5">
                    <p className="text-xs font-semibold tracking-widest text-muted uppercase">Transfer ke</p>
                    <p className="mt-2 text-lg font-bold">{p.bankName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-2xl font-bold tracking-wider text-maroon">{p.bankAccountNumber}</p>
                      <Button size="sm" variant="outline" onClick={() => copy((p.bankAccountNumber ?? "").replace(/\D/g, ""), "Nomor rekening disalin")}>
                        <Copy className="h-3.5 w-3.5" /> Salin
                      </Button>
                    </div>
                    <p className="text-sm text-muted">a.n. {p.bankAccountHolder}</p>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-sand pt-4">
                      <div>
                        <p className="text-xs text-muted">Total yang harus ditransfer</p>
                        <p className="text-2xl font-bold text-maroon">{formatRupiah(p.amount)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => copy(String(p.amount), "Nominal disalin")}>
                        <Copy className="h-3.5 w-3.5" /> Salin nominal
                      </Button>
                    </div>
                    {p.deadline && (
                      <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                        <Clock className="h-4 w-4 text-brown" /> Bayar sebelum {formatDateTime(p.deadline)} · <Countdown to={p.deadline} />
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 font-semibold">Unggah bukti transfer</p>
                    <ProofUploader orderNumber={o.orderNumber} onDone={() => refresh(true)} />
                    <p className="mt-2 text-xs text-muted">Pastikan nominal, tanggal & rekening tujuan terlihat jelas. Bukti akan diperiksa manual oleh admin.</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {p.method === "CASH" && !cancelled && (
            <section className="flex gap-4 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-6">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream-200 text-maroon">
                {p.status === "PAID" ? <CircleCheck className="h-5 w-5" /> : <Hourglass className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">Pembayaran Cash</h2>
                  <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {p.status === "PAID" ? "Pembayaran sudah diterima. Terima kasih!" : `Siapkan uang ${formatRupiah(p.amount)} dan bayar saat ${o.fulfillmentMethod === "PICKUP" ? "mengambil" : "menerima"} pesanan.`}
                </p>
              </div>
            </section>
          )}

          {/* STATUS */}
          <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7">
            <h2 className="font-display text-2xl text-maroon">Status Pesanan</h2>
            {cancelled ? (
              <Alert tone="danger" className="mt-4" title="Pesanan dibatalkan">
                {o.cancelReason}
              </Alert>
            ) : (
              <ol className="mt-6">
                {flow.map((s, i) => {
                  const done = i < currentIdx || o.status === "COMPLETED";
                  const current = i === currentIdx && o.status !== "COMPLETED";
                  const hist = [...o.histories].reverse().find((h) => h.toStatus === s);
                  return (
                    <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < flow.length - 1 && <span className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", done ? "bg-maroon" : "bg-line")} />}
                      <span className={cn("relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", done ? "border-maroon bg-maroon text-cream" : current ? "border-maroon bg-white text-maroon ring-4 ring-caramel/30" : "border-line bg-white text-muted")}>
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <div className="pt-1">
                        <p className={cn("text-sm font-semibold", !done && !current && "text-muted")}>{orderStatusLabel(s, o.fulfillmentMethod)}</p>
                        {hist && (done || current) && <p className="text-xs text-muted">{formatDateTime(hist.createdAt)}</p>}
                        {current && <p className="mt-1 text-xs font-medium text-caramel-dark">Tahap saat ini</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {o.histories.some((h) => h.note) && (
              <details className="mt-6 rounded-2xl bg-cream-100 p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Riwayat aktivitas</summary>
                <ul className="mt-3 space-y-2">
                  {[...o.histories].reverse().map((h, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-36 shrink-0 text-xs text-muted">{formatDateTime(h.createdAt)}</span>
                      <span className="text-xs">{h.note || orderStatusLabel(h.toStatus, o.fulfillmentMethod)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        {/* RINGKASAN */}
        <aside className="space-y-6 lg:col-span-2">
          <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-xl text-maroon">Rincian</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {o.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{it.productName} <span className="font-normal text-muted">×{it.quantity}</span></p>
                    {it.variants.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {it.variants.map((v) => (
                          <li key={v.slotNumber} className="rounded-full bg-cream-200 px-2 py-0.5 text-[0.7rem] text-maroon">{v.slotNumber}. {v.variantName}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="shrink-0">{formatRupiah(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatRupiah(o.subtotal)}</dd></div>
              {o.fulfillmentMethod === "DELIVERY" && <div className="flex justify-between"><dt className="text-muted">Ongkos kirim</dt><dd>{formatRupiah(o.deliveryFee)}</dd></div>}
              <div className="flex justify-between pt-2 text-base font-bold"><dt>Total</dt><dd className="text-maroon">{formatRupiah(o.total)}</dd></div>
              <div className="flex justify-between text-xs text-muted"><dt>Pembayaran</dt><dd>{PAYMENT_METHOD_LABEL[p.method]}</dd></div>
            </dl>
          </section>

          <section className="space-y-3 rounded-3xl border border-line bg-white p-5 text-sm shadow-soft sm:p-6">
            <p className="flex items-center gap-2 font-semibold">
              {o.fulfillmentMethod === "PICKUP" ? <Store className="h-4 w-4 text-brown" /> : <Bike className="h-4 w-4 text-brown" />}
              {FULFILLMENT_LABEL[o.fulfillmentMethod]}
            </p>
            <p className="flex gap-2 text-muted"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> {formatDateOnly(o.scheduledDate)}, {o.scheduledTime}</p>
            {o.fulfillmentMethod === "DELIVERY" ? (
              <p className="flex gap-2 text-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span>{o.deliveryAddress}{o.addressLandmark && <><br />Patokan: {o.addressLandmark}</>}</span></p>
            ) : (
              o.store.address && <p className="flex gap-2 text-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span className="whitespace-pre-line">{o.store.address}</span></p>
            )}
            <p className="text-muted">a.n. {o.customerName} · {displayPhone(o.customerPhone)}</p>
            {o.notes && <p className="rounded-xl bg-cream-100 p-3 text-xs">Catatan: {o.notes}</p>}
          </section>

          {(summaryLink || helpLink) && (
            <section className="space-y-2.5 rounded-3xl bg-cream-200 p-5 sm:p-6">
              <p className="font-semibold text-maroon">Butuh bantuan?</p>
              {summaryLink && (
                <a href={summaryLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-5 py-3 text-sm font-semibold text-white hover:bg-[#178a49]">
                  <WhatsAppIcon className="h-4.5 w-4.5" /> Kirim ringkasan ke WhatsApp
                </a>
              )}
              {helpLink && (
                <a href={helpLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-[#1f9d55] bg-white px-5 py-3 text-sm font-semibold text-[#1f7a45] hover:bg-emerald-50">
                  Hubungi Hakuu Bakery
                </a>
              )}
              <p className="flex gap-1.5 text-xs text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Tombol ini membuka WhatsApp dengan pesan terisi. Pesan baru terkirim setelah kamu menekan “Kirim” di WhatsApp.
              </p>
            </section>
          )}
          <Link href="/menu" className="block text-center text-sm font-semibold text-maroon hover:underline">Pesan lagi →</Link>
        </aside>
      </div>
    </div>
  );
}
