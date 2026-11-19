"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { z, ZodError } from "zod";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bankSchema, fieldErrors, productSchema } from "@/lib/validation";
import { OrderError, archiveOrder, changeOrderStatus, markCashPaid } from "@/lib/order-service";
import { approveProof, rejectProof } from "@/lib/payment-service";
import { runOcrForProof } from "@/lib/ocr";
import { UploadError, deleteByUrl, savePublicImage } from "@/lib/storage";
import { saveSettings, type StoreSettings } from "@/lib/settings";
import { ALLOWED_IMAGE_TYPES } from "@/lib/constants";
import { dateOnly, normalizePhone, slugify } from "@/lib/utils";

export type ActionResult = { ok: true; id?: string } | { ok?: false; error: string; fields?: Record<string, string> };

async function run(fn: () => Promise<{ id?: string } | void>, paths: string[] = []): Promise<ActionResult> {
  try {
    const r = await fn();
    for (const p of paths) revalidatePath(p, "layout");
    return { ok: true, ...(r || {}) };
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Data tidak valid", fields: fieldErrors(e) };
    if (e instanceof OrderError) return { error: e.message, fields: e.field ? { [e.field]: e.message } : undefined };
    if (e instanceof UploadError) return { error: e.message };
    if (typeof e === "object" && e && "digest" in e) throw e; // redirect dari requireAdmin
    console.error(e);
    return { error: "Terjadi kesalahan pada server." };
  }
}

async function uniqueSlug(base: string, model: "product" | "category", excludeId?: string) {
  const root = slugify(base) || "item";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const exists =
      model === "product"
        ? await prisma.product.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined }, select: { id: true } })
        : await prisma.category.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined }, select: { id: true } });
    if (!exists) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// ───────────────────────────── Products ─────────────────────────────

export async function saveProduct(form: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const id = String(form.get("id") || "") || null;
    const raw = JSON.parse(String(form.get("data") || "{}"));
    const data = productSchema.parse(raw);
    const keepImages: string[] = JSON.parse(String(form.get("keepImages") || "[]")); // url yang dipertahankan, berurutan
    const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 8) throw new UploadError("Maksimal 8 foto per upload.");

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new OrderError("Kategori tidak ditemukan.", "categoryId");
    if (data.type === "PACKAGE") {
      const count = await prisma.productVariant.count({ where: { id: { in: data.variantIds } } });
      if (count !== data.variantIds.length) throw new OrderError("Ada varian yang tidak valid.", "variantIds");
    }

    // Simpan foto baru terlebih dahulu (validasi tipe & ukuran di storage)
    const uploaded: string[] = [];
    try {
      for (const f of files) uploaded.push((await savePublicImage(f, "products", ALLOWED_IMAGE_TYPES)).url);
    } catch (e) {
      for (const u of uploaded) await deleteByUrl(u);
      throw e;
    }

    const base = {
      name: data.name,
      categoryId: data.categoryId,
      description: data.description,
      information: data.information || null,
      price: data.price,
      discountPrice: data.discountPrice,
      type: data.type,
      isAvailable: data.isAvailable,
      isPublished: data.isPublished,
      isFeatured: data.isFeatured,
      trackStock: data.trackStock,
      stock: data.trackStock ? data.stock : null,
      packageSize: data.type === "PACKAGE" ? data.packageSize : null,
      allowDuplicateVariants: data.allowDuplicateVariants,
    };

    let removed: string[] = [];
    const product = await prisma.$transaction(async (tx) => {
      let pid = id;
      if (pid) {
        const existing = await tx.product.findFirst({ where: { id: pid, deletedAt: null }, include: { images: true } });
        if (!existing) throw new OrderError("Produk tidak ditemukan.");
        const slug = existing.name === data.name ? existing.slug : await uniqueSlug(data.name, "product", pid);
        await tx.product.update({ where: { id: pid }, data: { ...base, slug } });
        removed = existing.images.filter((i) => !keepImages.includes(i.url)).map((i) => i.url);
        await tx.productImage.deleteMany({ where: { productId: pid } });
      } else {
        const created = await tx.product.create({ data: { ...base, slug: await uniqueSlug(data.name, "product") } });
        pid = created.id;
      }
      const urls = [...keepImages.filter((u) => !removed.includes(u)), ...uploaded];
      if (urls.length) await tx.productImage.createMany({ data: urls.map((url, i) => ({ productId: pid!, url, sortOrder: i })) });
      await tx.productPackageOption.deleteMany({ where: { productId: pid! } });
      if (data.type === "PACKAGE") await tx.productPackageOption.createMany({ data: data.variantIds.map((variantId) => ({ productId: pid!, variantId })) });
      return { id: pid! };
    });
    for (const u of removed) await deleteByUrl(u);
    return product;
  }, ["/admin/produk", "/"]);
}

export async function toggleProductField(id: string, field: "isPublished" | "isAvailable" | "isFeatured", value: boolean) {
  return run(async () => {
    await requireAdmin();
    await prisma.product.update({ where: { id }, data: { [field]: value } });
  }, ["/admin/produk", "/"]);
}

export async function deleteProduct(id: string) {
  return run(async () => {
    const admin = await requireAdmin();
    const p = await prisma.product.findUnique({ where: { id }, select: { name: true, _count: { select: { orderItems: true } } } });
    if (!p) throw new OrderError("Produk tidak ditemukan.");
    // Soft delete: riwayat pesanan tetap mengacu ke snapshot produk
    await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isPublished: false, slug: `deleted-${id}` } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "product.delete", entityType: "product", entityId: id, data: { name: p.name, orders: p._count.orderItems } } });
  }, ["/admin/produk", "/"]);
}

// ───────────────────────────── Categories ─────────────────────────────

const categorySchema = z.object({
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(60),
  description: z.string().trim().max(200).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function saveCategory(id: string | null, input: unknown) {
  return run(async () => {
    await requireAdmin();
    const d = categorySchema.parse(input);
    if (id) {
      const cur = await prisma.category.findUniqueOrThrow({ where: { id } });
      await prisma.category.update({ where: { id }, data: { ...d, description: d.description || null, slug: cur.name === d.name ? cur.slug : await uniqueSlug(d.name, "category", id) } });
    } else {
      await prisma.category.create({ data: { ...d, description: d.description || null, slug: await uniqueSlug(d.name, "category") } });
    }
  }, ["/admin/kategori", "/"]);
}

export async function deleteCategory(id: string) {
  return run(async () => {
    await requireAdmin();
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) throw new OrderError(`Kategori masih dipakai oleh ${count} produk (termasuk yang sudah dihapus). Nonaktifkan saja kategori ini.`);
    await prisma.category.delete({ where: { id } });
  }, ["/admin/kategori", "/"]);
}

// ───────────────────────────── Variants ─────────────────────────────

const variantSchema = z.object({
  name: z.string().trim().min(2, "Nama varian minimal 2 karakter").max(40),
  description: z.string().trim().max(200).optional().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveVariant(id: string | null, input: unknown) {
  return run(async () => {
    await requireAdmin();
    const d = variantSchema.parse(input);
    const dup = await prisma.productVariant.findFirst({ where: { name: { equals: d.name, mode: "insensitive" }, NOT: id ? { id } : undefined } });
    if (dup) throw new OrderError("Varian dengan nama tersebut sudah ada.", "name");
    const data = { ...d, description: d.description || null };
    if (id) await prisma.productVariant.update({ where: { id }, data });
    else await prisma.productVariant.create({ data });
  }, ["/admin/varian", "/admin/produk", "/"]);
}

export async function deleteVariant(id: string) {
  return run(async () => {
    await requireAdmin();
    // Riwayat pesanan tetap aman karena nama varian disimpan sebagai snapshot
    await prisma.productVariant.delete({ where: { id } });
  }, ["/admin/varian", "/admin/produk", "/"]);
}

export async function setPackageVariantLimit(productId: string, variantId: string, max: number | null) {
  return run(async () => {
    await requireAdmin();
    await prisma.productPackageOption.update({ where: { productId_variantId: { productId, variantId } }, data: { maxPerPackage: max && max > 0 ? max : null } });
  }, ["/admin/produk"]);
}

// ───────────────────────────── Orders ─────────────────────────────

export async function updateOrderStatus(orderId: string, to: OrderStatus, note?: string, markPaid?: boolean) {
  return run(async () => {
    const admin = await requireAdmin();
    await changeOrderStatus({ orderId, to, adminId: admin.id, note, markPaid });
  }, ["/admin"]);
}

export async function markOrderPaid(orderId: string) {
  return run(async () => {
    const admin = await requireAdmin();
    await markCashPaid(orderId, admin.id);
  }, ["/admin"]);
}

export async function archiveOrderAction(orderId: string, reason: string) {
  return run(async () => {
    const admin = await requireAdmin();
    await archiveOrder(orderId, admin.id, reason);
  }, ["/admin"]);
}

// ───────────────────────────── Payments ─────────────────────────────

export async function approveProofAction(proofId: string) {
  return run(async () => {
    const admin = await requireAdmin();
    await approveProof(proofId, admin.id);
  }, ["/admin"]);
}

export async function rejectProofAction(proofId: string, reason: string) {
  return run(async () => {
    const admin = await requireAdmin();
    await rejectProof(proofId, admin.id, reason);
  }, ["/admin"]);
}

export async function rerunOcrAction(proofId: string) {
  return run(async () => {
    await requireAdmin();
    await prisma.paymentProof.update({ where: { id: proofId }, data: { ocrStatus: "PENDING", ocrNote: null } });
    after(() => runOcrForProof(proofId));
  }, ["/admin/verifikasi"]);
}

// ───────────────────────────── Bank accounts ─────────────────────────────

export async function saveBank(id: string | null, input: unknown) {
  return run(async () => {
    await requireAdmin();
    const d = bankSchema.parse(input);
    if (id) await prisma.bankAccount.update({ where: { id }, data: d });
    else await prisma.bankAccount.create({ data: d });
  }, ["/admin/rekening"]);
}

export async function deleteBank(id: string) {
  return run(async () => {
    await requireAdmin();
    // Pesanan lama menyimpan snapshot rekening sehingga aman dihapus
    await prisma.bankAccount.delete({ where: { id } });
  }, ["/admin/rekening"]);
}

// ───────────────────────────── Settings ─────────────────────────────

const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(60),
  heroHeadline: z.string().trim().min(3).max(80),
  heroDescription: z.string().trim().max(300),
  aboutTitle: z.string().trim().max(80),
  aboutText: z.string().trim().max(3000),
  whatsappNumber: z.string().trim().max(20).transform((v, ctx) => {
    if (!v) return "";
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid" });
    return n ?? "";
  }),
  instagram: z.string().trim().max(40).transform((v) => v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")),
  email: z.union([z.literal(""), z.string().trim().email("Email tidak valid")]),
  address: z.string().trim().max(400),
  mapsUrl: z.union([z.literal(""), z.string().trim().url("URL tidak valid").max(500)]),
  operatingHours: z.string().trim().max(400),
  pickupEnabled: z.boolean(),
  pickupInstructions: z.string().trim().max(300),
  deliveryEnabled: z.boolean(),
  deliveryFee: z.coerce.number().int().min(0).max(1_000_000),
  deliveryNote: z.string().trim().max(300),
  paymentDeadlineHours: z.coerce.number().int().min(1, "Minimal 1 jam").max(168),
  cashEnabled: z.boolean(),
  transferEnabled: z.boolean(),
  minLeadDays: z.coerce.number().int().min(0).max(30),
  maxAdvanceDays: z.coerce.number().int().min(1).max(90),
  defaultDailyCapacity: z.coerce.number().int().min(0).max(100000),
  closedWeekdays: z.array(z.number().int().min(0).max(6)),
  timeSlots: z.array(z.string().trim().min(3).max(40)).min(1, "Minimal satu pilihan waktu").max(12),
  ocrEnabled: z.boolean(),
});

export async function saveSettingsAction(input: unknown) {
  return run(async () => {
    await requireAdmin();
    const d = settingsSchema.parse(input);
    if (!d.pickupEnabled && !d.deliveryEnabled) throw new OrderError("Aktifkan minimal satu metode penerimaan.");
    if (!d.cashEnabled && !d.transferEnabled) throw new OrderError("Aktifkan minimal satu metode pembayaran.");
    if (d.maxAdvanceDays < d.minLeadDays) throw new OrderError("Batas maksimal pemesanan harus ≥ minimal hari pemesanan.");
    await saveSettings(d as Partial<StoreSettings>);
  }, ["/"]);
}

export async function uploadHeroImage(form: FormData) {
  return run(async () => {
    await requireAdmin();
    const file = form.get("file");
    const remove = form.get("remove") === "1";
    const { getSettings } = await import("@/lib/settings");
    const current = (await getSettings()).heroImageUrl;
    if (remove) {
      await saveSettings({ heroImageUrl: "" });
      await deleteByUrl(current);
      return;
    }
    if (!(file instanceof File)) throw new UploadError("Pilih gambar.");
    const { url } = await savePublicImage(file, "site", ALLOWED_IMAGE_TYPES);
    await saveSettings({ heroImageUrl: url });
    await deleteByUrl(current);
  }, ["/"]);
}

const capacitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  capacity: z.coerce.number().int().min(0).max(100000),
  isClosed: z.boolean(),
  note: z.string().trim().max(120).optional().default(""),
});

export async function saveCapacity(input: unknown) {
  return run(async () => {
    await requireAdmin();
    const d = capacitySchema.parse(input);
    await prisma.dailyProductionCapacity.upsert({
      where: { date: dateOnly(d.date) },
      update: { capacity: d.capacity, isClosed: d.isClosed, note: d.note || null },
      create: { date: dateOnly(d.date), capacity: d.capacity, isClosed: d.isClosed, note: d.note || null },
    });
  }, ["/admin/pengaturan"]);
}

export async function deleteCapacity(id: string) {
  return run(async () => {
    await requireAdmin();
    await prisma.dailyProductionCapacity.delete({ where: { id } });
  }, ["/admin/pengaturan"]);
}

export async function changePassword(input: unknown) {
  return run(async () => {
    const admin = await requireAdmin();
    const d = z
      .object({ current: z.string().min(1, "Isi password lama"), next: z.string().min(10, "Password baru minimal 10 karakter").max(100) })
      .parse(input);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    if (!(await bcrypt.compare(d.current, user.passwordHash))) throw new OrderError("Password lama salah.", "current");
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(d.next, 12) } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "user.password_change", entityType: "user", entityId: admin.id } });
  });
}

export async function createAdminUser(input: unknown) {
  return run(async () => {
    const admin = await requireAdmin();
    if (admin.role !== "OWNER") throw new OrderError("Hanya Owner yang dapat menambah admin.");
    const d = z
      .object({ name: z.string().trim().min(2).max(60), email: z.string().trim().toLowerCase().email("Email tidak valid"), password: z.string().min(10, "Password minimal 10 karakter").max(100) })
      .parse(input);
    if (await prisma.user.findUnique({ where: { email: d.email } })) throw new OrderError("Email sudah terdaftar.", "email");
    const u = await prisma.user.create({ data: { name: d.name, email: d.email, role: "ADMIN", passwordHash: await bcrypt.hash(d.password, 12) } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "user.create", entityType: "user", entityId: u.id, data: { email: d.email } } });
  }, ["/admin/pengaturan"]);
}

export async function toggleAdminUser(id: string, isActive: boolean) {
  return run(async () => {
    const admin = await requireAdmin();
    if (admin.role !== "OWNER") throw new OrderError("Hanya Owner yang dapat mengubah akun admin.");
    if (id === admin.id) throw new OrderError("Tidak dapat menonaktifkan akun sendiri.");
    await prisma.user.update({ where: { id }, data: { isActive } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: isActive ? "user.activate" : "user.deactivate", entityType: "user", entityId: id } });
  }, ["/admin/pengaturan"]);
}

