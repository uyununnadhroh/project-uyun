"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPackageVariantLimit } from "@/app/admin/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Aturan lanjutan: batas berapa kali sebuah varian boleh dipilih dalam satu paket */
export function PackageLimits({ productId, packageSize, options }: { productId: string; packageSize: number; options: { variantId: string; name: string; max: number | null }[] }) {
  const [vals, setVals] = useState(() => Object.fromEntries(options.map((o) => [o.variantId, o.max ? String(o.max) : ""])));
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Aturan pemilihan varian" description={`Batas maksimal per varian dalam satu paket (kosong = mengikuti aturan duplikat). Isi paket: ${packageSize}.`} />
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {options.map((o) => (
          <label key={o.variantId} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
            {o.name}
            <input type="number" min={1} max={packageSize} placeholder="—" value={vals[o.variantId]} onChange={(e) => setVals((s) => ({ ...s, [o.variantId]: e.target.value }))} className="h-8 w-16 rounded-lg border border-line px-2 text-right" />
          </label>
        ))}
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              for (const o of options) {
                const r = await setPackageVariantLimit(productId, o.variantId, vals[o.variantId] ? parseInt(vals[o.variantId], 10) : null);
                if (!r.ok) return void toast.error(r.error);
              }
              toast.success("Aturan varian disimpan");
            })
          }
        >
          Simpan aturan
        </Button>
      </div>
    </Card>
  );
}
