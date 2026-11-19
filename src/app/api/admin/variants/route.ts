import { prisma } from "@/lib/db";
import { adminOrNull } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await adminOrNull())) return fail("Unauthorized", 401);
  return ok(await prisma.productVariant.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }));
}
