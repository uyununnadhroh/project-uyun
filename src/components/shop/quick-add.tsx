"use client";
import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./cart-context";
import { cn } from "@/lib/utils";

export function QuickAdd({ productId, name, slug, isPackage, disabled }: { productId: string; name: string; slug: string; isPackage: boolean; disabled?: boolean }) {
  const cart = useCart();
  const cls = "grid h-10 w-10 shrink-0 place-items-center rounded-full transition";
  if (disabled) return <span className={cn(cls, "bg-cream-200 text-muted/60")} aria-label="Habis"><Plus className="h-5 w-5" /></span>;
  if (isPackage)
    return (
      <Link href={`/menu/${slug}`} className={cn(cls, "bg-cream-200 text-maroon hover:bg-maroon hover:text-cream")} aria-label={`Pilih varian ${name}`} title="Pilih varian">
        <SlidersHorizontal className="h-4.5 w-4.5" />
      </Link>
    );
  return (
    <button
      type="button"
      onClick={() => {
        cart.add({ productId, quantity: 1, variants: [] });
        toast.success(`${name} ditambahkan ke keranjang`, { action: { label: "Lihat", onClick: () => (window.location.href = "/keranjang") } });
      }}
      className={cn(cls, "bg-maroon text-cream hover:bg-maroon-600 active:scale-95")}
      aria-label={`Tambah ${name} ke keranjang`}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
