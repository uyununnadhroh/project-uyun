import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-dashed border-sand bg-white/60 px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-cream-200 text-brown">{icon}</div>}
      <h3 className="font-display text-xl text-maroon">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Terjadi kesalahan", description, action }: { title?: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
      <h3 className="font-semibold text-red-800">{title}</h3>
      {description && <p className="mt-1 text-sm text-red-700">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "success" | "danger"; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const t = {
    info: "border-sand bg-cream-100 text-espresso",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm", t, className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
    </div>
  );
}
