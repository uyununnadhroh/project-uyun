import { z } from "zod";
import { priceCart } from "@/lib/order-service";
import { cartItemSchema } from "@/lib/validation";
import { handleError, ok } from "@/lib/api";

/** Hitung harga keranjang dari database (harga dari browser diabaikan). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const items = z.array(cartItemSchema).max(50).parse(body.items ?? []);
    if (!items.length) return ok({ lines: [], subtotal: 0, units: 0, hasError: false });
    const res = await priceCart(items);
    return ok({
      ...res,
      lines: res.lines.map(({ trackStock, stock, ...l }) => ({ ...l, maxQty: trackStock ? Math.max(0, stock ?? 0) : 999 })),
    });
  } catch (e) {
    return handleError(e);
  }
}
