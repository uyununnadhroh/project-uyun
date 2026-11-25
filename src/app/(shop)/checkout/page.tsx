"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Bike, Banknote, Landmark, ChevronLeft, MapPin, ShieldCheck, CalendarX } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/shop/cart-context";
import { useQuote } from "@/components/shop/use-quote";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { checkoutSchema, fieldErrors } from "@/lib/validation";
import { cn, formatRupiah, formatDateOnly } from "@/lib/utils";

type Day = { date: string; capacity: number | null; used: number; remaining: number | null; closed: boolean; reason: string | null };
type Options = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryNote: string;
  pickupAddress: string;
  pickupInstructions: string;
  operatingHours: string;
  cashEnabled: boolean;
  transferEnabled: boolean;
  paymentDeadlineHours: number;
  timeSlots: string[];
  banks: { id: string; bankName: string; accountNumber: string; accountHolder: string }[];
  days: Day[];
};

const PROFILE_KEY = "hakuu_profile";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-7">
      <h2 className="flex items-center gap-3 font-display text-xl text-maroon">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream-200 font-sans text-sm font-bold">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OptionCard({ active, onClick, icon, title, desc, disabled }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-maroon bg-maroon-50" : "border-line hover:border-caramel",
      )}
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", active ? "bg-maroon text-cream" : "bg-cream-200 text-maroon")}>{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{desc}</span>
      </span>
    </button>
  );
}

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const { quote, loading: quoteLoading } = useQuote(cart.lines, cart.ready);
  const [opt, setOpt] = useState<Options | null>(null);
  const [optError, setOptError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    fulfillmentMethod: "" as "" | "PICKUP" | "DELIVERY",
    deliveryAddress: "",
    addressLandmark: "",
    scheduledDate: "",
    scheduledTime: "",
    notes: "",
    paymentMethod: "" as "" | "CASH" | "TRANSFER",
    bankAccountId: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function loadOptions() {
    try {
      const r = await fetch("/api/checkout/options", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setOpt(j);
      setForm((f) => ({
        ...f,
        fulfillmentMethod: f.fulfillmentMethod || (j.pickupEnabled ? "PICKUP" : j.deliveryEnabled ? "DELIVERY" : ""),
        paymentMethod: f.paymentMethod || (j.cashEnabled ? "CASH" : j.transferEnabled ? "TRANSFER" : ""),
        bankAccountId: f.bankAccountId || j.banks[0]?.id || "",
      }));
    } catch (e) {
      setOptError((e as Error).message || "Gagal memuat opsi checkout");
    }
  }

  useEffect(() => {
    loadOptions();
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      setForm((f) => ({ ...f, customerName: p.customerName || "", phone: p.phone || "", deliveryAddress: p.deliveryAddress || "", addressLandmark: p.addressLandmark || "" }));
    } catch {}
  }, []);

  const units = quote?.units ?? 0;
  const deliveryFee = form.fulfillmentMethod === "DELIVERY" ? opt?.deliveryFee ?? 0 : 0;
  const total = (quote?.subtotal ?? 0) + deliveryFee;
  const selectedDay = useMemo(() => opt?.days.find((d) => d.date === form.scheduledDate), [opt, form.scheduledDate]);

  function dayState(d: Day) {
    if (d.closed) return { disabled: true, label: "Tutup" };
    if (d.remaining != null && d.remaining <= 0) return { disabled: true, label: "Penuh" };
    if (d.remaining != null && d.remaining < units) return { disabled: true, label: `Sisa ${d.remaining}` };
    return { disabled: false, label: d.remaining != null ? `Sisa ${d.remaining}` : "Tersedia" };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const payload = { ...form, items: cart.lines, bankAccountId: form.paymentMethod === "TRANSFER" ? form.bankAccountId : null };
    const parsed = checkoutSchema.safeParse(payload);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (!form.fulfillmentMethod) errs.fulfillmentMethod = "Pilih metode penerimaan";
    if (!form.paymentMethod) errs.paymentMethod = "Pilih metode pembayaran";
    if (!form.scheduledDate) errs.scheduledDate = "Pilih tanggal";
    if (selectedDay && dayState(selectedDay).disabled) errs.scheduledDate = "Tanggal ini sudah penuh / tutup. Pilih tanggal lain.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Mohon lengkapi data yang ditandai.");
      document.querySelector("[aria-invalid=true], [data-error=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) {
        if (j.fields) setErrors(j.fields);
        setServerError(j.error);
        if (r.status === 409) loadOptions();
        toast.error(j.error);
        return;
      }
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ customerName: form.customerName, phone: form.phone, deliveryAddress: form.deliveryAddress, addressLandmark: form.addressLandmark }));
      } catch {}
      cart.clear();
      toast.success("Pesanan berhasil dibuat!");
      router.push(`/pesanan/${j.orderNumber}?baru=1`);
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart.ready || (!opt && !optError) || (quoteLoading && !quote))
    return (
      <div className="container-page grid gap-8 pt-10 pb-10 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-3xl" />)}</div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    );
  if (optError) return <div className="container-page pt-10"><ErrorState description={optError} /></div>;
  if (!cart.lines.length)
    return (
      <div className="container-page pt-10">
        <EmptyState title="Keranjang kosong" description="Tambahkan produk sebelum checkout." action={<Link href="/menu" className={buttonClass()}>Lihat Menu</Link>} />
      </div>
    );
  const o = opt!;

  return (
    <form onSubmit={submit} noValidate className="container-page pt-6 pb-10 sm:pt-10">
      <Link href="/keranjang" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-maroon">
        <ChevronLeft className="h-4 w-4" /> Kembali ke keranjang
      </Link>
      <h1 className="mt-4 text-4xl text-maroon sm:text-5xl">Checkout</h1>

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Section n={1} title="Data Diri">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama lengkap" htmlFor="name" required error={errors.customerName}>
                <Input id="name" autoComplete="name" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} aria-invalid={!!errors.customerName} maxLength={80} />
              </Field>
              <Field label="Nomor WhatsApp" htmlFor="phone" required error={errors.phone} hint="Dipakai untuk konfirmasi & lacak pesanan">
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} maxLength={20} />
              </Field>
            </div>
          </Section>

          <Section n={2} title="Metode Penerimaan">
            <div className="grid gap-3 sm:grid-cols-2" data-error={!!errors.fulfillmentMethod}>
              <OptionCard active={form.fulfillmentMethod === "PICKUP"} disabled={!o.pickupEnabled} onClick={() => set("fulfillmentMethod", "PICKUP")} icon={<Store className="h-5 w-5" />} title="Pick Up" desc={o.pickupEnabled ? "Ambil langsung di Hakuu Bakery" : "Sedang tidak tersedia"} />
              <OptionCard
                active={form.fulfillmentMethod === "DELIVERY"}
                disabled={!o.deliveryEnabled}
                onClick={() => set("fulfillmentMethod", "DELIVERY")}
                icon={<Bike className="h-5 w-5" />}
                title="Delivery"
                desc={o.deliveryEnabled ? (o.deliveryFee > 0 ? `Diantar ke alamatmu · ongkir ${formatRupiah(o.deliveryFee)}` : "Diantar ke alamatmu") : "Sedang tidak tersedia"}
              />
            </div>
            {errors.fulfillmentMethod && <p className="mt-2 text-xs text-red-600">{errors.fulfillmentMethod}</p>}
            {form.fulfillmentMethod === "PICKUP" && (
              <div className="mt-4 flex gap-3 rounded-2xl bg-cream-100 p-4 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brown" />
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="font-semibold">Alamat pengambilan</p>
                  <p className="mt-0.5 whitespace-pre-line text-muted">{o.pickupAddress || "Alamat toko akan dikonfirmasi oleh admin melalui WhatsApp."}</p>
                  {o.pickupInstructions && <p className="mt-2 text-xs text-muted">{o.pickupInstructions}</p>}
                </div>
              </div>
            )}
            {form.fulfillmentMethod === "DELIVERY" && (
              <div className="mt-4 grid gap-4">
                <Field label="Alamat lengkap" htmlFor="addr" required error={errors.deliveryAddress} hint="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota">
                  <Textarea id="addr" autoComplete="street-address" value={form.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} aria-invalid={!!errors.deliveryAddress} maxLength={500} />
                </Field>
                <Field label="Patokan alamat" htmlFor="landmark" hint="Contoh: pagar hitam, sebelah masjid">
                  <Input id="landmark" value={form.addressLandmark} onChange={(e) => set("addressLandmark", e.target.value)} maxLength={200} />
                </Field>
                {o.deliveryNote && <Alert>{o.deliveryNote}</Alert>}
              </div>
            )}
          </Section>

          <Section n={3} title="Jadwal Pengambilan / Pengiriman">
            <p className="mb-3 text-sm text-muted">Pilih tanggal. Kapasitas produksi harian kami terbatas — tanggal yang penuh tidak dapat dipilih.</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Tanggal pengambilan atau pengiriman" data-error={!!errors.scheduledDate}>
              {o.days.map((d) => {
                const st = dayState(d);
                const active = form.scheduledDate === d.date;
                const dt = new Date(`${d.date}T00:00:00Z`);
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={st.disabled}
                    aria-pressed={active}
                    onClick={() => set("scheduledDate", d.date)}
                    className={cn(
                      "flex w-[4.6rem] shrink-0 flex-col items-center rounded-2xl border-2 px-2 py-2.5 transition",
                      active ? "border-maroon bg-maroon text-cream" : st.disabled ? "cursor-not-allowed border-line bg-cream-100 text-muted/60" : "border-line bg-white hover:border-caramel",
                    )}
                  >
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-80">{formatDateOnly(dt, { weekday: "short" })}</span>
                    <span className="font-display text-2xl leading-tight">{dt.getUTCDate()}</span>
                    <span className="text-[0.65rem]">{formatDateOnly(dt, { month: "short" })}</span>
                    <span className={cn("mt-1 text-[0.6rem] font-bold", active ? "text-caramel" : st.disabled ? "text-red-500/80" : "text-emerald-700")}>{st.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.scheduledDate && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CalendarX className="h-3.5 w-3.5" /> {errors.scheduledDate}
              </p>
            )}
            <p className="mt-5 mb-2 text-sm font-semibold">Waktu {form.fulfillmentMethod === "DELIVERY" ? "pengiriman" : "pengambilan"} <span className="text-red-600">*</span></p>
            <div className="flex flex-wrap gap-2" data-error={!!errors.scheduledTime}>
              {o.timeSlots.map((t) => (
                <button key={t} type="button" aria-pressed={form.scheduledTime === t} onClick={() => set("scheduledTime", t)} className={cn("min-h-11 rounded-full border-2 px-4 py-2 text-sm font-medium transition", form.scheduledTime === t ? "border-maroon bg-maroon text-cream" : "border-line hover:border-caramel")}>
                  {t}
                </button>
              ))}
            </div>
            {errors.scheduledTime && <p className="mt-1.5 text-xs text-red-600">{errors.scheduledTime}</p>}
            <Field label="Catatan tambahan (opsional)" htmlFor="notes" className="mt-5" hint="Contoh: tolong tulis ucapan, kurangi gula, dsb.">
              <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
            </Field>
          </Section>

          <Section n={4} title="Metode Pembayaran">
            <div className="grid gap-3 sm:grid-cols-2" data-error={!!errors.paymentMethod}>
              <OptionCard active={form.paymentMethod === "CASH"} disabled={!o.cashEnabled} onClick={() => set("paymentMethod", "CASH")} icon={<Banknote className="h-5 w-5" />} title="Cash" desc="Bayar saat mengambil / menerima pesanan" />
              <OptionCard active={form.paymentMethod === "TRANSFER"} disabled={!o.transferEnabled} onClick={() => set("paymentMethod", "TRANSFER")} icon={<Landmark className="h-5 w-5" />} title="Transfer Bank" desc={o.transferEnabled ? `Transfer & unggah bukti dalam ${o.paymentDeadlineHours} jam` : "Sedang tidak tersedia"} />
            </div>
            {errors.paymentMethod && <p className="mt-2 text-xs text-red-600">{errors.paymentMethod}</p>}
            {form.paymentMethod === "TRANSFER" && (
              <div className="mt-4 space-y-2" data-error={!!errors.bankAccountId}>
                <p className="text-sm font-semibold">Pilih rekening tujuan</p>
                {o.banks.map((b) => (
                  <label key={b.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition", form.bankAccountId === b.id ? "border-maroon bg-maroon-50" : "border-line hover:border-caramel")}>
                    <input type="radio" name="bank" className="shrink-0 accent-maroon" checked={form.bankAccountId === b.id} onChange={() => set("bankAccountId", b.id)} />
                    <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
                      <span className="font-bold">{b.bankName}</span> · {b.accountNumber}
                      <span className="block text-xs text-muted">a.n. {b.accountHolder}</span>
                    </span>
                  </label>
                ))}
                {errors.bankAccountId && <p className="text-xs text-red-600">{errors.bankAccountId}</p>}
                <p className="text-xs text-muted">Detail rekening & nominal akan ditampilkan lagi setelah pesanan dibuat.</p>
              </div>
            )}
          </Section>
        </div>

        <aside className="min-w-0 rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-2xl text-maroon">Ringkasan Pesanan</h2>
          <ul className="mt-5 space-y-3 border-b border-line pb-5 text-sm">
            {quote?.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="font-semibold">
                    {l.productName} <span className="font-normal text-muted">×{l.quantity}</span>
                  </p>
                  {l.variants.length > 0 && <p className="text-xs text-muted">{l.variants.map((v) => v.variantName).join(", ")}</p>}
                  {l.error && <p className="text-xs text-red-600">{l.error}</p>}
                </div>
                <span className="shrink-0 font-medium">{formatRupiah(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatRupiah(quote?.subtotal)}</dd></div>
            {form.fulfillmentMethod === "DELIVERY" && (
              <div className="flex justify-between"><dt className="text-muted">Ongkos kirim</dt><dd>{deliveryFee > 0 ? formatRupiah(deliveryFee) : "Gratis / sesuai ketentuan"}</dd></div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line pt-4">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold text-maroon">{formatRupiah(total)}</span>
          </div>
          {serverError && <Alert tone="danger" className="mt-4">{serverError}</Alert>}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={submitting} disabled={quote?.hasError}>
            Buat Pesanan
          </Button>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /> Total pembayaran dihitung ulang dan divalidasi oleh server Hakuu Bakery.
          </p>
        </aside>
      </div>
    </form>
  );
}
