"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Field, Textarea } from "./input";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-espresso/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-lift animate-fade-in sm:rounded-3xl", widths[size])}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 className="font-display text-xl text-maroon">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-muted hover:bg-cream-100" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children && <div className="overflow-y-auto px-6 pb-4">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Dialog konfirmasi untuk tindakan penting, opsional dengan alasan wajib */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Ya, lanjutkan",
  tone = "primary",
  requireReason,
  reasonLabel = "Alasan",
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  tone?: "primary" | "danger" | "success";
  requireReason?: boolean;
  reasonLabel?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setReason("");
      setErr(null);
    }
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant={tone}
            loading={loading}
            onClick={() => {
              if (requireReason && reason.trim().length < 5) return setErr("Wajib diisi, minimal 5 karakter.");
              onConfirm(reason.trim());
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {children}
      {requireReason && (
        <Field label={reasonLabel} required error={err} className="mt-1">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={500} />
        </Field>
      )}
    </Dialog>
  );
}
