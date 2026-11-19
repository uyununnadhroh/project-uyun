import { prisma } from "@/lib/db";
import { adminOrNull } from "@/lib/auth";
import { getOrderAccessList } from "@/lib/order-access";
import { PUBLIC_BUCKETS, readFile, type Bucket } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length !== 2 || !/^[a-z0-9-]+\.(webp|jpg|jpeg|png)$/i.test(path[1])) return new Response("Not found", { status: 404 });
  const [bucket, name] = path as [Bucket, string];
  const key = `${bucket}/${name}`;

if (bucket !== "products" && bucket !== "site") {
    if (bucket !== "proofs") return new Response("Not found", { status: 404 });
    // Bukti transfer bersifat privat: hanya admin atau pemilik pesanan
    const admin = await adminOrNull();
    if (!admin) {
      const allowed = await getOrderAccessList();
      const proof = await prisma.paymentProof.findFirst({ where: { filePath: key }, select: { payment: { select: { order: { select: { orderNumber: true } } } } } });
      if (!proof || !allowed.includes(proof.payment.order.orderNumber)) return new Response("Forbidden", { status: 403 });
    }
  }
  try {
    const data = await readFile(key);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": bucket === "proofs" ? "private, no-store" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
