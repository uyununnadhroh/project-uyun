"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createAdminSession, destroyAdminSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function loginAction(_: unknown, form: FormData) {
  if (!(await rateLimit("login", 8, 15 * 60_000))) return { error: "Terlalu banyak percobaan login. Coba lagi 15 menit lagi." };
  const email = String(form.get("email") || "").toLowerCase().trim();
  const password = String(form.get("password") || "");
  if (!email || !password) return { error: "Email dan password wajib diisi." };
  const user = await prisma.user.findUnique({ where: { email } });
  // Bandingkan hash walau user tidak ada agar waktu respons seragam
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok || !user.isActive) return { error: "Email atau password salah." };
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createAdminSession(user);
  const next = String(form.get("next") || "/admin");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}
