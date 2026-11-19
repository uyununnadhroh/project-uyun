import { prisma } from "@/lib/db";
import { trackSchema } from "@/lib/validation";
import { normalizePhone } from "@/lib/utils";
import { grantOrderAccess } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { fail, handleError, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    if (!(await rateLimit("track", 15, 10 * 60_000))) return fail("Terlalu banyak percobaan. Coba lagi dalam 10 menit.", 429);
    const { orderNumber, phone } = trackSchema.parse(await req.json().catch(() => ({})));
    const normalized = normalizePhone(phone);
    const order = normalized ? await prisma.order.findUnique({ where: { orderNumber }, select: { customerPhone: true, archivedAt: true } }) : null;
    // Pesan generik agar tidak membocorkan keberadaan nomor pesanan
    if (!order || order.archivedAt || order.customerPhone !== normalized) return fail("Pesanan tidak ditemukan. Periksa kembali nomor pesanan dan nomor WhatsApp.", 404);
    await grantOrderAccess(orderNumber);
    return ok({ orderNumber });
  } catch (e) {
    return handleError(e);
  }
}
