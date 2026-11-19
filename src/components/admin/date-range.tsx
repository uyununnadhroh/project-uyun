"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DateRangeInputs({ fromKey = "dari", toKey = "sampai" }: { fromKey?: string; toKey?: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    v ? n.set(k, v) : n.delete(k);
    n.delete("page");
    router.replace(`${pathname}?${n}`, { scroll: false });
  };
  const cls = "h-10 rounded-xl border border-line px-3 text-sm focus:border-caramel focus:outline-none";
  return (
    <div className="flex items-center gap-2 text-sm">
      <input type="date" aria-label="Dari tanggal" className={cls} value={sp.get(fromKey) ?? ""} onChange={(e) => set(fromKey, e.target.value)} />
      <span className="text-muted">–</span>
      <input type="date" aria-label="Sampai tanggal" className={cls} value={sp.get(toKey) ?? ""} onChange={(e) => set(toKey, e.target.value)} />
    </div>
  );
}
