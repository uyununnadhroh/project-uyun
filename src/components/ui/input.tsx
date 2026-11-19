import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-espresso placeholder:text-muted/70 transition focus:border-caramel focus:outline-none focus:ring-4 focus:ring-caramel/20 disabled:bg-cream-100 disabled:opacity-70 aria-[invalid=true]:border-red-400";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(base, "h-11", className)} {...p} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-24 py-2.5 leading-relaxed", className)} {...p} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        base,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237e4722' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9",
        className,
      )}
      {...p}
    />
  );
});

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-espresso", className)} {...p} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label} {required && <span className="text-red-600">*</span>}
        </Label>
      )}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded accent-maroon" {...p} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-white p-3.5">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-maroon" : "bg-sand")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-5.5" : "left-0.5")} />
      </button>
    </label>
  );
}
