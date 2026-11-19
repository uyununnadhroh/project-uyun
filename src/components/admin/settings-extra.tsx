"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ImagePlus } from "lucide-react";
import { changePassword, createAdminUser, deleteCapacity, saveCapacity, toggleAdminUser, uploadHeroImage } from "@/app/admin/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateOnly, formatDateTime } from "@/lib/utils";

export function HeroUploader({ current }: { current: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const send = (fd: FormData) =>
    start(async () => {
      const r = await uploadHeroImage(fd);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Foto hero diperbarui");
      router.refresh();
    });
  return (
    <Card>
      <CardHeader title="Foto hero homepage" description="Foto roti berkualitas tinggi (rasio potret 4:5 ideal). Tanpa foto, hero menampilkan monogram Hakuu." />
      <div className="flex flex-wrap items-center gap-5 p-5">
        <div className="arch h-40 w-32 overflow-hidden bg-maroon">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="" className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/mark-gold.png" alt="" className="mx-auto mt-12 w-14" />
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.set("file", f); send(fd); } e.target.value = ""; }} />
        <div className="flex gap-2">
          <Button variant="outline" loading={pending} onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" /> {current ? "Ganti foto" : "Unggah foto"}</Button>
          {current && <Button variant="ghost" onClick={() => { const fd = new FormData(); fd.set("remove", "1"); send(fd); }}>Hapus</Button>}
        </div>
      </div>
    </Card>
  );
}

type Day = { date: string; capacity: number | null; used: number; remaining: number | null; closed: boolean; reason: string | null };

export function CapacityManager({ defaultCapacity, overrides, upcoming }: { defaultCapacity: number; overrides: { id: string; date: string; capacity: number; isClosed: boolean; note: string | null }[]; upcoming: Day[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ date: "", capacity: String(defaultCapacity || ""), isClosed: false, note: "" });
  const exec = (fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });
  return (
    <Card>
      <CardHeader title="Kapasitas produksi per tanggal" description="Atur kapasitas khusus (mis. hari ramai) atau tutup tanggal tertentu. Bila kapasitas penuh, customer diminta memilih tanggal lain." />
      <div className="p-5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">14 hari ke depan</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {upcoming.map((d) => {
            const pct = d.capacity ? Math.min(100, (d.used / d.capacity) * 100) : 0;
            return (
              <button key={d.date} type="button" onClick={() => setF({ date: d.date, capacity: String(d.capacity ?? ""), isClosed: d.closed, note: "" })} className={cn("w-24 shrink-0 rounded-xl border p-2.5 text-left text-xs transition hover:border-caramel", d.closed ? "border-red-200 bg-red-50" : "border-line bg-white")}>
                <p className="font-semibold">{formatDateOnly(d.date, { weekday: "short", day: "numeric", month: "short" })}</p>
                {d.closed ? <p className="mt-1 text-red-700">Tutup</p> : <p className="mt-1 text-muted">{d.used}/{d.capacity ?? "∞"} pcs</p>}
                {!d.closed && d.capacity != null && <div className="mt-1.5 h-1.5 rounded-full bg-cream-200"><div className={cn("h-1.5 rounded-full", pct >= 100 ? "bg-red-600" : "bg-maroon-600")} style={{ width: `${pct}%` }} /></div>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid items-end gap-3 rounded-2xl bg-cream-100 p-4 sm:grid-cols-5">
          <Field label="Tanggal"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Kapasitas (pcs)"><Input type="number" min={0} value={f.capacity} disabled={f.isClosed} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
          <Field label="Keterangan"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Libur Idul Fitri" /></Field>
          <Checkbox className="pb-3" checked={f.isClosed} onChange={(e) => setF({ ...f, isClosed: e.target.checked })} label="Tutup / tidak menerima pesanan" />
          <Button loading={pending} onClick={() => exec(() => saveCapacity({ ...f, capacity: f.isClosed ? 0 : Number(f.capacity || 0) }), "Kapasitas disimpan")}>Simpan</Button>
        </div>
        {overrides.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {overrides.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>{formatDateOnly(o.date)}</span>
                <span className="flex items-center gap-2">
                  {o.isClosed ? <Badge tone="red">Tutup</Badge> : <Badge tone="brand">{o.capacity} pcs</Badge>}
                  {o.note && <span className="text-xs text-muted">{o.note}</span>}
                  <button onClick={() => exec(() => deleteCapacity(o.id), "Dihapus")} className="rounded-full p-1.5 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function AccountPanel({ me, users }: { me: { id: string; role: string }; users: { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState({ current: "", next: "" });
  const [nu, setNu] = useState({ name: "", email: "", password: "" });
  const exec = (fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      after?.();
      router.refresh();
    });
  return (
    <Card>
      <CardHeader title="Akun admin" description="Password disimpan dalam bentuk hash bcrypt." />
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="font-semibold">Ganti password</p>
          <Field label="Password lama"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Password baru" hint="Minimal 10 karakter"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Button variant="outline" loading={pending} onClick={() => exec(() => changePassword(pw), "Password diperbarui", () => setPw({ current: "", next: "" }))}>Simpan password</Button>
        </div>
        <div>
          <p className="font-semibold">Daftar admin</p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{u.name} <Badge tone={u.role === "OWNER" ? "maroon" : "brand"}>{u.role}</Badge></p>
                  <p className="text-xs text-muted">{u.email} · login terakhir {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</p>
                </div>
                {me.role === "OWNER" && u.id !== me.id && (
                  <Button size="sm" variant="ghost" onClick={() => exec(() => toggleAdminUser(u.id, !u.isActive), u.isActive ? "Admin dinonaktifkan" : "Admin diaktifkan")}>{u.isActive ? "Nonaktifkan" : "Aktifkan"}</Button>
                )}
                {!u.isActive && <Badge tone="gray">Nonaktif</Badge>}
              </li>
            ))}
          </ul>
          {me.role === "OWNER" && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Input placeholder="Nama" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} className="h-10" />
              <Input placeholder="Email" type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className="h-10" />
              <Input placeholder="Password (min 10)" type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} className="h-10" />
              <Button variant="outline" className="sm:col-span-3" loading={pending} onClick={() => exec(() => createAdminUser(nu), "Admin ditambahkan", () => setNu({ name: "", email: "", password: "" }))}>Tambah admin</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
