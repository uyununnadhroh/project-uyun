"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

type FieldDef = { name: string; label: string; type?: "text" | "number" | "switch" | "textarea"; hint?: string; required?: boolean; placeholder?: string };
type Item = { id: string; [k: string]: unknown };

export function EntityManager({
  items,
  fields,
  columns,
  title,
  addLabel,
  emptyTitle,
  emptyDescription,
  defaults,
  onSave,
  onDelete,
  deleteWarning,
}: {
  items: Item[];
  fields: FieldDef[];
  columns: { key: string; label: string; render?: "badge-active" | "mono" | "text" }[];
  title: string;
  addLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  defaults: Record<string, unknown>;
  onSave: (id: string | null, data: unknown) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  deleteWarning?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; data: Record<string, unknown> } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await onSave(editing.id, editing.data);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(`${title} disimpan`);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setErrors({}); setEditing({ id: null, data: { ...defaults } }); }}><Plus className="h-4 w-4" /> {addLabel}</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line bg-cream-100 text-left text-xs tracking-wide text-muted uppercase">
              <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}<th className="w-24 px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-cream/60">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {c.render === "badge-active" ? (it[c.key] ? <Badge tone="green">Aktif</Badge> : <Badge tone="gray">Nonaktif</Badge>) : c.render === "mono" ? <span className="font-mono">{String(it[c.key] ?? "")}</span> : String(it[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-full p-2 text-muted hover:bg-cream-200 hover:text-maroon" aria-label="Edit" onClick={() => { setErrors({}); setEditing({ id: it.id, data: Object.fromEntries(fields.map((f) => [f.name, it[f.name] ?? defaults[f.name]])) }); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Hapus" onClick={() => setToDelete(it)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${title}` : addLabel}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Batal</Button><Button onClick={save} loading={pending}>Simpan</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            {fields.map((f) =>
              f.type === "switch" ? (
                <Switch key={f.name} checked={!!editing.data[f.name]} onChange={(b) => setEditing({ ...editing, data: { ...editing.data, [f.name]: b } })} label={f.label} description={f.hint} />
              ) : (
                <Field key={f.name} label={f.label} required={f.required} error={errors[f.name]} hint={f.hint}>
                  {f.type === "textarea" ? (
                    <Textarea value={String(editing.data[f.name] ?? "")} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, [f.name]: e.target.value } })} />
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : "text"}
                      placeholder={f.placeholder}
                      value={String(editing.data[f.name] ?? "")}
                      aria-invalid={!!errors[f.name]}
                      onChange={(e) => setEditing({ ...editing, data: { ...editing.data, [f.name]: e.target.value } })}
                    />
                  )}
                </Field>
              ),
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Hapus ${title.toLowerCase()}?`}
        description={deleteWarning}
        tone="danger"
        confirmText="Hapus"
        loading={pending}
        onConfirm={() =>
          start(async () => {
            const r = await onDelete(toDelete!.id);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Dihapus");
            setToDelete(null);
            router.refresh();
          })
        }
      />
    </>
  );
}
