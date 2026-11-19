import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

export const ADMIN_COOKIE = "hakuu_admin";
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET belum diatur (minimal 32 karakter).");
  return new TextEncoder().encode(s);
}

export type AdminSession = { uid: string; role: string; name: string };

export async function createAdminSession(user: { id: string; role: string; name: string }) {
  const token = await new SignJWT({ role: user.role, name: user.name, aud: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroyAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function verifyAdminToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "admin" });
    return { uid: String(payload.sub), role: String(payload.role), name: String(payload.name) };
  } catch {
    return null;
  }
}

/** Ambil sesi admin + pastikan akun masih aktif di database */
export async function getAdmin() {
  const session = await verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}

/** Untuk server component / server action admin */
export async function requireAdmin() {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  return user;
}

/** Untuk route handler: kembalikan null bila tidak berhak */
export async function adminOrNull() {
  return getAdmin();
}
