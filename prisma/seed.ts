/**
 * Seed DASAR (aman untuk produksi): akun admin pertama, kategori & varian awal sesuai brief.
 * Tidak membuat produk / pesanan palsu. Jalankan: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || password.length < 8) throw new Error("Set ADMIN_EMAIL dan ADMIN_PASSWORD (min. 8 karakter) di .env");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { email, name: "Admin Hakuu", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`✔ Admin dibuat: ${email}`);
  } else console.log(`• Admin ${email} sudah ada (password tidak diubah)`);

  const categories = [
    { name: "Roti", slug: "roti", sortOrder: 1, description: "Roti manis & gurih" },
    { name: "Paket Hemat", slug: "paket-hemat", sortOrder: 2, description: "Racik isi paket sesuai selera" },
  ];
  for (const c of categories) await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });

  const variants = ["Cokelat", "Keju", "Strawberry", "Blueberry", "Vanilla", "Abon"];
  for (const [i, name] of variants.entries())
    await prisma.productVariant.upsert({ where: { name }, update: {}, create: { name, sortOrder: i } });

  console.log("✔ Kategori & varian awal siap. Lengkapi profil toko di Admin → Settings.");
}

main().finally(() => prisma.$disconnect());
