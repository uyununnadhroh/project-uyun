import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Customer tidak memiliki akun. Akses ke detail pesanan diberikan melalui cookie bertanda tangan
 * yang berisi daftar nomor pesanan yang sudah diverifikasi (saat checkout atau lacak pesanan
 * dengan nomor pesanan + nomor WhatsApp).
 */
const COOKIE = "hakuu_orders";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

export async function getOrderAccessList(): Promise<string[]> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "order-access" });
    return Array.isArray(payload.orders) ? (payload.orders as string[]) : [];
  } catch {
    return [];
  }
}

export async function grantOrderAccess(orderNumber: string) {
  const list = (await getOrderAccessList()).filter((o) => o !== orderNumber);
  list.unshift(orderNumber);
  const token = await new SignJWT({ orders: list.slice(0, 20), aud: "order-access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 90 * 86400,
  });
}

export async function hasOrderAccess(orderNumber: string) {
  return (await getOrderAccessList()).includes(orderNumber);
}
