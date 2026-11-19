"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

export function TrackForm({ defaultOrderNumber = "" }: { defaultOrderNumber?: string }) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (orderNumber.trim().length < 5) return setError("Masukkan nomor pesanan, contoh: HKU-261118-ABCDE");
    if (phone.replace(/\D/g, "").length < 9) return setError("Masukkan nomor WhatsApp yang valid.");
    setBusy(true);
    try {
      const r = await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber, phone }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      router.push(`/pesanan/${j.orderNumber}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nomor pesanan" htmlFor="no" required>
        <Input id="no" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="HKU-XXXXXX-XXXXX" autoCapitalize="characters" className="font-mono tracking-wide" />
      </Field>
      <Field label="Nomor WhatsApp" htmlFor="wa" required>
        <Input id="wa" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>Lacak Pesanan</Button>
    </form>
  );
}
