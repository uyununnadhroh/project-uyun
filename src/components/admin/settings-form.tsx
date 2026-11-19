"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { StoreSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/admin/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/input";
import { cn, displayPhone } from "@/lib/utils";

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function SettingsForm({ initial }: { initial: StoreSettings }) {
  const router = useRouter();
  const [s, setS] = useState({ ...initial, whatsappNumber: initial.whatsappNumber ? displayPhone(initial.whatsappNumber) : "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slot, setSlot] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const text = (k: keyof StoreSettings, label: string, opts: { hint?: string; area?: boolean; placeholder?: string; className?: string } = {}) => (
    <Field label={label} error={errors[k]} hint={opts.hint} className={opts.className}>
      {opts.area ? (
        <Textarea value={String(s[k] ?? "")} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value as never)} />
      ) : (
        <Input value={String(s[k] ?? "")} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k]} />
      )}
    </Field>
  );

  function save() {
    start(async () => {
      const r = await saveSettingsAction(s);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(r.error);
        return;
      }
      toast.success("Pengaturan disimpan");
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader title="Profil & tampilan website" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {text("storeName", "Nama toko")}
          {text("heroHeadline", "Headline hero", { hint: "Pisahkan dengan koma untuk baris kedua bergaya miring" })}
          {text("heroDescription", "Deskripsi hero", { area: true, className: "sm:col-span-2" })}
          {text("aboutTitle", "Judul About Us")}
          <div />
          {text("aboutText", "Cerita About Us", { area: true, className: "sm:col-span-2", hint: "Pisahkan paragraf dengan baris kosong" })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Kontak & WhatsApp" description="Nomor WhatsApp dipakai untuk semua tombol Click-to-Chat di website." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {text("whatsappNumber", "Nomor WhatsApp Business", { placeholder: "08xxxxxxxxxx" })}
          {text("instagram", "Instagram", { placeholder: "hakuubakery" })}
          {text("email", "Email (opsional)")}
          {text("mapsUrl", "Link Google Maps (opsional)", { placeholder: "https://maps.app.goo.gl/…" })}
          {text("address", "Alamat usaha / pengambilan", { area: true })}
          {text("operatingHours", "Jam operasional", { area: true, placeholder: "Senin – Sabtu: 08.00 – 17.00\nMinggu: Tutup" })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Metode penerimaan" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Switch checked={s.pickupEnabled} onChange={(b) => set("pickupEnabled", b)} label="Pick Up" description="Customer mengambil di toko" />
          <Switch checked={s.deliveryEnabled} onChange={(b) => set("deliveryEnabled", b)} label="Delivery" description="Diantar ke alamat customer" />
          {text("pickupInstructions", "Instruksi pengambilan", { area: true })}
          <div className="space-y-4">
            <Field label="Biaya pengiriman (Rp, flat)" error={errors.deliveryFee} hint="Isi 0 bila gratis / ditentukan terpisah">
              <Input inputMode="numeric" value={String(s.deliveryFee)} onChange={(e) => set("deliveryFee", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </Field>
            {text("deliveryNote", "Keterangan pengiriman", { hint: "Ditampilkan saat customer memilih delivery" })}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pembayaran" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Switch checked={s.cashEnabled} onChange={(b) => set("cashEnabled", b)} label="Cash" description="Bayar saat ambil / terima" />
          <Switch checked={s.transferEnabled} onChange={(b) => set("transferEnabled", b)} label="Transfer Bank" description="Butuh minimal 1 rekening aktif" />
          <Field label="Batas waktu pembayaran transfer (jam)" error={errors.paymentDeadlineHours} hint="Pesanan transfer otomatis dibatalkan bila lewat batas & belum ada bukti">
            <Input type="number" min={1} max={168} value={s.paymentDeadlineHours} onChange={(e) => set("paymentDeadlineHours", Number(e.target.value))} />
          </Field>
          <Switch checked={s.ocrEnabled} onChange={(b) => set("ocrEnabled", b)} label="OCR bukti transfer" description="Membaca nominal/tanggal sebagai alat bantu verifikasi" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Jadwal & kapasitas produksi" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Pesan paling cepat (H+)" hint="0 = bisa untuk hari ini" error={errors.minLeadDays}>
            <Input type="number" min={0} max={30} value={s.minLeadDays} onChange={(e) => set("minLeadDays", Number(e.target.value))} />
          </Field>
          <Field label="Pesan paling jauh (hari ke depan)" error={errors.maxAdvanceDays}>
            <Input type="number" min={1} max={90} value={s.maxAdvanceDays} onChange={(e) => set("maxAdvanceDays", Number(e.target.value))} />
          </Field>
          <Field label="Kapasitas default per hari (pcs)" hint="0 = tanpa batas. Paket dihitung sesuai jumlah isinya." error={errors.defaultDailyCapacity}>
            <Input type="number" min={0} value={s.defaultDailyCapacity} onChange={(e) => set("defaultDailyCapacity", Number(e.target.value))} />
          </Field>
          <div className="sm:col-span-3">
            <p className="mb-2 text-sm font-semibold">Hari libur rutin</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => {
                const on = s.closedWeekdays.includes(i);
                return (
                  <button key={d} type="button" onClick={() => set("closedWeekdays", on ? s.closedWeekdays.filter((x) => x !== i) : [...s.closedWeekdays, i])} className={cn("rounded-full border-2 px-4 py-1.5 text-sm", on ? "border-red-300 bg-red-50 text-red-700" : "border-line")}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-3">
            <p className="mb-2 text-sm font-semibold">Pilihan waktu pengambilan / pengiriman</p>
            <div className="flex flex-wrap gap-2">
              {s.timeSlots.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-cream-200 py-1.5 pr-1.5 pl-3.5 text-sm">
                  {t}
                  <button type="button" onClick={() => set("timeSlots", s.timeSlots.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-white" aria-label={`Hapus ${t}`}><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex max-w-sm gap-2">
              <Input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="17:00 - 19:00" className="h-10" />
              <Button variant="outline" onClick={() => { if (slot.trim().length >= 3 && !s.timeSlots.includes(slot.trim())) { set("timeSlots", [...s.timeSlots, slot.trim()]); setSlot(""); } }}><Plus className="h-4 w-4" /> Tambah</Button>
            </div>
            {errors.timeSlots && <p className="mt-1 text-xs text-red-600">{errors.timeSlots}</p>}
          </div>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="lg" loading={pending} onClick={save} className="shadow-lift">Simpan Pengaturan</Button>
      </div>
    </>
  );
}
