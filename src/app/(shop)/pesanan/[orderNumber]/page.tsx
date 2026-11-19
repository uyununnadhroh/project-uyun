import type { Metadata } from "next";
import { hasOrderAccess } from "@/lib/order-access";
import { getCustomerOrder } from "@/lib/order-view";
import { expireOverdueOrders } from "@/lib/order-service";
import { OrderTracker } from "@/components/shop/order-tracker";
import { TrackForm } from "@/components/shop/track-form";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Pesanan", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ baru?: string }> }) {
  const { orderNumber } = await params;
  const { baru } = await searchParams;
  const no = decodeURIComponent(orderNumber).toUpperCase();
  if (!(await hasOrderAccess(no))) {
    return (
      <div className="container-page max-w-lg pt-10">
        <h1 className="text-3xl text-maroon">Verifikasi Pesanan</h1>
        <p className="mt-2 text-sm text-muted">Masukkan nomor WhatsApp yang digunakan saat memesan untuk melihat detail pesanan.</p>
        <div className="mt-6"><TrackForm defaultOrderNumber={no} /></div>
      </div>
    );
  }
  await expireOverdueOrders();
  const order = await getCustomerOrder(no);
  if (!order) return <div className="container-page pt-10"><EmptyState title="Pesanan tidak ditemukan" /></div>;
  return <OrderTracker initial={order} isNew={baru === "1"} />;
}
