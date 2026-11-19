import "server-only";
import { headers } from "next/headers";

/** Rate limiter sederhana di memori (cukup untuk satu instance). Untuk multi-instance gunakan Redis. */
const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(name: string, limit: number, windowMs: number) {
  // RATE_LIMIT_MULTIPLIER dapat dinaikkan untuk test otomatis (default 1)
  limit = limit * Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return b.count <= limit;
}
