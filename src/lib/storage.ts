
import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 8;

// Nama bucket Supabase untuk gambar produk dan gambar situs.
const STORAGE_BUCKET = "product-images";

// Nama folder logis yang boleh diakses secara publik melalui route files.
export const PUBLIC_BUCKETS = ["products", "site"] as const;

// Folder bukti transfer harus tetap privat.
export type Bucket = (typeof PUBLIC_BUCKETS)[number] | "proofs";

type AllowedImageTypes = readonly string[];

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new UploadError(
      "Konfigurasi Supabase Storage belum lengkap. Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Vercel."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function safeFolder(folder: string): string {
  const normalized = folder.replace(/^\/+|\/+$/g, "");

  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new UploadError("Folder penyimpanan gambar tidak valid.");
  }

  return normalized;
}

function safeStorageKey(key: string): boolean {
  const parts = key.split("/");

  return (
    parts.length === 2 &&
    ["products", "site", "proofs"].includes(parts[0]) &&
    /^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/i.test(parts[1]) &&
    !parts.some((part) => part === "." || part === "..")
  );
}

function getPublicObjectPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const base = process.env.SUPABASE_URL;

    if (!base || parsed.origin !== new URL(base).origin) {
      return null;
    }

    const prefix =
      `/storage/v1/object/public/${STORAGE_BUCKET}/`;

    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }

    const path = decodeURIComponent(
      parsed.pathname.slice(prefix.length)
    );

    if (
      !path ||
      path.split("/").some((part) => part === "." || part === "..")
    ) {
      return null;
    }

    return path;
  } catch {
    return null;
  }
}

/**
 * Membaca file berdasarkan key folder/nama-file.
 *
 * Catatan:
 * - products dan site berada di bucket product-images.
 * - proofs berada di bucket privat payment-proofs.
 */
export async function readFile(key: string): Promise<Buffer> {
  if (!safeStorageKey(key)) {
    throw new Error("Lokasi file tidak valid.");
  }

  const [folder] = key.split("/");
  const bucketName =
    folder === "proofs" ? "payment-proofs" : STORAGE_BUCKET;

  const supabase = getSupabase();

  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(key);

  if (error || !data) {
    throw new Error("File tidak ditemukan di penyimpanan.");
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function savePublicImage(
  file: File,
  folder: string,
  allowedTypes: AllowedImageTypes
): Promise<{ url: string }> {
  if (!(file instanceof File) || file.size <= 0) {
    throw new UploadError("File gambar tidak valid.");
  }

  if (!allowedTypes.includes(file.type)) {
    throw new UploadError(
      "Format gambar harus JPG, PNG, atau WEBP."
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Ukuran maksimal gambar adalah 5 MB.");
  }

  if (!file.name) {
    throw new UploadError("Nama file gambar tidak valid.");
  }

  const targetFolder = safeFolder(folder);

  if (!PUBLIC_BUCKETS.includes(targetFolder as (typeof PUBLIC_BUCKETS)[number])) {
    throw new UploadError("Folder upload gambar tidak diizinkan.");
  }

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensionByType[file.type];

  if (!extension) {
    throw new UploadError("Format gambar tidak didukung.");
  }

  const filename = `${randomUUID()}.${extension}`;
  const path = `${targetFolder}/${filename}`;
  const supabase = getSupabase();
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error(
      "Supabase Storage upload error:",
      error.message
    );

    throw new UploadError(
      "Gagal mengunggah gambar. Periksa konfigurasi dan izin Supabase Storage."
    );
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  if (!data.publicUrl) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw new UploadError("URL gambar gagal dibuat.");
  }

  return { url: data.publicUrl };
}

export async function deleteByUrl(url: string): Promise<void> {
  if (!url) return;

  const path = getPublicObjectPath(url);

  // Jangan menghapus file eksternal atau file dari bucket lain.
  if (!path) return;

  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.error(
      "Supabase Storage delete error:",
      error.message
    );
  }
}
