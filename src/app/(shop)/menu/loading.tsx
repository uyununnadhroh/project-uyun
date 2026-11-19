import { ProductCardSkeleton } from "@/components/shop/product-card";

export default function Loading() {
  return (
    <div className="container-page pt-10 pb-10">
      <div className="skeleton h-4 w-28 rounded" />
      <div className="skeleton mt-4 h-12 w-72 rounded-xl" />
      <div className="skeleton mt-8 h-12 w-full rounded-2xl" />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
