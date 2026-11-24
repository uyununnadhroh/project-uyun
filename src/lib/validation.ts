import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(40),
  quantity: z.coerce.number().int().min(1, "Jumlah minimal 1").max(999, "Jumlah maksimal 999"),
  variants: z.array(z.string().min(1).max(40)).max(50).optional().default([]),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const cartSchema = z.array(cartItemSchema).min(1, "Keranjang masih kosong").max(50);

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

export const checkoutSchema = z
  .object({
    items: cartSchema,
    customerName: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
    phone: z.string().trim().min(8, "Nomor WhatsApp tidak valid").max(20),
    fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]),
    deliveryAddress: z.string().trim().max(500).optional().default(""),
    addressLandmark: z.string().trim().max(200).optional().default(""),
    scheduledDate: z.string().regex(ymdRegex, "Tanggal tidak valid"),
    scheduledTime: z.string().trim().min(1, "Pilih waktu").max(40),
    notes: z.string().trim().max(500).optional().default(""),
    paymentMethod: z.enum(["CASH", "TRANSFER"]),
    bankAccountId: z.string().max(40).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillmentMethod === "DELIVERY" && v.deliveryAddress.length < 10) {
      ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Alamat lengkap wajib diisi (min. 10 karakter) untuk delivery" });
    }
    if (v.paymentMethod === "TRANSFER" && !v.bankAccountId) {
      ctx.addIssue({ code: "custom", path: ["bankAccountId"], message: "Pilih rekening tujuan transfer" });
    }
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackSchema = z.object({
  orderNumber: z.string().trim().min(5).max(30).transform((s) => s.toUpperCase()),
  phone: z.string().trim().min(8).max(20),
});

const money = z.coerce.number().int("Harus bilangan bulat").min(0, "Tidak boleh negatif").max(100_000_000);

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Nama produk minimal 2 karakter").max(100),
    categoryId: z.string().min(1, "Pilih kategori"),
    description: z.string().trim().max(3000).default(""),
    information: z.string().trim().max(3000).default(""),
    price: money.refine((n) => n > 0, "Harga wajib diisi"),
    discountPrice: z.union([money, z.literal("")]).optional().transform((v) => (v === "" || v === undefined || v === 0 ? null : v)),
    type: z.enum(["REGULAR", "PACKAGE"]),
    isAvailable: z.boolean(),
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
    trackStock: z.boolean(),
    stock: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    packageSize: z.union([z.coerce.number().int().min(1).max(50), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    allowDuplicateVariants: z.boolean(),
    variantIds: z.array(z.string()).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.discountPrice != null && v.discountPrice >= v.price) ctx.addIssue({ code: "custom", path: ["discountPrice"], message: "Harga diskon harus lebih kecil dari harga normal" });
    if (v.trackStock && v.stock == null) ctx.addIssue({ code: "custom", path: ["stock"], message: "Isi jumlah stok" });
    if (v.type === "PACKAGE") {
      if (!v.packageSize || v.packageSize < 2) ctx.addIssue({ code: "custom", path: ["packageSize"], message: "Jumlah isi paket minimal 2" });
      if (v.variantIds.length === 0) ctx.addIssue({ code: "custom", path: ["variantIds"], message: "Pilih minimal satu varian untuk paket" });
      if (!v.allowDuplicateVariants && v.packageSize && v.variantIds.length < v.packageSize)
        ctx.addIssue({ code: "custom", path: ["variantIds"], message: `Varian tidak boleh berulang, jadi minimal ${v.packageSize} varian harus dipilih` });
    }
  });

export const bankSchema = z.object({
  bankName: z.string().trim().min(2, "Nama bank wajib diisi").max(60),
  accountNumber: z.string().trim().regex(/^[0-9 -]{5,30}$/, "Nomor rekening hanya angka"),
  accountHolder: z.string().trim().min(2, "Nama pemilik wajib diisi").max(80),
  isActive: z.boolean(),
});

export function firstError(err: z.ZodError) {
  const i = err.issues[0];
  return i ? i.message : "Data tidak valid";
}

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
