import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark-gold.png" alt="" className="w-20" />
      <h1 className="mt-6 text-4xl text-maroon">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-muted">Sepertinya roti yang kamu cari sudah habis 🍞</p>
      <Link href="/menu" className={buttonClass("primary", "lg", "mt-8")}>Lihat Menu</Link>
    </div>
  );
}
