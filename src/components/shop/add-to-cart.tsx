"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./cart-context";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn, formatRupiah } from "@/lib/utils";

type Variant = { id: string; name: string; max: number | null };
type Props = {
  product: {
    id: string;
    name: string;
    price: number;
    type: "REGULAR" | "PACKAGE";
    packageSize: number;
    allowDuplicate: boolean;
    available: boolean;
    maxQty: number;
    variants: Variant[];
  };
};

export function QtyStepper({ value, onChange, max = 999, size = "md" }: { value: number; onChange: (n: number) => void; max?: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-9" : "h-12";
  const [displayValue, setDisplayValue] = useState(value.toString());
  const inputWidth = value >= 100 ? "w-14" : value >= 10 ? "w-10" : "w-8";
  
  // Sync displayValue dengan value dari parent
  useEffect(() => {
    setDisplayValue(value.toString());
  }, [value]);
  
  return (
    <div className={cn("inline-flex items-center rounded-full border border-line bg-white", h)}>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className={cn("grid aspect-square h-full place-items-center rounded-full text-maroon hover:bg-cream-100 disabled:opacity-30")} aria-label="Kurangi">
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        value={displayValue}
        inputMode="numeric"
        onChange={(e) => {
          const rawValue = e.target.value.replace(/\D/g, "");
          setDisplayValue(rawValue);
          
          // Jika ada angka valid, update parent
          if (rawValue !== "") {
            const n = parseInt(rawValue, 10);
            if (Number.isFinite(n) && n >= 1) {
              onChange(Math.min(max, n));
            }
          }
        }}
        onFocus={(e) => {
          // Select semua saat fokus biar gampang ganti
          e.target.select();
        }}
        onBlur={() => {
          // Saat blur, kalau kosong atau invalid, reset ke 1
          const n = parseInt(displayValue, 10);
          if (!Number.isFinite(n) || n < 1) {
            onChange(1);
            setDisplayValue("1");
          } else {
            // Pastikan displayValue sync dengan value yang sudah di-cap
            setDisplayValue(Math.min(max, n).toString());
          }
        }}
        className={cn("bg-transparent text-center text-sm font-bold focus:outline-none transition-all", inputWidth)}
        aria-label="Jumlah"
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid aspect-square h-full place-items-center rounded-full text-maroon hover:bg-cream-100 disabled:opacity-30" aria-label="Tambah">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AddToCart({ product }: Props) {
  const cart = useCart();
  const router = useRouter();
  const isPackage = product.type === "PACKAGE";
  // Jumlah slot otomatis mengikuti jumlah isi paket — tidak di-hardcode
  const [slots, setSlots] = useState<string[]>(() => Array(isPackage ? product.packageSize : 0).fill(""));
  const [qty, setQty] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) if (s) m.set(s, (m.get(s) ?? 0) + 1);
    return m;
  }, [slots]);

  const filled = slots.filter(Boolean).length;
  const complete = !isPackage || filled === product.packageSize;
  const maxQty = Math.max(1, product.maxQty);

  function optionDisabled(slotIndex: number, v: Variant) {
    if (slots[slotIndex] === v.id) return false;
    const used = counts.get(v.id) ?? 0;
    if (!product.allowDuplicate && used >= 1) return true;
    if (v.max && used >= v.max) return true;
    return false;
  }

  function add(goToCart = false) {
    if (!product.available) return;
    if (!complete) {
      setShowErrors(true);
      toast.error(`Pilih semua ${product.packageSize} varian terlebih dahulu (${filled}/${product.packageSize} terpilih).`);
      return;
    }
    cart.add({ productId: product.id, quantity: qty, variants: isPackage ? slots : [] });
    toast.success(`${product.name} ditambahkan ke keranjang`, {
      description: isPackage ? slots.map((id) => product.variants.find((v) => v.id === id)?.name).join(", ") : undefined,
      action: { label: "Lihat keranjang", onClick: () => router.push("/keranjang") },
    });
    if (isPackage) setSlots(Array(product.packageSize).fill(""));
    setQty(1);
    setShowErrors(false);
    if (goToCart) router.push("/keranjang");
  }

  if (!product.available)
    return <div className="rounded-2xl border border-line bg-cream-100 px-5 py-4 text-sm text-muted">Produk ini sedang habis. Silakan cek kembali nanti atau pilih menu lainnya.</div>;

  if (isPackage && product.variants.length === 0)
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">Varian untuk paket ini sedang tidak tersedia.</div>;

  return (
    <div className="space-y-6">
      {isPackage && (
        <div className="rounded-3xl border border-line bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl text-maroon">Pilih isi paket</p>
              <p className="mt-1 text-sm text-muted">
                Pilih {product.packageSize} roti dari varian yang tersedia.{" "}
                {product.allowDuplicate ? "Varian yang sama boleh dipilih lebih dari sekali." : "Setiap varian hanya dapat dipilih sekali."}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold", complete ? "bg-emerald-50 text-emerald-700" : "bg-cream-200 text-maroon")}>
              {filled}/{product.packageSize}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {slots.map((val, i) => {
              const invalid = showErrors && !val;
              return (
                <div key={i}>
                  <label htmlFor={`slot-${i}`} className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                    <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[0.65rem]", val ? "bg-maroon text-cream" : "bg-cream-200 text-maroon")}>{val ? <Check className="h-3 w-3" /> : i + 1}</span>
                    Pilihan {i + 1}
                  </label>
                  <Select
                    id={`slot-${i}`}
                    value={val}
                    aria-invalid={invalid}
                    onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                  >
                    <option value="">— Pilih varian roti —</option>
                    {product.variants.map((v) => (
                      <option key={v.id} value={v.id} disabled={optionDisabled(i, v)}>
                        {v.name}
                        {v.max ? ` (maks ${v.max})` : ""}
                      </option>
                    ))}
                  </Select>
                  {invalid && <p className="mt-1 text-xs text-red-600">Wajib dipilih</p>}
                </div>
              );
            })}
          </div>
          {filled > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...counts.entries()].map(([id, n]) => (
                <span key={id} className="rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold text-maroon">
                  {product.variants.find((v) => v.id === id)?.name} ×{n}
                </span>
              ))}
              <button type="button" className="px-2 text-xs font-semibold text-muted underline-offset-2 hover:underline" onClick={() => setSlots(Array(product.packageSize).fill(""))}>
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QtyStepper value={qty} onChange={setQty} max={maxQty} />
        <p className="text-sm text-muted">
          Subtotal <span className="font-bold text-espresso">{formatRupiah(product.price * qty)}</span>
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={() => add(false)}>
          <ShoppingBag className="h-4.5 w-4.5" /> Tambahkan ke Keranjang
        </Button>
        <Button size="lg" variant="outline" className="flex-1" onClick={() => add(true)}>
          Beli Sekarang
        </Button>
      </div>
    </div>
  );
}
