"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct, toggleProductField } from "@/app/admin/actions";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const toggleLabels = { isPublished: "Publikasi", isAvailable: "Tersedia", isFeatured: "Unggulan" };

export function ProductToggle({ id, field, value }: { id: string; field: "isPublished" | "isAvailable" | "isFeatured"; value: boolean }) {
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  return (
    <button
      role="switch"
      aria-label={toggleLabels[field]}
      aria-checked={v}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setV(!v);
          const r = await toggleProductField(id, field, !v);
          if (!r.ok) {
            setV(v);
            toast.error(r.error);
          }
        })
      }
      className={cn("relative inline-block h-6 w-11 rounded-full transition disabled:opacity-60", v ? "bg-maroon" : "bg-sand")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", v ? "left-5.5" : "left-0.5")} />
    </button>
  );
}

export function ProductRowActions({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex justify-end gap-1">
      <Link href={`/admin/produk/${id}`} className="rounded-full p-2 text-muted hover:bg-cream-200 hover:text-maroon" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
      <button onClick={() => setOpen(true)} className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Hapus ${name}?`}
        description="Produk akan dihapus dari katalog. Riwayat pesanan yang memuat produk ini tetap tersimpan."
        tone="danger"
        confirmText="Hapus produk"
        loading={pending}
        onConfirm={() =>
          start(async () => {
            const r = await deleteProduct(id);
            if (r.ok) {
              toast.success("Produk dihapus");
              setOpen(false);
              router.refresh();
            } else toast.error(r.error);
          })
        }
      />
    </div>
  );
}
