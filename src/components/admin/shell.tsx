"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, Tags, ShoppingCart, BadgeCheck, Landmark, Users, BarChart3, Settings, LogOut, Menu, X, ExternalLink, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/admin/login/actions";

type Counts = { pendingConfirm: number; waitingProofs: number; latestOrder: { id: string; orderNumber: string; customerName: string } | null; latestProof: { id: string; orderNumber: string } | null };

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/produk", label: "Products", icon: Package },
  { href: "/admin/varian", label: "Varian Paket", icon: Layers, sub: true },
  { href: "/admin/kategori", label: "Categories", icon: Tags },
  { href: "/admin/pesanan", label: "Orders", icon: ShoppingCart, badge: "pendingConfirm" as const },
  { href: "/admin/verifikasi", label: "Payment Verification", icon: BadgeCheck, badge: "waitingProofs" as const },
  { href: "/admin/rekening", label: "Bank Accounts", icon: Landmark },
  { href: "/admin/pelanggan", label: "Customers", icon: Users },
  { href: "/admin/laporan", label: "Sales Reports", icon: BarChart3 },
  { href: "/admin/pengaturan", label: "Settings", icon: Settings },
];

export function AdminShell({ user, children }: { user: { name: string; email: string; role: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const seen = useRef<{ order?: string; proof?: string } | null>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (r.status === 401) return router.push("/admin/login");
        if (!r.ok || !alive) return;
        const j: Counts = await r.json();
        setCounts(j);
        if (seen.current) {
          if (j.latestOrder && j.latestOrder.id !== seen.current.order)
            toast.info(`Pesanan baru: ${j.latestOrder.orderNumber}`, { description: j.latestOrder.customerName, action: { label: "Buka", onClick: () => router.push(`/admin/pesanan/${j.latestOrder!.id}`) } });
          if (j.latestProof && j.latestProof.id !== seen.current.proof)
            toast.warning(`Bukti transfer perlu diverifikasi`, { description: j.latestProof.orderNumber, action: { label: "Verifikasi", onClick: () => router.push("/admin/verifikasi") } });
        }
        seen.current = { order: j.latestOrder?.id, proof: j.latestProof?.id };
      } catch {}
    }
    poll();
    const t = setInterval(poll, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [router]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-gold.png" alt="Hakuu Bakery" className="h-8 w-auto" />
        </Link>
        <button className="rounded-full p-2 text-cream/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => {
          const active = isActive(n.href, n.exact);
          const badge = n.badge && counts ? counts[n.badge] : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                n.sub && "ml-4 py-2 text-[0.8rem]",
                active ? "bg-cream text-maroon font-semibold" : "text-cream/75 hover:bg-white/8 hover:text-cream",
              )}
            >
              <n.icon className={cn("h-4.5 w-4.5 shrink-0", n.sub && "h-4 w-4")} />
              <span className="flex-1">{n.label}</span>
              {badge > 0 && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold", active ? "bg-maroon text-cream" : "bg-caramel text-maroon")}>{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-cream/70 hover:bg-white/8 hover:text-cream">
          <ExternalLink className="h-4 w-4" /> Lihat website
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-caramel text-sm font-bold text-maroon">{user.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cream">{user.name}</p>
            <p className="truncate text-xs text-cream/50">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-full p-2 text-cream/60 hover:bg-white/10 hover:text-cream" aria-label="Keluar" title="Keluar"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#f7f2eb]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-maroon lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-espresso/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-maroon animate-fade-in">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-cream-100" aria-label="Buka menu"><Menu className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-maroon.png" alt="Hakuu" className="h-6 w-auto" />
          {counts && counts.waitingProofs + counts.pendingConfirm > 0 && (
            <span className="ml-auto rounded-full bg-caramel px-2.5 py-0.5 text-xs font-bold text-maroon">{counts.waitingProofs + counts.pendingConfirm} perlu tindakan</span>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl text-maroon">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
