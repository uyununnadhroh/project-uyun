import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { OrderError } from "./order-service";
import { UploadError } from "./storage";
import { fieldErrors } from "./validation";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) return fail(e.issues[0]?.message ?? "Data tidak valid", 422, { fields: fieldErrors(e) });
  if (e instanceof OrderError) return fail(e.message, e.status, e.field ? { fields: { [e.field]: e.message } } : undefined);
  if (e instanceof UploadError) return fail(e.message, e.status);
  console.error(e);
  return fail("Terjadi kesalahan pada server. Silakan coba lagi.", 500);
}
