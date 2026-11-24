import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { ALLOWED_IMAGE_TYPES, ALLOWED_PROOF_TYPES, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "./constants";

export class UploadError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message);
    this.name = "UploadError";
  }
}

const IMAGE_BUCKET = "product-images";
const PROOF_BUCKET = "payment-proofs";
export type Bucket = "products" | "site" | "proofs";

const imageTypes: Record<string, { extension: string; format: string }> = {
  "image/jpeg": { extension: "jpg", format: "jpeg" },
  "image/png": { extension: "png", format: "png" },
  "image/webp": { extension: "webp", format: "webp" },
};

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("[storage] SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur.");
    throw new UploadError("Penyimpanan file belum dikonfigurasi. Hubungi pengelola toko.", 503);
  }

  const parsed = URL.parse(url);
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
    console.error("[storage] SUPABASE_URL harus berupa URL dasar project.");
    throw new UploadError("Konfigurasi penyimpanan file tidak valid. Hubungi pengelola toko.", 503);
  }

  return createClient(parsed.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requireBucketVisibility(supabase: ReturnType<typeof getSupabase>, bucket: string, isPublic: boolean) {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error || data?.public !== isPublic) {
    console.error("[storage] konfigurasi bucket", { bucket, expectedPublic: isPublic, status: error?.status, message: error?.message });
    throw new UploadError(
      isPublic
        ? "Penyimpanan foto produk belum siap. Hubungi pengelola toko."
        : "Penyimpanan privat bukti pembayaran belum siap. Hubungi pengelola toko.",
      503
    );
  }
}

async function readImage(file: File, allowed: string[]) {
  if (!file.size) throw new UploadError("File kosong. Pilih gambar yang dapat dibuka.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`, 413);
  const type = imageTypes[file.type];
  if (!type || !allowed.includes(file.type)) {
    throw new UploadError(`Format gambar harus ${allowed.includes("image/webp") ? "JPG, PNG, atau WEBP" : "JPG atau PNG"}.`, 415);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata().catch(() => null);
  if (metadata?.format !== type.format) {
    throw new UploadError("Gambar tidak dapat dibaca atau format file tidak sesuai.");
  }
  return { bytes, filename: `${randomUUID()}.${type.extension}` };
}

export async function readFile(key: string): Promise<Buffer> {
  if (!/^(products|site|proofs)\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/i.test(key)) {
    throw new Error("Lokasi file tidak valid.");
  }

  const isProof = key.startsWith("proofs/");
  const bucketName = isProof ? PROOF_BUCKET : IMAGE_BUCKET;
  const supabase = getSupabase();
  if (isProof) await requireBucketVisibility(supabase, PROOF_BUCKET, false);
  const bucket = supabase.storage.from(bucketName);
  const objectPath = isProof ? key.slice("proofs/".length) : key;
  let { data, error } = await bucket.download(objectPath);

  // Bukti lama mungkin berada di dalam folder proofs pada bucket yang sama.
  if (!data && isProof) ({ data, error } = await bucket.download(key));
  if (error || !data) {
    console.error("[storage] baca gagal", { bucket: bucketName, status: error?.status, message: error?.message });
    throw new Error("File tidak ditemukan.");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function savePublicImage(file: File, folder: "products" | "site"): Promise<{ url: string }> {
  const { bytes, filename } = await readImage(file, ALLOWED_IMAGE_TYPES);
  const supabase = getSupabase();
  await requireBucketVisibility(supabase, IMAGE_BUCKET, true);
  const bucket = supabase.storage.from(IMAGE_BUCKET);
  const path = `${folder}/${filename}`;
  const { error } = await bucket.upload(path, bytes, { contentType: file.type, cacheControl: "31536000" });
  if (error) {
    console.error("[storage] upload gagal", { bucket: IMAGE_BUCKET, status: error.status, message: error.message });
    throw new UploadError("Foto produk gagal diunggah. Coba lagi atau simpan produk tanpa foto terlebih dahulu.", 502);
  }
  return { url: bucket.getPublicUrl(path).data.publicUrl };
}

export async function savePaymentProof(file: File) {
  const { bytes, filename } = await readImage(file, ALLOWED_PROOF_TYPES);
  const supabase = getSupabase();
  await requireBucketVisibility(supabase, PROOF_BUCKET, false);
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(filename, bytes, { contentType: file.type, cacheControl: "0" });
  if (error) {
    console.error("[storage] upload gagal", { bucket: PROOF_BUCKET, status: error.status, message: error.message });
    throw new UploadError("Bukti pembayaran gagal diunggah. Coba lagi atau hubungi pengelola toko.", 502);
  }
  return { key: `proofs/${filename}`, mimeType: file.type, size: file.size };
}

export async function deletePaymentProof(key: string): Promise<void> {
  const { error } = await getSupabase().storage.from(PROOF_BUCKET).remove([key.slice("proofs/".length)]);
  if (error) throw error;
}

export async function deleteByUrl(url: string): Promise<void> {
  if (!url) return;
  const parsed = URL.parse(url);
  const base = URL.parse(process.env.SUPABASE_URL ?? "");
  if (!parsed || !base || parsed.origin !== base.origin) return;
  const prefix = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  if (!parsed.pathname.startsWith(prefix)) return;
  const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
  if (!/^(products|site)\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/i.test(path)) return;
  const { error } = await getSupabase().storage.from(IMAGE_BUCKET).remove([path]);
  if (error) console.error("[storage] hapus gambar gagal", { status: error.status, message: error.message });
}
