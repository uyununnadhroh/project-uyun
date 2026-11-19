import Link from "next/link";
import { ArrowRight, Bike, Store, Wallet, Sparkles, ShoppingBag, CalendarDays, PackageCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getBestSellers, publicProductWhere } from "@/lib/catalog";
import { ProductCard } from "@/components/shop/product-card";
import { buttonClass } from "@/components/ui/button";
import { WhatsAppLink } from "@/components/shop/whatsapp-button";
import { EmptyState } from "@/components/ui/misc";

export default async function HomePage() {
  const [s, best, categories] = await Promise.all([
    getSettings(),
    getBestSellers(4),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: publicProductWhere } } } },
    }),
  ]);
  const headline = s.heroHeadline.split(",");

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-10 pt-6 pb-16 sm:pt-10 lg:grid-cols-12 lg:gap-8 lg:pb-24">
          <div className="lg:col-span-6 animate-fade-in">
            <p className="eyebrow">Hakuu Bakery · Artisan Bakery</p>
            <h1 className="mt-5 text-[2.6rem] leading-[1.05] text-maroon sm:text-6xl lg:text-[4.2rem]">
              {headline.length > 1 ? (
                <>
                  {headline[0]},
                  <span className="block text-brown italic">{headline.slice(1).join(",").trim()}</span>
                </>
              ) : (
                s.heroHeadline
              )}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">{s.heroDescription}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className={buttonClass("primary", "lg")}>
                Pesan Sekarang <ArrowRight className="h-4.5 w-4.5" />
              </Link>
              <Link href="/lacak" className={buttonClass("outline", "lg")}>
                Lacak Pesanan
              </Link>
            </div>
            <ul className="mt-10 grid max-w-lg grid-cols-3 gap-3 text-xs text-muted sm:text-sm">
              {[
                { icon: Store, t: "Pick up di toko" },
                { icon: Bike, t: "Delivery" },
                { icon: Wallet, t: "Cash / Transfer" },
              ].map(({ icon: Icon, t }) => (
                <li key={t} className="flex flex-col items-start gap-2 border-l border-sand pl-3">
                  <Icon className="h-4.5 w-4.5 text-caramel-dark" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:col-span-6 lg:max-w-none">
            <div className="relative mx-auto aspect-[4/5] w-[86%] max-w-[440px]">
              <div className="arch absolute inset-0 translate-x-4 translate-y-4 border border-caramel/60" />
              <div className="arch relative h-full overflow-hidden bg-maroon shadow-lift">
                {s.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.heroImageUrl} alt="Roti Hakuu Bakery" className="h-full w-full object-cover" />
                ) : (
                  <div className="relative flex h-full flex-col items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(/brand/mark-cream.png)", backgroundSize: "70px", backgroundRepeat: "repeat" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/mark-gold.png" alt="" className="relative w-[46%]" />
                    <p className="relative mt-8 text-[0.65rem] tracking-[0.5em] text-caramel uppercase">Est. Hakuu Bakery</p>
                  </div>
                )}
              </div>
            </div>
            <div className="absolute bottom-6 left-0 hidden max-w-[220px] rounded-2xl border border-line bg-white/95 p-4 shadow-lift backdrop-blur sm:block lg:-left-2">
              <div className="flex items-center gap-2 text-maroon">
                <Sparkles className="h-4 w-4 text-caramel-dark" />
                <p className="text-sm font-bold">Paket Hemat</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">Racik sendiri isi paketmu — pilih varian rasa untuk setiap roti.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BEST SELLER */}
      <section className="container-page py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Favorit Pelanggan</p>
            <h2 className="mt-3 text-3xl text-maroon sm:text-4xl">Best Seller</h2>
          </div>
          <Link href="/menu?urut=bestseller" className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon hover:gap-2.5 transition-all">
            Lihat semua menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {best.length ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {best.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 2} />
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={<ShoppingBag className="h-6 w-6" />} title="Menu segera hadir" description="Produk Hakuu Bakery sedang disiapkan. Nantikan ya!" />
        )}
      </section>

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section className="container-page py-14">
          <div className="text-center">
            <p className="eyebrow">Kategori</p>
            <h2 className="mt-3 text-3xl text-maroon sm:text-4xl">Temukan yang kamu suka</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                href={`/menu?kategori=${c.slug}`}
                className={`group relative overflow-hidden rounded-3xl p-7 transition hover:-translate-y-0.5 hover:shadow-lift ${i % 3 === 1 ? "bg-maroon text-cream" : i % 3 === 2 ? "bg-caramel/90 text-maroon" : "bg-cream-200 text-maroon"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i % 3 === 1 ? "/brand/mark-gold.png" : "/brand/mark-maroon.png"} alt="" className="absolute -right-6 -bottom-8 w-36 opacity-15 transition duration-500 group-hover:rotate-6 group-hover:opacity-25" />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-70">{c._count.products} produk</p>
                <h3 className="mt-3 text-2xl">{c.name}</h3>
                {c.description && <p className="mt-1.5 max-w-[80%] text-sm opacity-80">{c.description}</p>}
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
                  Jelajahi <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* HOW TO ORDER */}
      <section className="py-14">
        <div className="container-page">
          <div className="rounded-[2rem] border border-line bg-white px-6 py-12 sm:px-12">
            <div className="text-center">
              <p className="eyebrow">Cara Pesan</p>
              <h2 className="mt-3 text-3xl text-maroon sm:text-4xl">Mudah, tanpa perlu daftar akun</h2>
            </div>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ShoppingBag, t: "Pilih menu", d: "Tambahkan roti atau racik Paket Hemat dengan varian pilihanmu." },
                { icon: CalendarDays, t: "Atur jadwal", d: "Pilih pick up atau delivery, lalu tentukan tanggal & waktu." },
                { icon: Wallet, t: "Bayar", d: "Cash saat terima pesanan, atau transfer bank & unggah bukti." },
                { icon: PackageCheck, t: "Lacak pesanan", d: "Pantau status dengan nomor pesanan dan nomor WhatsApp." },
              ].map(({ icon: Icon, t, d }, i) => (
                <li key={t} className="relative">
                  <span className="font-display text-5xl text-sand">0{i + 1}</span>
                  <div className="mt-2 flex items-center gap-2 text-maroon">
                    <Icon className="h-5 w-5 text-caramel-dark" />
                    <h3 className="font-sans text-base font-bold">{t}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="tentang" className="container-page scroll-mt-24 py-14">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative mx-auto w-full max-w-sm">
            <div className="arch overflow-hidden bg-cream-200 shadow-lift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mockup-bag.jpg" alt="Kemasan Hakuu Bakery" className="aspect-[4/5] w-full object-cover" />
            </div>
            <div className="absolute -right-4 -bottom-5 grid h-24 w-24 place-items-center rounded-full bg-maroon shadow-lift sm:-right-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mark-gold.png" alt="" className="w-11" />
            </div>
          </div>
          <div>
            <p className="eyebrow">About Us</p>
            <h2 className="mt-3 text-3xl text-maroon sm:text-4xl">{s.aboutTitle}</h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              {s.aboutText.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
              {[
                ["H", "Inisial Hakuu"],
                ["✦", "Harapan & kualitas"],
                ["❦", "Tumbuh bersama"],
              ].map(([k, v]) => (
                <div key={v}>
                  <p className="font-display text-2xl text-caramel-dark">{k}</p>
                  <p className="mt-1 text-xs text-muted sm:text-sm">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pt-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-cream-200 px-6 py-12 text-center sm:px-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-maroon.png" alt="" className="pointer-events-none absolute -left-10 -top-10 w-44 opacity-[0.06]" />
          <h2 className="text-3xl text-maroon sm:text-4xl">Siap memesan roti hari ini?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">Pesan sekarang atau tanyakan dulu menu & ketersediaan melalui WhatsApp.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/menu" className={buttonClass("primary", "lg")}>
              Lihat Menu
            </Link>
            <WhatsAppLink number={s.whatsappNumber} text="Halo Hakuu Bakery, saya ingin bertanya tentang menu & pemesanan." className="h-12 px-7">
              Chat WhatsApp
            </WhatsAppLink>
          </div>
        </div>
      </section>
    </>
  );
}
