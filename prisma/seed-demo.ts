/**
 * DATA CONTOH (opsional) — hanya untuk mencoba alur aplikasi secara lokal.
 * Produk di bawah BUKAN menu resmi Hakuu Bakery. Ubah/hapus lewat Admin → Products.
 * Jalankan: npm run db:seed-demo
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roti = await prisma.category.findUniqueOrThrow({ where: { slug: "roti" } });
  const paket = await prisma.category.findUniqueOrThrow({ where: { slug: "paket-hemat" } });
  const variants = await prisma.productVariant.findMany();

  const regular = [
    ["Roti Cokelat", 13000, null, "Roti lembut dengan isian cokelat."],
    ["Roti Keju", 14000, 12000, "Roti lembut dengan isian dan taburan keju."],
    ["Roti Abon", 15000, null, "Roti gurih dengan topping abon."],
    ["Roti Strawberry", 13000, null, "Roti lembut dengan selai strawberry."],
  ] as const;
  for (const [name, price, discount, description] of regular) {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: { name, slug, price, discountPrice: discount, description, categoryId: roti.id, type: "REGULAR" },
    });
  }

  const packages = [
    ["Paket Hemat Isi 2", 25000, 2, true],
    ["Paket Hemat Isi 4", 48000, 4, true],
  ] as const;
  for (const [name, price, size, dup] of packages) {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
        price,
        categoryId: paket.id,
        type: "PACKAGE",
        packageSize: size,
        allowDuplicateVariants: dup,
        isFeatured: true,
        description: `Pilih ${size} roti favoritmu dari varian yang tersedia.`,
        packageOptions: { create: variants.map((v) => ({ variantId: v.id })) },
      },
    });
  }
  console.log("✔ Data contoh dibuat (6 produk). Ganti dengan menu & foto asli melalui dashboard.");
}

main().finally(() => prisma.$disconnect());
