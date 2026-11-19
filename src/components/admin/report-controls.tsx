"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FileSpreadsheet, FileText, Printer, Search, Loader2 } from "lucide-react";
import { cn, todayWIB } from "@/lib/utils";

const PERIODS = [
  { k: "daily", l: "Harian" },
  { k: "weekly", l: "Mingguan" },
  { k: "monthly", l: "Bulanan" },
  { k: "yearly", l: "Tahunan" },
  { k: "custom", l: "Rentang" },
];

export function ReportControls() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const period = sp.get("periode") ?? "monthly";

  const update = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    start(() => router.replace(`${pathname}?${n}`, { scroll: false }));
  };
  useEffect(() => {
    const t = setTimeout(() => (sp.get("q") ?? "") !== q.trim() && update({ q: q.trim() || null }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const qs = sp.toString();
  const input = "h-10 rounded-xl border border-line bg-white px-3 text-sm focus:border-caramel focus:outline-none";
  const btn = "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-caramel";

  return (
    <div className="no-print space-y-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full bg-cream-100 p-1">
          {PERIODS.map((p) => (
            <button key={p.k} onClick={() => update({ periode: p.k })} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", period === p.k ? "bg-maroon text-cream" : "text-muted hover:text-maroon")}>{p.l}</button>
          ))}
        </div>
        {period === "daily" && <input type="date" className={input} value={sp.get("tanggal") ?? todayWIB()} onChange={(e) => update({ tanggal: e.target.value })} aria-label="Tanggal" />}
        {period === "custom" && (
          <>
            <input type="date" className={input} value={sp.get("dari") ?? ""} onChange={(e) => update({ dari: e.target.value })} aria-label="Dari" />
            <span className="text-muted">–</span>
            <input type="date" className={input} value={sp.get("sampai") ?? ""} onChange={(e) => update({ sampai: e.target.value })} aria-label="Sampai" />
          </>
        )}
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari transaksi: no. pesanan, customer, produk…" className={cn(input, "w-full pl-9")} />
        </div>
        <a href={`/api/admin/reports/export?format=xlsx&${qs}`} className={btn}><FileSpreadsheet className="h-4 w-4 text-emerald-700" /> Excel</a>
        <a href={`/api/admin/reports/export?format=pdf&${qs}`} className={btn}><FileText className="h-4 w-4 text-red-700" /> PDF</a>
        <a href={`/admin/laporan-cetak?${qs}`} target="_blank" className={btn}><Printer className="h-4 w-4" /> Cetak</a>
      </div>
    </div>
  );
}
