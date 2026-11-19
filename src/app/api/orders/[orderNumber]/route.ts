import { hasOrderAccess } from "@/lib/order-access";
import { getCustomerOrder } from "@/lib/order-view";
import { expireOverdueOrders } from "@/lib/order-service";
import { fail, handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    if (!(await hasOrderAccess(orderNumber))) return fail("Akses ditolak. Lacak pesanan dengan nomor pesanan & WhatsApp.", 403);
    await expireOverdueOrders();
    const order = await getCustomerOrder(orderNumber);
    if (!order) return fail("Pesanan tidak ditemukan.", 404);
    return ok(order, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
