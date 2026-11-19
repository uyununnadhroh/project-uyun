import { checkoutSchema } from "@/lib/validation";
import { createOrder } from "@/lib/order-service";
import { grantOrderAccess } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { fail, handleError, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    if (!(await rateLimit("checkout", 10, 10 * 60_000))) return fail("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.", 429);
    const body = await req.json().catch(() => null);
    const input = checkoutSchema.parse(body);
    const order = await createOrder(input);
    await grantOrderAccess(order.orderNumber);
    return ok({ orderNumber: order.orderNumber }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
