"use client";
import * as React from "react";

/**
 * Keranjang disimpan di browser HANYA sebagai daftar {productId, quantity, variants}.
 * Harga & total selalu dihitung ulang oleh server (/api/cart/quote dan saat checkout),
 * sehingga manipulasi harga dari browser tidak berpengaruh.
 */
export type CartLine = { productId: string; quantity: number; variants: string[] };

type CartCtx = {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (line: CartLine) => void;
  setQuantity: (index: number, qty: number) => void;
  remove: (index: number) => void;
  clear: () => void;
};

const Ctx = React.createContext<CartCtx | null>(null);
const KEY = "hakuu_cart_v1";

function sameLine(a: CartLine, b: CartLine) {
  return a.productId === b.productId && [...a.variants].sort().join("|") === [...b.variants].sort().join("|");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
          setLines(
            parsed
              .filter((l) => l && typeof l.productId === "string")
              .map((l) => ({ productId: l.productId, quantity: Math.min(999, Math.max(1, Number(l.quantity) || 1)), variants: Array.isArray(l.variants) ? l.variants.map(String) : [] })),
          );
      }
    } catch {
      /* storage tidak tersedia */
    }
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        try {
          setLines(JSON.parse(e.newValue || "[]"));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = React.useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const value = React.useMemo<CartCtx>(
    () => ({
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      add: (line) => {
        const idx = lines.findIndex((l) => sameLine(l, line));
        if (idx >= 0) {
          const next = [...lines];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
          persist(next);
        } else persist([...lines, line]);
      },
      setQuantity: (i, qty) => persist(lines.map((l, j) => (j === i ? { ...l, quantity: Math.max(1, qty) } : l))),
      remove: (i) => persist(lines.filter((_, j) => j !== i)),
      clear: () => persist([]),
    }),
    [lines, ready, persist],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCart harus di dalam CartProvider");
  return c;
}
