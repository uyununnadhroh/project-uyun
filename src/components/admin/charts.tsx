"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import { formatRupiah } from "@/lib/utils";

const MAROON = "#651a23";
const GRID = "#efe5d8";
const AXIS = { fontSize: 11, fill: "#7a685c" };

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (n >= 1000) return `${Math.round(n / 1000)}rb`;
  return String(n);
}

function TipBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="text-muted">{title}</p>
      <p className="mt-0.5 font-bold text-espresso">{value}</p>
    </div>
  );
}

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });

export function RevenueAreaChart({ data, height = 260 }: { data: { day: string; revenue: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MAROON} stopOpacity={0.22} />
            <stop offset="100%" stopColor={MAROON} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="day" tickFormatter={dayLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={compact} tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip cursor={{ stroke: "#c4865c", strokeDasharray: "3 3" }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={dayLabel(String(label))} value={formatRupiah(Number(payload[0].value))} /> : null)} />
        <Area type="monotone" dataKey="revenue" stroke={MAROON} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBarChart({ data, height = 260, valueKey = "revenue", money = true }: { data: { month: string; [k: string]: number | string }[]; height?: number; valueKey?: string; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={money ? compact : undefined} allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip cursor={{ fill: "#f6efe5" }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={monthLabel(String(label))} value={money ? formatRupiah(Number(payload[0].value)) : `${payload[0].value} pesanan`} /> : null)} />
        <Bar dataKey={valueKey} fill={MAROON} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyCountChart({ data, height = 240 }: { data: { day: string; orders: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="day" tickFormatter={dayLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
        <Tooltip cursor={{ fill: "#f6efe5" }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={dayLabel(String(label))} value={`${payload[0].value} pesanan`} /> : null)} />
        <Bar dataKey="orders" fill={MAROON} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Produk terlaris: bar horizontal dengan label nama & jumlah (bukan pie) */
export function TopProductsBars({ data }: { data: { name: string; qty: number }[] }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted">Belum ada produk terjual pada periode ini.</p>;
  const max = Math.max(...data.map((d) => d.qty), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.name} className="group" title={`${d.name}: ${d.qty} terjual`}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate font-medium text-espresso">{d.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-espresso">{d.qty.toLocaleString("id-ID")}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-cream-200">
            <div className="h-2 rounded-full bg-maroon-600 transition-all group-hover:bg-maroon" style={{ width: `${Math.max(3, (d.qty / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
