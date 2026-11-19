import { CartProvider } from "@/components/shop/cart-context";
import { Navbar } from "@/components/shop/navbar";
import { Footer } from "@/components/shop/footer";
import { WhatsAppFloat } from "@/components/shop/whatsapp-button";
import { getSettings, toPublic } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <CartProvider>
      <Navbar />
      <main className="min-h-[60vh]">{children}</main>
      <Footer s={toPublic(s)} />
      <WhatsAppFloat number={s.whatsappNumber} />
    </CartProvider>
  );
}
