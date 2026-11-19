"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, X, PackageSearch } from "lucide-react";
import { useCart } from "./cart-context";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/#tentang", label: "About Us" },
  { href: "/#kontak", label: "Contact" },
  { href: "/lacak", label: "Lacak Pesanan" },
];

export function Navbar() {
  const { count, ready } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href));

  return (
    <header className={cn("sticky top-0 z-50 transition-all", scrolled ? "border-b border-line bg-cream/90 backdrop-blur-md" : "bg-cream")}>
      <nav className="container-page flex h-16 items-center justify-between gap-4 sm:h-20">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Hakuu Bakery — beranda">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-maroon.png" alt="Hakuu Bakery" className="h-8 w-auto sm:h-10" />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium transition hover:text-maroon",
                  isActive(l.href) ? "text-maroon after:absolute after:bottom-0.5 after:left-1/2 after:h-px after:w-5 after:-translate-x-1/2 after:bg-caramel" : "text-espresso/80",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          <Link href="/lacak" className="grid h-10 w-10 place-items-center rounded-full text-espresso hover:bg-cream-200 lg:hidden" aria-label="Lacak pesanan">
            <PackageSearch className="h-5 w-5" />
          </Link>
          <Link href="/keranjang" className="relative flex h-10 items-center gap-2 rounded-full bg-maroon px-3.5 text-sm font-semibold text-cream hover:bg-maroon-600 sm:px-4" aria-label={`Keranjang, ${count} item`}>
            <ShoppingBag className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Keranjang</span>
            {ready && count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-caramel px-1 text-[0.7rem] font-bold text-maroon">{count}</span>
            )}
          </Link>
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream-200 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-line bg-cream lg:hidden animate-fade-in">
          <ul className="container-page flex flex-col py-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 font-display text-lg text-espresso hover:bg-cream-200">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
