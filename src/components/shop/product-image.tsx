import { cn } from "@/lib/utils";

/** Foto produk; bila admin belum mengunggah foto, tampilkan placeholder bermerek. */
export function ProductImage({ src, alt, className, priority }: { src?: string | null; alt: string; className?: string; priority?: boolean }) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} className={cn("h-full w-full object-cover", className)} />;
  return (
    <div className={cn("relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-cream-100 via-cream-200 to-sand", className)} role="img" aria-label={alt}>
      <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-caramel/15" />
      <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-white/40" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark-gold.png" alt="" className="relative w-[26%] max-w-20 opacity-80" />
      <span className="relative px-4 text-center font-display text-sm text-brown/80">{alt}</span>
    </div>
  );
}
