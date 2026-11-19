import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login Admin", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-maroon p-12 text-cream lg:flex">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(/brand/mark-cream.png)", backgroundSize: "90px" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-gold.png" alt="Hakuu Bakery" className="relative h-12 w-auto self-start" />
        <div className="relative">
          <p className="font-display text-5xl leading-tight">Dapur digital<br />Hakuu Bakery.</p>
          <p className="mt-4 max-w-sm text-cream/70">Kelola produk, pesanan, pembayaran, dan laporan penjualan dalam satu tempat.</p>
        </div>
        <p className="relative text-xs tracking-[0.3em] text-caramel uppercase">Admin Dashboard</p>
      </div>
      <div className="flex items-center justify-center bg-cream p-6">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-maroon.png" alt="Hakuu Bakery" className="mb-10 h-10 w-auto lg:hidden" />
          <h1 className="text-3xl text-maroon">Masuk ke Dashboard</h1>
          <p className="mt-2 text-sm text-muted">Khusus admin Hakuu Bakery.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
