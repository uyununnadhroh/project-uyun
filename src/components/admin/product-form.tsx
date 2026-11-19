"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, X, Star, Plus, Package, Croissant } from "lucide-react";
import { toast } from "sonner";
import { saveProduct, saveVariant } from "@/app/admin/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { cn, formatRupiah } from "@/lib/utils";

type Variant = { id: string; name: string; isActive: boolean };
export type ProductFormValue = {
  id?: string;
  name: string;
  categoryId: string;
  description: string;
  information: string;
  price: string;
  discountPrice: string;
  type: "REGULAR" | "PACKAGE";
  isAvailable: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  trackStock: boolean;
  stock: string;
  packageSize: string;
  allowDuplicateVariants: boolean;
  variantIds: string[];
  images: string[];
};

export function ProductForm({ initial, categories, variants: initialVariants }: { initial: ProductFormValue; categories: { id: string; name: string }[]; variants: Variant[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [variants, setVariants] = useState(initialVariants);
  const [existing, setExisting] = useState<string[]>(initial.images);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newVariant, setNewVariant] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const size = Math.max(0, Math.min(50, parseInt(v.packageSize || "0", 10) || 0));
  const selectedVariants = useMemo(() => variants.filter((x) => v.variantIds.includes(x.id)), [variants, v.variantIds]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: { file: File; url: string }[] = [];
    for (const f of Array.from(list)) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        toast.error(`${f.name}: format harus JPG, PNG, atau WEBP`);
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        toast.error(`${f.name}: ukuran maksimal 5 MB`);
        continue;
      }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setFiles((s) => [...s, ...next].slice(0, 8));
  }

  async function addVariant() {
    const name = newVariant.trim();
    if (name.length < 2) return toast.error("Nama varian minimal 2 karakter");
    const r = await saveVariant(null, { name, isActive: true, sortOrder: variants.length });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Varian ${name} ditambahkan`);
    setNewVariant("");
    router.refresh();
    // ambil daftar terbaru agar langsung bisa dicentang
    const res = await fetch(`/api/admin/variants`, { cache: "no-store" });
    if (res.ok) {
      const list: Variant[] = await res.json();
      setVariants(list);
      const created = list.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (created) set("variantIds", [...v.variantIds, created.id]);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    if (v.id) fd.set("id", v.id);
    const { images: _i, id: _id, ...data } = v;
    void _i;
    void _id;
    fd.set("data", JSON.stringify(data));
    fd.set("keepImages", JSON.stringify(existing));
    files.forEach((f) => fd.append("images", f.file));
    start(async () => {
      const r = await saveProduct(fd);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(v.id ? "Produk diperbarui" : "Produk ditambahkan");
      router.push("/admin/produk");
      router.refresh();
    });
  }

  const allImages = [...existing.map((url) => ({ url, kind: "existing" as const })), ...files.map((f) => ({ url: f.url, kind: "new" as const }))];

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-3" noValidate>
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Jenis produk" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[
              { k: "REGULAR" as const, icon: Croissant, t: "Produk biasa", d: "Roti satuan / produk dengan harga tetap" },
              { k: "PACKAGE" as const, icon: Package, t: "Paket", d: "Customer memilih varian untuk setiap isi paket" },
            ].map((o) => (
              <button type="button" key={o.k} onClick={() => set("type", o.k)} className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition", v.type === o.k ? "border-maroon bg-maroon-50" : "border-line hover:border-caramel")}>
                <o.icon className="mt-0.5 h-5 w-5 text-maroon" />
                <span>
                  <span className="block font-semibold">{o.t}</span>
                  <span className="text-xs text-muted">{o.d}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Informasi produk" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={v.type === "PACKAGE" ? "Nama paket" : "Nama produk"} required error={errors.name} className="sm:col-span-2">
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder={v.type === "PACKAGE" ? "Paket Hemat Isi 2" : "Roti Cokelat"} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Kategori" required error={errors.categoryId}>
              <Select value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} aria-invalid={!!errors.categoryId}>
                <option value="">Pilih kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <div />
            <Field label={v.type === "PACKAGE" ? "Harga paket (Rp)" : "Harga normal (Rp)"} required error={errors.price}>
              <Input inputMode="numeric" value={v.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} placeholder="25000" aria-invalid={!!errors.price} />
            </Field>
            <Field label="Harga diskon (opsional)" error={errors.discountPrice} hint={v.discountPrice && v.price ? `Customer membayar ${formatRupiah(+v.discountPrice)}` : "Kosongkan bila tidak ada diskon"}>
              <Input inputMode="numeric" value={v.discountPrice} onChange={(e) => set("discountPrice", e.target.value.replace(/\D/g, ""))} aria-invalid={!!errors.discountPrice} />
            </Field>
            <Field label="Deskripsi" className="sm:col-span-2" error={errors.description}>
              <Textarea value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={3000} />
            </Field>
            <Field label="Informasi produk (opsional)" className="sm:col-span-2" hint="Komposisi, berat, ketahanan, alergen, cara penyimpanan, dsb.">
              <Textarea value={v.information} onChange={(e) => set("information", e.target.value)} rows={3} maxLength={3000} />
            </Field>
          </div>
        </Card>

        {v.type === "PACKAGE" && (
          <Card className="border-maroon/30">
            <CardHeader title="Konfigurasi paket" description="Jumlah slot pilihan yang tampil ke customer otomatis mengikuti jumlah isi paket." />
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jumlah isi paket" required error={errors.packageSize} hint="Contoh: 2, 3, 4, 6">
                  <Input type="number" min={2} max={50} value={v.packageSize} onChange={(e) => set("packageSize", e.target.value)} aria-invalid={!!errors.packageSize} />
                </Field>
                <div className="sm:pt-6">
                  <Switch checked={v.allowDuplicateVariants} onChange={(b) => set("allowDuplicateVariants", b)} label="Varian boleh dipilih berulang" description="Contoh: 2× Cokelat dalam satu paket" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Varian yang dapat dipilih <span className="text-red-600">*</span></p>
                  <div className="flex gap-3 text-xs">
                    <button type="button" className="font-semibold text-maroon hover:underline" onClick={() => set("variantIds", variants.filter((x) => x.isActive).map((x) => x.id))}>Pilih semua</button>
                    <button type="button" className="text-muted hover:underline" onClick={() => set("variantIds", [])}>Kosongkan</button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {variants.map((x) => {
                    const checked = v.variantIds.includes(x.id);
                    return (
                      <label key={x.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition", checked ? "border-maroon bg-maroon-50" : "border-line hover:border-caramel", !x.isActive && "opacity-55")}>
                        <input type="checkbox" className="h-4 w-4 accent-maroon" checked={checked} onChange={() => set("variantIds", checked ? v.variantIds.filter((i) => i !== x.id) : [...v.variantIds, x.id])} />
                        <span className="flex-1">{x.name}</span>
                        {!x.isActive && <span className="text-[0.65rem] text-muted">nonaktif</span>}
                      </label>
                    );
                  })}
                </div>
                {errors.variantIds && <p className="mt-2 text-xs text-red-600">{errors.variantIds}</p>}
                <div className="mt-3 flex gap-2">
                  <Input value={newVariant} onChange={(e) => setNewVariant(e.target.value)} placeholder="Tambah varian baru, mis. Matcha" className="h-10" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVariant())} />
                  <Button type="button" variant="outline" onClick={addVariant}><Plus className="h-4 w-4" /> Tambah</Button>
                </div>
                <p className="mt-2 text-xs text-muted">Ubah / hapus varian di menu <Link href="/admin/varian" className="font-semibold underline">Varian Paket</Link>. Batas pemilihan per varian dapat diatur setelah produk disimpan.</p>
              </div>
              <div className="rounded-2xl bg-cream-100 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Preview untuk customer</p>
                {size >= 2 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: size }).map((_, i) => (
                      <div key={i}>
                        <p className="mb-1 text-xs font-semibold text-muted">Pilihan {i + 1}</p>
                        <Select disabled className="h-9 text-xs">
                          <option>— {selectedVariants.length ? selectedVariants.map((s) => s.name).join(" / ") : "belum ada varian"} —</option>
                        </Select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">Isi jumlah isi paket (min. 2) untuk melihat slot pilihan.</p>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Foto produk" description="JPG, PNG, atau WEBP · maks 5 MB per foto · foto pertama menjadi cover" />
          <div className="p-5">
            <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {allImages.map((img, i) => (
                <div key={img.url} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-cream-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-maroon px-2 py-0.5 text-[0.6rem] font-bold text-cream">COVER</span>}
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    {i > 0 && img.kind === "existing" && (
                      <button type="button" title="Jadikan cover" onClick={() => setExisting((s) => [img.url, ...s.filter((u) => u !== img.url)])} className="grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow"><Star className="h-3.5 w-3.5" /></button>
                    )}
                    <button type="button" title="Hapus" onClick={() => (img.kind === "existing" ? setExisting((s) => s.filter((u) => u !== img.url)) : setFiles((s) => s.filter((f) => f.url !== img.url)))} className="grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {img.kind === "new" && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-caramel px-2 py-0.5 text-[0.6rem] font-bold text-maroon">BARU</span>}
                </div>
              ))}
              <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand text-xs font-semibold text-muted hover:border-caramel hover:text-maroon">
                <ImagePlus className="h-6 w-6" /> Tambah foto
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6">
        <Card>
          <CardHeader title="Status" />
          <div className="space-y-3 p-5">
            <Switch checked={v.isPublished} onChange={(b) => set("isPublished", b)} label="Publikasi (aktif)" description="Tampilkan produk di katalog" />
            <Switch checked={v.isAvailable} onChange={(b) => set("isAvailable", b)} label="Tersedia" description="Matikan untuk menandai habis" />
            <Switch checked={v.isFeatured} onChange={(b) => set("isFeatured", b)} label="Produk unggulan" description="Prioritas tampil di Best Seller" />
            <Switch checked={v.trackStock} onChange={(b) => set("trackStock", b)} label="Gunakan sistem stok" description="Stok berkurang otomatis saat pesanan dibuat & kembali saat batal" />
            {v.trackStock && (
              <Field label="Jumlah stok" error={errors.stock}>
                <Input type="number" min={0} value={v.stock} onChange={(e) => set("stock", e.target.value)} aria-invalid={!!errors.stock} />
              </Field>
            )}
          </div>
        </Card>
        {Object.values(errors).some(Boolean) && <Alert tone="danger">Periksa kembali isian yang ditandai.</Alert>}
        <div className="flex gap-2">
          <Link href="/admin/produk" className={buttonClass("outline", "lg", "flex-1")}>Batal</Link>
          <Button type="submit" size="lg" className="flex-1" loading={pending}>Simpan</Button>
        </div>
      </div>
    </form>
  );
}
