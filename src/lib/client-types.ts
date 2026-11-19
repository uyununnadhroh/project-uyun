export type QuoteLine = {
  key: string;
  productId: string;
  productName: string;
  productSlug: string;
  productType: "REGULAR" | "PACKAGE";
  imageUrl: string | null;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  packageSize: number | null;
  variants: { slotNumber: number; variantId: string; variantName: string }[];
  units: number;
  maxQty: number;
  error: string | null;
};
export type Quote = { lines: QuoteLine[]; subtotal: number; units: number; hasError: boolean };
