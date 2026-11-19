import { cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.45 9.43m8.04-17.47A11.3 11.3 0 0 0 12.04.7C5.77.7.66 5.8.66 12.07c0 2 .52 3.96 1.52 5.69L.57 23.65l6.03-1.58a11.33 11.33 0 0 0 5.43 1.38h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.18-5.9-3.33-8.05" />
    </svg>
  );
}

/** Tombol Click-to-Chat. Tidak tampil bila nomor WhatsApp belum diatur admin. */
export function WhatsAppLink({ number, text, children, className }: { number: string; text?: string; children: React.ReactNode; className?: string }) {
  const href = waLink(number, text);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#178a49]", className)}>
      <WhatsAppIcon className="h-4.5 w-4.5" />
      {children}
    </a>
  );
}

export function WhatsAppFloat({ number }: { number: string }) {
  const href = waLink(number, "Halo Hakuu Bakery, saya ingin bertanya tentang menu & pemesanan.");
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat WhatsApp Hakuu Bakery"
      className="no-print fixed right-4 bottom-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#1f9d55] text-white shadow-lift transition hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
