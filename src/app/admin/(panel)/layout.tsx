import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin Hakuu" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell user={{ name: user.name, email: user.email, role: user.role }}>{children}</AdminShell>;
}
