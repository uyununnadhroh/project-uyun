"use client";
import Link from "next/link";
import { ShoppingBag, Trash2, ArrowRight, AlertCircle } from "lucide-react";
import { useCart } from "@/components/shop/cart-context";
import { useQuote } from "@/components/shop/use-quote";
import { QtyStepper } from "@/components/shop/add-to-cart";
import { ProductImage } from "@/components/shop/product-image";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { formatRupiah, cn } from "@/lib/utils";
import { useState } from "react";

export default function CartPage() {
  const cart = useCart();
  const { quote, error, loading } = useQuote(cart.lines, cart.ready);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="container-page pt-6 pb-10 sm:pt-10">
      <p className="eyebrow">Keranjang</p>
      <h1 className="mt-3 text-4xl text-maroon sm:text-5xl">Pesananmu</h1>

      {!cart.ready || (loading && !quote) ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : error ? (
        <div className="mt-8"><ErrorState description={error} action={<button className={buttonClass("outline")} onClick={() => location.reload()}>Muat ulang</button>} /></div>
      ) : !cart.lines.length ? (
        <EmptyState
          className="mt-8"
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Keranjang masih kosong"
          description="Yuk pilih roti favoritmu dari menu Hakuu Bakery."
          action={<Link href="/menu" className={buttonClass("primary")}>Lihat Menu</Link>}
        />
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-3">
          <ul className="space-y-3 lg:col-span-2">
            {cart.lines.map((line, i) => {
              const q = quote?.lines[i];
              return (
                <li key={i} className={cn("flex gap-4 rounded-3xl border bg-white p-3 shadow-soft sm:p-4", q?.error ? "border-red-200" : "border-line")}>
                  <Link href={q?.productSlug ? `/menu/${q.productSlug}` : "#"} className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-cream-100 sm:h-28 sm:w-28">
                    <ProductImage src={q?.imageUrl} alt={q?.productName ?? ""} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg leading-snug text-espresso">{q?.productName ?? "…"}</h3>
                        <p className="text-sm text-muted">{formatRupiah(q?.unitPrice)} / {q?.productType === "PACKAGE" ? "paket" : "pcs"}</p>
                      </div>
                      <button onClick={() => cart.remove(i)} className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {q && q.variants.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {q.variants.map((v) => (
                          <span key={v.slotNumber} className="rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-medium text-maroon">
                            {v.slotNumber}. {v.variantName}
                          </span>
                        ))}
                      </div>
                    )}
                    {q?.error && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {q.error}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <QtyStepper size="sm" value={line.quantity} onChange={(n) => cart.setQuantity(i, n)} max={q?.maxQty || 999} />
                      <p className="font-bold text-maroon">{formatRupiah(q?.lineTotal)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
            <li className="flex justify-between px-1 pt-1">
              <Link href="/menu" className="text-sm font-semibold text-maroon hover:underline">+ Tambah menu lain</Link>
              <button className="text-sm text-muted hover:text-red-600" onClick={() => setConfirmClear(true)}>Kosongkan keranjang</button>
            </li>
          </ul>

          <aside className="rounded-3xl border border-line bg-white p-6 shadow-soft lg:sticky lg:top-28">
            <h2 className="font-display text-2xl text-maroon">Ringkasan</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal ({cart.count} item)</dt><dd className="font-semibold">{formatRupiah(quote?.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Ongkos kirim</dt><dd className="text-muted">Dihitung saat checkout</dd></div>
            </dl>
            <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold text-maroon">{formatRupiah(quote?.subtotal)}</span>
            </div>
            {quote?.hasError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">Perbaiki item yang ditandai merah sebelum checkout.</p>}
            <Link
              href="/checkout"
              aria-disabled={quote?.hasError || loading}
              className={cn(buttonClass("primary", "lg", "mt-5 w-full"), (quote?.hasError || loading) && "pointer-events-none opacity-50")}
            >
              Checkout <ArrowRight className="h-4.5 w-4.5" />
            </Link>
            <p className="mt-3 text-center text-xs text-muted">Harga final dihitung & divalidasi oleh sistem saat pesanan dibuat.</p>
          </aside>
        </div>
      )}
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Kosongkan keranjang?"
        description="Semua item di keranjang akan dihapus."
        tone="danger"
        confirmText="Kosongkan"
        onConfirm={() => {
          cart.clear();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}
