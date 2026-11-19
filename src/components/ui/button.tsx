import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-maroon text-cream hover:bg-maroon-600 shadow-sm",
  caramel: "bg-caramel text-maroon hover:bg-caramel-dark hover:text-white",
  secondary: "bg-cream-200 text-maroon hover:bg-sand",
  outline: "border border-line bg-white text-espresso hover:border-caramel hover:bg-cream-100",
  ghost: "text-espresso hover:bg-cream-200",
  danger: "bg-red-700 text-white hover:bg-red-800",
  success: "bg-emerald-700 text-white hover:bg-emerald-800",
  whatsapp: "bg-[#1f9d55] text-white hover:bg-[#178a49]",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2",
  icon: "h-10 w-10",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function buttonClass(variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
