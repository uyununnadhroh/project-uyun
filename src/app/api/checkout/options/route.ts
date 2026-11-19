import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getAvailability, orderWindow } from "@/lib/order-service";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await getSettings();
    const { from, to } = orderWindow(s);
    const [banks, days] = await Promise.all([
      prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, bankName: true, accountNumber: true, accountHolder: true } }),
      getAvailability(from, to, s),
    ]);
    return ok({
      pickupEnabled: s.pickupEnabled,
      deliveryEnabled: s.deliveryEnabled,
      deliveryFee: s.deliveryFee,
      deliveryNote: s.deliveryNote,
      pickupAddress: s.address,
      pickupInstructions: s.pickupInstructions,
      operatingHours: s.operatingHours,
      cashEnabled: s.cashEnabled,
      transferEnabled: s.transferEnabled && banks.length > 0,
      paymentDeadlineHours: s.paymentDeadlineHours,
      timeSlots: s.timeSlots,
      banks,
      days,
    });
  } catch (e) {
    return handleError(e);
  }
}
