"use client";
import { useState } from "react";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-[2rem] border border-line bg-cream-100 shadow-soft">
        <ProductImage src={images[i]} alt={name} priority />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
          {images.map((src, j) => (
            <button key={src} onClick={() => setI(j)} className={cn("h-18 w-18 shrink-0 overflow-hidden rounded-xl border-2 transition", j === i ? "border-maroon" : "border-transparent opacity-70 hover:opacity-100")} aria-label={`Foto ${j + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
