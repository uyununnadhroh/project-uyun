
"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { z, ZodError } from "zod";
import type { OrderStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bankSchema, fieldErrors, productSchema } from "@/lib/validation";
import {
  OrderError,
  archiveOrder,
  changeOrderStatus,
  markCashPaid,
} from "@/lib/order-service";
import { approveProof, rejectProof } from "@/lib/payment-service";
import { runOcrForProof } from "@/lib/ocr";
import {
  UploadError,
  deleteByUrl,
  savePublicImage,
} from "@/lib/storage";
import { saveSettings, type StoreSettings } from "@/lib/settings";
import { ALLOWED_IMAGE_TYPES } from "@/lib/constants";
import { dateOnly, normalizePhone, slugify } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok?: false; error: string; fields?: Record<string, string> };

async function run(
  fn: () => Promise<{ id?: string } | void>,
  paths: string[] = []
): Promise<ActionResult> {
  try {
    const result = await fn();

    for (const path of paths) {
      revalidatePath(path, "layout");
    }

    return { ok: true, ...(result || {}) };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message ?? "Data tidak valid",
        fields: fieldErrors(error),
      };
    }

    if (error instanceof OrderError) {
      return {
        error: error.message,
        fields: error.field
          ? { [error.field]: error.message }
          : undefined,
      };
    }

    if (error instanceof UploadError) {
      return { error: error.message };
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error
    ) {
      throw error;
    }

    console.error(error);
    return { error: "Terjadi kesalahan pada server." };
  }
}

async function uniqueSlug(
  base: string,
  model: "product" | "category",
  excludeId?: string
): Promise<string> {
  const root = slugify(base) || "item";

  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;

    const exists =
      model === "product"
        ? await prisma.product.findFirst({
            where: {
              slug,
              NOT: excludeId ? { id: excludeId } : undefined,
            },
            select: { id: true },
          })
        : await prisma.category.findFirst({
            where: {
              slug,
              NOT: excludeId ? { id: excludeId } : undefined,
            },
            select: { id: true },
          });

    if (!exists) {
      return slug;
    }
  }

  return `${root}-${Date.now().toString(36)}`;
}

// ───────────────────────────── Products ─────────────────────────────

export async function saveProduct(
  form: FormData
): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();

    const id = String(form.get("id") || "") || null;
    const raw = JSON.parse(String(form.get("data") || "{}"));
    const data = productSchema.parse(raw);

    const keepImages: string[] = JSON.parse(
      String(form.get("keepImages") || "[]")
    );

    const files = form
      .getAll("images")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (files.length > 8) {
      throw new UploadError("Maksimal 8 foto per upload.");
    }

    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new OrderError("Kategori tidak ditemukan.", "categoryId");
    }

    if (data.type === "PACKAGE") {
      const count = await prisma.productVariant.count({
        where: { id: { in: data.variantIds } },
      });

      if (count !== data.variantIds.length) {
        throw new OrderError(
          "Ada varian yang tidak valid.",
          "variantIds"
        );
      }
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

    // Cari slug sebelum transaksi database dimulai.
    let productSlug: string;

    if (id) {
      const existing = await prisma.product.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, name: true, slug: true },
      });

      if (!existing) {
        throw new OrderError("Produk tidak ditemukan.");
      }

      productSlug =
        existing.name === data.name
          ? existing.slug
          : await uniqueSlug(data.name, "product", id);
    } else {
      productSlug = await uniqueSlug(data.name, "product");
    }

    // Upload gambar dilakukan di luar transaksi database.
    const uploaded: string[] = [];

    try {
      for (const file of files) {
        const result = await savePublicImage(
          file,
          "products",
          ALLOWED_IMAGE_TYPES
        );

        uploaded.push(result.url);
      }
    } catch (error) {
      for (const url of uploaded) {
        try {
          await deleteByUrl(url);
        } catch (cleanupError) {
          console.error("Gagal membersihkan gambar:", cleanupError);
        }
      }

      throw error;
    }

    let removed: string[] = [];

    try {
      const product = await prisma.$transaction(
        async (tx) => {
          let productId = id;

          if (productId) {
            const existing = await tx.product.findFirst({
              where: { id: productId, deletedAt: null },
              include: { images: true },
            });

            if (!existing) {
              throw new OrderError("Produk tidak ditemukan.");
            }

            await tx.product.update({
              where: { id: productId },
              data: {
                ...base,
                slug: productSlug,
              },
            });

            removed = existing.images
              .filter((image) => !keepImages.includes(image.url))
              .map((image) => image.url);

            await tx.productImage.deleteMany({
              where: { productId },
            });
          } else {
            const created = await tx.product.create({
              data: {
                ...base,
                slug: productSlug,
              },
            });

            productId = created.id;
          }

          const urls = [
            ...keepImages.filter((url) => !removed.includes(url)),
            ...uploaded,
          ];

          if (urls.length > 0) {
            await tx.productImage.createMany({
              data: urls.map((url, index) => ({
                productId: productId!,
                url,
                sortOrder: index,
              })),
            });
          }

          await tx.productPackageOption.deleteMany({
            where: { productId: productId! },
          });

          if (data.type === "PACKAGE") {
            await tx.productPackageOption.createMany({
              data: data.variantIds.map((variantId) => ({
                productId: productId!,
                variantId,
              })),
            });
          }

          return { id: productId! };
        },
        { timeout: 15000 }
      );

      // Hapus gambar lama setelah transaksi berhasil.
      for (const url of removed) {
        try {
          await deleteByUrl(url);
        } catch (error) {
          console.error("Gagal menghapus gambar lama:", error);
        }
      }

      return product;
    } catch (error) {
      // Jika transaksi gagal, bersihkan gambar yang baru diunggah.
      for (const url of uploaded) {
        try {
          await deleteByUrl(url);
        } catch (cleanupError) {
          console.error("Gagal membersihkan gambar:", cleanupError);
        }
      }

      throw error;
    }
  }, ["/admin/produk", "/"]);
}

export async function toggleProductField(
  id: string,
  field: "isPublished" | "isAvailable" | "isFeatured",
  value: boolean
) {
  return run(async () => {
    await requireAdmin();

    await prisma.product.update({
      where: { id },
      data: { [field]: value },
    });
  }, ["/admin/produk", "/"]);
}

export async function deleteProduct(id: string) {
  return run(async () => {
    const admin = await requireAdmin();

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        name: true,
        _count: { select: { orderItems: true } },
      },
    });

    if (!product) {
      throw new OrderError("Produk tidak ditemukan.");
    }

    await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isPublished: false,
        slug: `deleted-${id}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "product.delete",
        entityType: "product",
        entityId: id,
        data: {
          name: product.name,
          orders: product._count.orderItems,
        },
      },
    });
  }, ["/admin/produk", "/"]);
}

// ───────────────────────────── Categories ─────────────────────────────

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama kategori minimal 2 karakter")
    .max(60),
  description: z.string().trim().max(200).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function saveCategory(id: string | null, input: unknown) {
  return run(async () => {
    await requireAdmin();

    const data = categorySchema.parse(input);

    if (id) {
      const current = await prisma.category.findUniqueOrThrow({
        where: { id },
      });

      await prisma.category.update({
        where: { id },
        data: {
          ...data,
          description: data.description || null,
          slug:
            current.name === data.name
              ? current.slug
              : await uniqueSlug(data.name, "category", id),
        },
      });
    } else {
      const slug = await uniqueSlug(data.name, "category");

      await prisma.category.create({
        data: {
          ...data,
          description: data.description || null,
          slug,
        },
      });
    }
  }, ["/admin/kategori", "/"]);
}

export async function deleteCategory(id: string) {
  return run(async () => {
    await requireAdmin();

    const count = await prisma.product.count({
      where: { categoryId: id },
    });

    if (count > 0) {
      throw new OrderError(
        `Kategori masih dipakai oleh ${count} produk (termasuk yang sudah dihapus). Nonaktifkan saja kategori ini.`
      );
    }

    await prisma.category.delete({ where: { id } });
  }, ["/admin/kategori", "/"]);
}

// ───────────────────────────── Variants ─────────────────────────────

const variantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama varian minimal 2 karakter")
    .max(40),
  description: z.string().trim().max(200).optional().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveVariant(id: string | null, input: unknown) {
  return run(async () => {
    await requireAdmin();

    const data = variantSchema.parse(input);

    const duplicate = await prisma.productVariant.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        NOT: id ? { id } : undefined,
      },
    });

    if (duplicate) {
      throw new OrderError(
        "Varian dengan nama tersebut sudah ada.",
        "name"
      );
    }

    const payload = {
      ...data,
      description: data.description || null,
    };

    if (id) {
      await prisma.productVariant.update({
        where: { id },
        data: payload,
      });
    } else {
      await prisma.productVariant.create({ data: payload });
    }
  }, ["/admin/varian", "/admin/produk", "/"]);
}

export async function deleteVariant(id: string) {
  return run(async () => {
    await requireAdmin();

    await prisma.productVariant.delete({ where: { id } });
  }, ["/admin/varian", "/admin/produk", "/"]);
}

export async function setPackageVariantLimit(
  productId: string,
  variantId: string,
  max: number | null
) {
  return run(async () => {
    await requireAdmin();

    await prisma.productPackageOption.update({
      where: {
        productId_variantId: { productId, variantId },
      },
      data: {
        maxPerPackage: max && max > 0 ? max : null,
      },
    });
  }, ["/admin/produk"]);
}

// ───────────────────────────── Orders ─────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  note?: string,
  markPaid?: boolean
) {
  return run(async () => {
    const admin = await requireAdmin();

    await changeOrderStatus({
      orderId,
      to,
      adminId: admin.id,
      note,
      markPaid,
    });
  }, ["/admin"]);
}

export async function markOrderPaid(orderId: string) {
  return run(async () => {
    const admin = await requireAdmin();

    await markCashPaid(orderId, admin.id);
  }, ["/admin"]);
}

export async function archiveOrderAction(
  orderId: string,
  reason: string
) {
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

export async function rejectProofAction(
  proofId: string,
  reason: string
) {
  return run(async () => {
    const admin = await requireAdmin();

    await rejectProof(proofId, admin.id, reason);
  }, ["/admin"]);
}

export async function rerunOcrAction(proofId: string) {
  return run(async () => {
    await requireAdmin();

    await prisma.paymentProof.update({
      where: { id: proofId },
      data: {
        ocrStatus: "PENDING",
        ocrNote: null,
      },
    });

    after(() => runOcrForProof(proofId));
  }, ["/admin/verifikasi"]);
}

// ───────────────────────────── Bank accounts ─────────────────────────────

export async function saveBank(id: string | null, input: unknown) {
  return run(async () => {
    await requireAdmin();

    const data = bankSchema.parse(input);

    if (id) {
      await prisma.bankAccount.update({
        where: { id },
        data,
      });
    } else {
      await prisma.bankAccount.create({ data });
    }
  }, ["/admin/rekening"]);
}

export async function deleteBank(id: string) {
  return run(async () => {
    await requireAdmin();

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

  whatsappNumber: z.string().trim().max(20).transform((value, ctx) => {
    if (!value) return "";

    const normalized = normalizePhone(value);

    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Nomor WhatsApp tidak valid",
      });
    }

    return normalized ?? "";
  }),

  instagram: z
    .string()
    .trim()
    .max(40)
    .transform((value) =>
      value
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
        .replace(/\/$/, "")
    ),

  email: z.union([
    z.literal(""),
    z.string().trim().email("Email tidak valid"),
  ]),

  address: z.string().trim().max(400),

  mapsUrl: z.union([
    z.literal(""),
    z.string().trim().url("URL tidak valid").max(500),
  ]),

  operatingHours: z.string().trim().max(400),
  pickupEnabled: z.boolean(),
  pickupInstructions: z.string().trim().max(300),
  deliveryEnabled: z.boolean(),
  deliveryFee: z.coerce.number().int().min(0).max(1_000_000),
  deliveryNote: z.string().trim().max(300),
  paymentDeadlineHours: z.coerce
    .number()
    .int()
    .min(1, "Minimal 1 jam")
    .max(168),
  cashEnabled: z.boolean(),
  transferEnabled: z.boolean(),
  minLeadDays: z.coerce.number().int().min(0).max(30),
  maxAdvanceDays: z.coerce.number().int().min(1).max(90),
  defaultDailyCapacity: z.coerce.number().int().min(0).max(100000),
  closedWeekdays: z.array(z.number().int().min(0).max(6)),
  timeSlots: z
    .array(z.string().trim().min(3).max(40))
    .min(1, "Minimal satu pilihan waktu")
    .max(12),
  ocrEnabled: z.boolean(),
});

export async function saveSettingsAction(input: unknown) {
  return run(async () => {
    await requireAdmin();

    const data = settingsSchema.parse(input);

    if (!data.pickupEnabled && !data.deliveryEnabled) {
      throw new OrderError(
        "Aktifkan minimal satu metode penerimaan."
      );
    }

    if (!data.cashEnabled && !data.transferEnabled) {
      throw new OrderError(
        "Aktifkan minimal satu metode pembayaran."
      );
    }

    if (data.maxAdvanceDays < data.minLeadDays) {
      throw new OrderError(
        "Batas maksimal pemesanan harus ≥ minimal hari pemesanan."
      );
    }

    await saveSettings(data as Partial<StoreSettings>);
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

    if (!(file instanceof File)) {
      throw new UploadError("Pilih gambar.");
    }

    const { url } = await savePublicImage(
      file,
      "site",
      ALLOWED_IMAGE_TYPES
    );

    await saveSettings({ heroImageUrl: url });
    await deleteByUrl(current);
  }, ["/"]);
}

// ───────────────────────────── Production capacity ─────────────────────────────

const capacitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  capacity: z.coerce.number().int().min(0).max(100000),
  isClosed: z.boolean(),
  note: z.string().trim().max(120).optional().default(""),
});

export async function saveCapacity(input: unknown) {
  return run(async () => {
    await requireAdmin();

    const data = capacitySchema.parse(input);

    await prisma.dailyProductionCapacity.upsert({
      where: { date: dateOnly(data.date) },
      update: {
        capacity: data.capacity,
        isClosed: data.isClosed,
        note: data.note || null,
      },
      create: {
        date: dateOnly(data.date),
        capacity: data.capacity,
        isClosed: data.isClosed,
        note: data.note || null,
      },
    });
  }, ["/admin/pengaturan"]);
}

export async function deleteCapacity(id: string) {
  return run(async () => {
    await requireAdmin();

    await prisma.dailyProductionCapacity.delete({
      where: { id },
    });
  }, ["/admin/pengaturan"]);
}

// ───────────────────────────── Admin accounts ─────────────────────────────

export async function changePassword(input: unknown) {
  return run(async () => {
    const admin = await requireAdmin();

    const data = z
      .object({
        current: z.string().min(1, "Isi password lama"),
        next: z
          .string()
          .min(10, "Password baru minimal 10 karakter")
          .max(100),
      })
      .parse(input);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
    });

    if (!(await bcrypt.compare(data.current, user.passwordHash))) {
      throw new OrderError("Password lama salah.", "current");
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        passwordHash: await bcrypt.hash(data.next, 12),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "user.password_change",
        entityType: "user",
        entityId: admin.id,
      },
    });
  });
}

export async function createAdminUser(input: unknown) {
  return run(async () => {
    const admin = await requireAdmin();

    if (admin.role !== "OWNER") {
      throw new OrderError(
        "Hanya Owner yang dapat menambah admin."
      );
    }

    const data = z
      .object({
        name: z.string().trim().min(2).max(60),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email("Email tidak valid"),
        password: z
          .string()
          .min(10, "Password minimal 10 karakter")
          .max(100),
      })
      .parse(input);

    if (
      await prisma.user.findUnique({
        where: { email: data.email },
      })
    ) {
      throw new OrderError("Email sudah terdaftar.", "email");
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: "ADMIN",
        passwordHash: await bcrypt.hash(data.password, 12),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        data: { email: data.email },
      },
    });
  }, ["/admin/pengaturan"]);
}

export async function toggleAdminUser(
  id: string,
  isActive: boolean
) {
  return run(async () => {
    const admin = await requireAdmin();

    if (admin.role !== "OWNER") {
      throw new OrderError(
        "Hanya Owner yang dapat mengubah akun admin."
      );
    }

    if (id === admin.id) {
      throw new OrderError(
        "Tidak dapat menonaktifkan akun sendiri."
      );
    }

    await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: isActive ? "user.activate" : "user.deactivate",
        entityType: "user",
        entityId: id,
      },
    });
  }, ["/admin/pengaturan"]);
}
