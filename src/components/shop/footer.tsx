import Link from "next/link";
import { AtSign as Instagram, MapPin, Clock, Phone, Mail } from "lucide-react";
import type { PublicSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { displayPhone } from "@/lib/utils";

export function Footer({ s }: { s: PublicSettings }) {
  const wa = waLink(s.whatsappNumber, "Halo Hakuu Bakery, saya ingin bertanya.");
  return (
    <footer id="kontak" className="mt-24 bg-maroon text-cream/85">
      <div className="container-page grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-gold.png" alt="Hakuu Bakery" className="h-11 w-auto" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-cream/70">Freshly baked, made with love. Pesan online, ambil di toko atau kami antar.</p>
        </div>
        <div className="md:col-span-4">
          <p className="eyebrow !text-caramel">Kontak</p>
          <ul className="mt-4 space-y-3 text-sm">
            {s.address && (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
                <span className="whitespace-pre-line">
                  {s.address}
                  {s.mapsUrl && (
                    <>
                      {" "}
                      <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-caramel/60 underline-offset-2 hover:text-white">Lihat peta</a>
                    </>
                  )}
                </span>
              </li>
            )}
            {wa && (
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
                <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp {displayPhone(s.whatsappNumber)}</a>
              </li>
            )}
            {s.instagram && (
              <li className="flex gap-3">
                <Instagram className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
                <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">@{s.instagram}</a>
              </li>
            )}
            {s.email && (
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
                <a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a>
              </li>
            )}
            {!s.address && !wa && !s.instagram && <li className="text-cream/50">Informasi kontak dapat diatur di dashboard admin.</li>}
          </ul>
        </div>
        <div className="md:col-span-4">
          <p className="eyebrow !text-caramel">Jam Operasional</p>
          <div className="mt-4 flex gap-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
            <p className="whitespace-pre-line leading-relaxed">{s.operatingHours || "Segera diumumkan."}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/menu" className="hover:text-white">Menu</Link>
            <Link href="/lacak" className="hover:text-white">Lacak Pesanan</Link>
            <Link href="/keranjang" className="hover:text-white">Keranjang</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-1 py-5 text-xs text-cream/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {s.storeName}. All rights reserved.</p>
          <p className="tracking-[0.3em] uppercase">Freshly Baked · Made with Love</p>
        </div>
      </div>
    </footer>
  );
}
