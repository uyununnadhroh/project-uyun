import type { Metadata, Viewport } from "next";
import "@fontsource/marcellus/400.css";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: { default: "Hakuu Bakery — Freshly Baked, Made with Love", template: "%s · Hakuu Bakery" },
  description: "Pesan roti Hakuu Bakery secara online. Pick up atau delivery, bayar cash atau transfer.",
};

export const viewport: Viewport = { themeColor: "#4d0c14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontFamily: "var(--font-sans)", borderRadius: 14, border: "1px solid #ebdfd1" },
          }}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
