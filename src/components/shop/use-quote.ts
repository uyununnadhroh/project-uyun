"use client";
import { useEffect, useState } from "react";
import type { CartLine } from "./cart-context";
import type { Quote } from "@/lib/client-types";

export function useQuote(lines: CartLine[], ready: boolean) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(lines);
  useEffect(() => {
    if (!ready) return;
    if (!lines.length) {
      setQuote({ lines: [], subtotal: 0, units: 0, hasError: false });
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/cart/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: lines }), signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Gagal memuat keranjang");
        setQuote(j);
        setError(null);
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  return { quote, error, loading };
}
