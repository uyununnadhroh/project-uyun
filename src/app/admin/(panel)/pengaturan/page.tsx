import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getAvailability } from "@/lib/order-service";
import { PageHeader } from "@/components/admin/shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { CapacityManager, AccountPanel, HeroUploader } from "@/components/admin/settings-extra";
import { todayWIB, ymd } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireAdmin();
  const s = await getSettings();
  const today = todayWIB();
  const [overrides, upcoming, users] = await Promise.all([
    prisma.dailyProductionCapacity.findMany({ where: { date: { gte: new Date(`${today}T00:00:00Z`) } }, orderBy: { date: "asc" } }),
    getAvailability(today, todayWIB(13), s),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } }),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="Semua informasi bisnis diatur di sini — tidak ada data yang di-hardcode." />
      <div className="space-y-6">
        <HeroUploader current={s.heroImageUrl} />
        <SettingsForm initial={s} />
        <CapacityManager
          defaultCapacity={s.defaultDailyCapacity}
          overrides={overrides.map((o) => ({ id: o.id, date: ymd(o.date), capacity: o.capacity, isClosed: o.isClosed, note: o.note }))}
          upcoming={upcoming}
        />
        <AccountPanel me={{ id: me.id, role: me.role }} users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))} />
      </div>
    </>
  );
}
