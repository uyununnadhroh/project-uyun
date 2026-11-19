"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/input";

type Filter = { name: string; label: string; options: { value: string; label: string }[] };

/** Bar pencarian + filter yang disinkronkan ke URL (dapat dibagikan / di-refresh) */
export function AdminSearch({ placeholder = "Cari…", filters = [], children }: { placeholder?: string; filters?: Filter[]; children?: React.ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    next.delete("page");
    start(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }
  useEffect(() => {
    const t = setTimeout(() => (sp.get("q") ?? "") !== q.trim() && update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-3 shadow-soft md:flex-row md:flex-wrap md:items-center">
      <div className="relative min-w-60 flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-line pr-9 pl-9 text-sm focus:border-caramel focus:outline-none" />
        {pending && <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      {filters.map((f) => (
        <Select key={f.name} value={sp.get(f.name) ?? ""} onChange={(e) => update({ [f.name]: e.target.value || null })} className="h-10 md:w-48">
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ))}
      {children}
    </div>
  );
}
