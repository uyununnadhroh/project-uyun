
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
const BUCKET = "product-images";

type AllowedImageTypes = readonly string[] | string[];

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

function safeFolder(folder: string) {
  const normalized = folder.replace(/^\/+|\/+$/g, "");

  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new UploadError("Folder penyimpanan gambar tidak valid.");
  }

  return normalized;
}

function getPublicObjectPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const base = process.env.SUPABASE_URL;

    if (!base || parsed.origin !== new URL(base).origin) {
      return null;
    }

    const prefix = `/storage/v1/object/public/${BUCKET}/`;

    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }

    const path = parsed.pathname.slice(prefix.length);

    if (!path || path.split("/").some((part) => part === "..")) {
      return null;
    }

    return path;
  } catch {
    return null;
  }
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
    throw new UploadError("Format gambar harus JPG, PNG, atau WEBP.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Ukuran maksimal gambar adalah 5 MB.");
  }

  if (file.size > 0 && !file.name) {
    throw new UploadError("Nama file gambar tidak valid.");
  }

  const targetFolder = safeFolder(folder);
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensionByType[file.type];

  if (!extension) {
    throw new UploadError("Format gambar tidak didukung.");
  }

  const path = `${targetFolder}/${randomUUID()}.${extension}`;
  const supabase = getSupabase();
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error("Supabase Storage upload error:", error.message);
    throw new UploadError(
      "Gagal mengunggah gambar. Periksa konfigurasi dan izin Supabase Storage."
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  if (!data.publicUrl) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new UploadError("URL gambar gagal dibuat.");
  }

  return { url: data.publicUrl };
}

export async function deleteByUrl(url: string): Promise<void> {
  if (!url) return;

  const path = getPublicObjectPath(url);

  // Jangan menghapus URL eksternal atau file yang bukan milik bucket ini.
  if (!path) return;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error("Supabase Storage delete error:", error.message);
  }
}
