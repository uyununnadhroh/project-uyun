import "server-only";
import { prisma } from "./db";
import { cache } from "react";

export type StoreSettings = {
  storeName: string;
  heroHeadline: string;
  heroDescription: string;
  heroImageUrl: string;
  aboutTitle: string;
  aboutText: string;
  whatsappNumber: string; // format 62xxxx
  instagram: string; // username tanpa @
  email: string;
  address: string;
  mapsUrl: string;
  operatingHours: string; // multi baris
  pickupEnabled: boolean;
  pickupInstructions: string;
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryNote: string;
  paymentDeadlineHours: number;
  cashEnabled: boolean;
  transferEnabled: boolean;
  minLeadDays: number; // pesanan paling cepat H+n
  maxAdvanceDays: number;
  defaultDailyCapacity: number; // 0 = tanpa batas (dalam pcs)
  closedWeekdays: number[]; // 0=Minggu ... 6=Sabtu
  timeSlots: string[];
  ocrEnabled: boolean;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Hakuu Bakery",
  heroHeadline: "Freshly Baked, Made with Love",
  heroDescription:
    "Pesan roti favoritmu langsung dari Hakuu Bakery. Pilih menu, racik paket hematmu sendiri, lalu ambil di toko atau kami antar ke rumah.",
  heroImageUrl: "",
  aboutTitle: "Tentang Hakuu Bakery",
  aboutText:
    "Hakuu Bakery adalah UMKM roti yang tumbuh dengan satu harapan sederhana: dikenal karena produk dan pelayanan yang berkualitas.\n\nLogo kami lahir dari huruf H — inisial Hakuu — yang disusun dengan bentuk bintang sebagai simbol harapan, gandum sebagai jiwa sebuah bakery, dan daun-daun yang saling mengikat sebagai wujud komitmen kami untuk tumbuh bersama dan memberdayakan masyarakat sekitar.",
  whatsappNumber: "",
  instagram: "",
  email: "",
  address: "",
  mapsUrl: "",
  operatingHours: "",
  pickupEnabled: true,
  pickupInstructions: "Tunjukkan nomor pesanan kepada kasir saat mengambil pesanan.",
  deliveryEnabled: true,
  deliveryFee: 0,
  deliveryNote: "Biaya pengiriman mengikuti ketentuan Hakuu Bakery.",
  paymentDeadlineHours: 24,
  cashEnabled: true,
  transferEnabled: true,
  minLeadDays: 1,
  maxAdvanceDays: 30,
  defaultDailyCapacity: 0,
  closedWeekdays: [],
  timeSlots: ["08:00 - 10:00", "10:00 - 12:00", "13:00 - 15:00", "15:00 - 17:00"],
  ocrEnabled: true,
};

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const rows = await prisma.setting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  return merged as StoreSettings;
});

export async function saveSettings(patch: Partial<StoreSettings>) {
  const entries = Object.entries(patch).filter(([k, v]) => k in DEFAULT_SETTINGS && v !== undefined);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value: value as never }, create: { key, value: value as never } }),
    ),
  );
}

/** Data yang aman ditampilkan ke publik */
export type PublicSettings = Pick<
  StoreSettings,
  "storeName" | "whatsappNumber" | "instagram" | "email" | "address" | "mapsUrl" | "operatingHours"
>;
export function toPublic(s: StoreSettings): PublicSettings {
  return {
    storeName: s.storeName,
    whatsappNumber: s.whatsappNumber,
    instagram: s.instagram,
    email: s.email,
    address: s.address,
    mapsUrl: s.mapsUrl,
    operatingHours: s.operatingHours,
  };
}
