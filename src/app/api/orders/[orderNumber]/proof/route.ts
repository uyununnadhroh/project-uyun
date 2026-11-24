
import { after } from "next/server";
import { hasOrderAccess } from "@/lib/order-access";
import { submitPaymentProof } from "@/lib/payment-service";
import { runOcrForProof } from "@/lib/ocr";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { fail, handleError, ok } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    if (!(await hasOrderAccess(orderNumber))) return fail("Akses ditolak.", 403);
    if (!(await rateLimit("proof", 10, 10 * 60_000))) return fail("Terlalu banyak unggahan. Coba lagi nanti.", 429);
    if (Number(req.headers.get("content-length")) > MAX_UPLOAD_BYTES + 65536) {
      return fail(`Ukuran bukti pembayaran maksimal ${MAX_UPLOAD_LABEL}.`, 413);
    }
    const form = await req.formData().catch(() => null);
    if (!form) return fail("Unggahan tidak terbaca. Pilih kembali gambar bukti transfer.", 400);
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Pilih file bukti transfer.", 422);
    const { proof, ocrEnabled } = await submitPaymentProof(orderNumber, file);
    // OCR berjalan setelah respons dikirim (tidak memperlambat customer)
    if (ocrEnabled) after(() => runOcrForProof(proof.id));
    return ok({ ok: true }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
