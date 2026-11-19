import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp, { type Metadata as SharpMeta } from "sharp";
import { MAX_UPLOAD_BYTES } from "./constants";

/**
 * Penyimpanan file lokal. Struktur:
 *   storage/products/*.webp  -> publik, disajikan lewat /api/files/products/...
 *   storage/site/*.webp      -> publik (hero, dsb.)
 *   storage/proofs/*.jpg     -> PRIVAT, hanya admin / pemilik pesanan
 * Untuk produksi, modul ini dapat diganti ke Supabase Storage / S3 tanpa mengubah pemanggilnya.
 */
export type Bucket = "products" | "site" | "proofs";
export const PUBLIC_BUCKETS: Bucket[] = ["products", "site"];

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");

export class UploadError extends Error {}

const FORMAT_TO_MIME: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Validasi berdasarkan isi file (magic bytes via sharp), bukan sekadar ekstensi / header browser. */
async function inspect(file: File, allowedMimes: string[]) {
  if (!file || typeof file.arrayBuffer !== "function") throw new UploadError("File tidak ditemukan.");
  if (file.size === 0) throw new UploadError("File kosong.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`Ukuran file maksimal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  let meta: SharpMeta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new UploadError("File bukan gambar yang valid.");
  }
  const mime = meta.format ? FORMAT_TO_MIME[meta.format] : undefined;
  if (!mime || !allowedMimes.includes(mime)) {
    throw new UploadError(`Format tidak didukung. Gunakan ${allowedMimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.`);
  }
  if ((meta.width ?? 0) < 50 || (meta.height ?? 0) < 50) throw new UploadError("Resolusi gambar terlalu kecil.");
  return { buf, mime };
}

function randomName(ext: string) {
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

async function write(bucket: Bucket, name: string, data: Buffer) {
  const dir = path.join(ROOT, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), data);
  return `${bucket}/${name}`;
}

/** Simpan foto produk/site: di-encode ulang ke WebP (membuang metadata EXIF & payload tersembunyi). */
export async function savePublicImage(file: File, bucket: "products" | "site", allowed: string[]) {
  const { buf } = await inspect(file, allowed);
  const out = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const key = await write(bucket, randomName("webp"), out);
  return { url: `/api/files/${key}`, key };
}

/** Simpan bukti transfer ke storage privat (JPEG, resolusi cukup untuk OCR). */
export async function savePaymentProof(file: File, allowed: string[]) {
  const { buf } = await inspect(file, allowed);
  const out = await sharp(buf).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const key = await write("proofs", randomName("jpg"), out);
  return { key, mimeType: "image/jpeg", size: out.length };
}

export function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new UploadError("Path tidak valid.");
  return full;
}

export async function readFile(key: string) {
  return fs.readFile(resolveKey(key));
}

export async function deleteByUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("/api/files/")) return;
  try {
    await fs.unlink(resolveKey(url.replace("/api/files/", "")));
  } catch {
    /* abaikan */
  }
}
