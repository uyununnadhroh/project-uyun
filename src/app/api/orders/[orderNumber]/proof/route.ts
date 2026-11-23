
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
const STORAGE_BUCKET = "product-images";
const PROOF_BUCKET = "payment-proofs";

export const PUBLIC_BUCKETS = ["products", "site"] as const;

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

  try {
    const parsedUrl = new URL(url);

    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      parsedUrl.pathname !== "/" ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error("URL Supabase tidak valid.");
    }
  } catch {
    throw new UploadError(
      "SUPABASE_URL tidak valid. Gunakan URL project Supabase."
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
    throw new UploadError(
      "Folder penyimpanan gambar tidak valid."
    );
  }

  return normalized;
}

function safeStorageKey(key: string): boolean {
  const parts = key.split("/");

  return (
    parts.length === 2 &&
    ["products", "site", "proofs"].includes(parts[0]) &&
    /^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/i.test(parts[1])
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
      path.split("/").some(
        (part) => part === "." || part === ".."
      )
    ) {
      return null;
    }

    return path;
  } catch {
    return null;
  }
}

/** Membaca gambar produk, gambar situs, atau bukti transfer. */
export async function readFile(key: string): Promise<Buffer> {
  if (!safeStorageKey(key)) {
    throw new Error("Lokasi file tidak valid.");
  }

  const [folder] = key.split("/");
  const isProof = folder === "proofs";
  const bucketName = isProof
    ? PROOF_BUCKET
    : STORAGE_BUCKET;

  const supabase = getSupabase();

  // Bukti baru disimpan langsung di root bucket payment-proofs.
  const objectPath = isProof
    ? key.slice("proofs/".length)
    : key;

  let { data, error } = await supabase.storage
    .from(bucketName)
    .download(objectPath);

  // Coba lokasi lama jika bukti sebelumnya disimpan
  // di dalam folder proofs pada bucket payment-proofs.
  if ((error || !data) && isProof) {
    const legacyResult = await supabase.storage
      .from(bucketName)
      .download(key);

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !data) {
    console.error(
      "Supabase Storage read error:",
      error?.message
    );
    throw new Error("File tidak ditemukan.");
  }

  return Buffer.from(await data.arrayBuffer());
}

/** Upload gambar produk atau gambar situs. */
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
    throw new UploadError(
      "Ukuran maksimal gambar adalah 5 MB."
    );
  }

  if (!file.name) {
    throw new UploadError(
      "Nama file gambar tidak valid."
    );
  }

  const targetFolder = safeFolder(folder);

  if (
    !PUBLIC_BUCKETS.includes(
      targetFolder as (typeof PUBLIC_BUCKETS)[number]
    )
  ) {
    throw new UploadError(
      "Folder upload gambar tidak diizinkan."
    );
  }

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensionByType[file.type];

  if (!extension) {
    throw new UploadError(
      "Format gambar tidak didukung."
    );
  }

  const filename = `${randomUUID()}.${extension}`;
  const path = `${targetFolder}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabase();

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
    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    throw new UploadError("URL gambar gagal dibuat.");
  }

  return { url: data.publicUrl };
}

/** Upload bukti transfer ke bucket privat payment-proofs. */
export async function savePaymentProof(
  file: File,
  allowedTypes: AllowedImageTypes
): Promise<{
  key: string;
  mimeType: string;
  size: number;
}> {
  if (!(file instanceof File) || file.size <= 0) {
    throw new UploadError(
      "File bukti pembayaran tidak valid."
    );
  }

  if (!allowedTypes.includes(file.type)) {
    throw new UploadError(
      "Format file bukti pembayaran tidak didukung."
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      "Ukuran maksimal bukti pembayaran adalah 5 MB."
    );
  }

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensionByType[file.type];

  if (!extension) {
    throw new UploadError(
      "Bukti pembayaran harus berupa gambar JPG, PNG, atau WEBP."
    );
  }

  const filename = `${randomUUID()}.${extension}`;

  // Referensi yang disimpan ke database.
  const key = `proofs/${filename}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabase();

  // Path upload relatif terhadap bucket payment-proofs.
  const { error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(filename, bytes, {
      contentType: file.type,
      cacheControl: "0",
      upsert: false,
    });

  if (error) {
    console.error(
      "Supabase payment proof upload error:",
      error.message
    );
    throw new UploadError(
      "Gagal mengunggah bukti pembayaran. Silakan coba lagi."
    );
  }

  return {
    key,
    mimeType: file.type,
    size: file.size,
  };
}

/** Menghapus gambar yang URL-nya berasal dari bucket gambar publik. */
export async function deleteByUrl(
  url: string
): Promise<void> {
  if (!url) return;

  const path = getPublicObjectPath(url);
  if (!path) return;

  const { error } = await getSupabase()
    .storage.from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.error(
      "Supabase Storage delete error:",
      error.message
    );
  }
}
