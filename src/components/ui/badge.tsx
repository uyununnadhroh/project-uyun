import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
  teal: "bg-teal-50 text-teal-800 ring-teal-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  gray: "bg-stone-100 text-stone-600 ring-stone-200",
  brand: "bg-cream-200 text-maroon ring-sand",
  maroon: "bg-maroon text-cream ring-maroon",
};

export function Badge({ tone = "gray", className, children }: { tone?: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone] ?? tones.gray, className)}>
      {children}
    </span>
  );
}
