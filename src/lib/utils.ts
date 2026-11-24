import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIMEZONE = "Asia/Jakarta";

export function formatRupiah(value: number | null | undefined) {
  const n = Math.round(value ?? 0);
  return "Rp" + n.toLocaleString("id-ID");
}

/** Normalisasi nomor Indonesia menjadi format 62xxxxxxxxxx. Mengembalikan null bila tidak valid. */
export function normalizePhone(input: string): string | null {
  let digits = (input || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("8")) digits = "62" + digits;
  if (!/^62\d{8,13}$/.test(digits)) return null;
  return digits;
}

export function displayPhone(phone: string) {
  if (!phone) return "";
  return phone.startsWith("62") ? "0" + phone.slice(2) : phone;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD */
export function todayWIB(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
}

/** "YYYY-MM-DD" -> Date UTC tengah malam (untuk kolom @db.Date) */
export function dateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Date (kolom @db.Date) -> "YYYY-MM-DD" */
export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Awal hari WIB untuk "YYYY-MM-DD" sebagai instant */
export function startOfDayWIB(ymdStr: string): Date {
  return new Date(`${ymdStr}T00:00:00.000+07:00`);
}

export function addDaysYmd(ymdStr: string, days: number): string {
  const d = dateOnly(ymdStr);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", { timeZone: TIMEZONE, ...opts }).format(d);
}

/** Untuk kolom @db.Date (UTC midnight) – tampilkan tanpa geser zona waktu */
export function formatDateOnly(date: Date | string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  const d = typeof date === "string" ? new Date(date.length === 10 ? `${date}T00:00:00Z` : date) : date;
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opts }).format(d);
}

export function formatDateTime(date: Date | string) {
  return formatDate(date, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";
}

export function effectivePrice(p: { price: number; discountPrice: number | null }) {
  return p.discountPrice != null && p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price;
}

/** Gunakan harga paket ketika salah satu pilihan belum memiliki harga per varian. */
export function packageUnitPrice(basePrice: number, variantPrices: (number | null | undefined)[]) {
  let total = 0;
  for (const price of variantPrices) {
    if (price == null || !Number.isInteger(price) || price <= 0) return basePrice;
    total += price;
  }
  return total || basePrice;
}
