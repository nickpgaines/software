"use client";

import { useEffect, useState } from "react";
import { Plus, FileText, Copy, Pencil, Trash2, GripVertical } from "lucide-react";
import type { LeadForm } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FieldType = "text" | "email" | "tel" | "textarea";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "textarea", label: "Long text" },
];

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  );
}

function parseFields(raw: string | null | undefined): Field[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f: unknown) => {
        if (!f || typeof f !== "object") return null;
        const r = f as Record<string, unknown>;
        const key = typeof r.key === "string" ? r.key : null;
        if (!key) return null;
        const type =
          typeof r.type === "string" && ["text", "email", "tel", "textarea"].includes(r.type)
            ? (r.type as FieldType)
            : "text";
        return {
          key,
          label: typeof r.label === "string" ? r.label : key,
          type,
          required: r.required === true,
        } as Field;
      })
      .filter((f): f is Field => f !== null);
  } catch {
    return [];
  }
}

export default function LeadsFormsClient({
  initialForms,
}: {
  initialForms: LeadForm[];
}) {
  const [forms, setForms] = useState<LeadForm[]>(initialForms);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<LeadForm | null>(null);
  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function createForm() {
    if (!name.trim()) return;
    const res = await fetch("/api/lead-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const created = (await res.json()) as LeadForm;
      setForms((cur) => [created, ...cur]);
      setName("");
      setShowNew(false);
    }
  }

  async function toggle(id: number, enabled: boolean) {
    const prev = forms;
    setForms((cur) =>
      cur.map((f) => (f.id === id ? { ...f, enabled: enabled ? 1 : 0 } : f))
    );
    try {
      await fetch(`/api/lead-forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    } catch {
      setForms(prev);
    }
  }

  async function copyLink(form: LeadForm) {
    const url = `${origin}/forms/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id);
      setTimeout(() => setCopiedId((cur) => (cur === form.id ? null : cur)), 1500);
    } catch {
      // ignore — user can still click "Open" to grab the URL from the bar
    }
  }

  async function saveFields(form: LeadForm, fields: Field[]) {
    const fieldsJson = JSON.stringify(fields);
    setForms((cur) =>
      cur.map((f) => (f.id === form.id ? { ...f, fields: fieldsJson } : f))
    );
    await fetch(`/api/lead-forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsJson }),
    });
  }

  async function deleteForm(form: LeadForm) {
    if (!confirm(`Delete "${form.name}"? This can't be undone.`)) return;
    setForms((cur) => cur.filter((f) => f.id !== form.id));
    await fetch(`/api/lead-forms/${form.id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <h2 className="text-page-title text-white">Forms</h2>
        <p className="text-sm text-zinc-400 font-bold">
          Create web forms that drop new leads into your pipeline
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowNew(true)}
          className="h-auto gap-1.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-bold px-4 py-2 rounded-full"
        >
          <Plus className="w-4 h-4" />
          Add Form
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="border border-dashed border-line rounded-2xl p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-black flex items-center justify-center text-zinc-500">
            <FileText className="w-5 h-5" />
          </div>
          <p className="mt-3 font-bold text-white tracking-tight">No forms yet</p>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Build a form, share its link, and new leads land in your pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => {
            const enabled = !!f.enabled;
            const publicUrl = origin ? `${origin}/forms/${f.slug}` : `/forms/${f.slug}`;
            return (
              <div
                key={f.id}
                className="border border-line rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-white tracking-tight truncate">
                    {f.name}
                  </div>
                  <a
                    href={`/forms/${f.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-400 mt-0.5 break-all hover:text-white"
                  >
                    {publicUrl}
                  </a>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {f.submit_count} submissions
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => copyLink(f)}
                    title="Copy public link"
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                  >
                    {copiedId === f.id ? (
                      <span className="text-[10px] font-bold">Copied</span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(f)}
                    title="Edit fields"
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => deleteForm(f)}
                    title="Delete form"
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <span
                    className={
                      "text-xs px-3 py-1 rounded-full " +
                      (enabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-black text-zinc-400")
                    }
                  >
                    {enabled ? "Live" : "Disabled"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggle(f.id, !enabled)}
                    className={
                      "relative w-10 h-6 p-0 rounded-full hover:bg-current " +
                      (enabled ? "bg-emerald-500 hover:bg-emerald-500" : "bg-line-strong hover:bg-line-strong")
                    }
                  >
                    <span
                      className={
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform " +
                        (enabled ? "translate-x-4" : "")
                      }
                    />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        // Native modal wrapper kept: matches the deviations policy in
        // DESIGN_SYSTEM.md §10 for fixed-inset modal shells across this app.
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white tracking-tight mb-4">
              New form
            </h3>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Form name"
              className="w-full h-auto border-line rounded-lg px-3 py-2 text-sm focus-visible:ring-line-strong"
            />
            <p className="text-xs text-zinc-400 mt-2">
              Default fields: first name, last name, email, phone. Edit them
              after creating.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNew(false)}
                className="h-auto px-4 py-2 text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={createForm}
                className="h-auto px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full font-bold"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <FieldsEditor
          form={editing}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            await saveFields(editing, fields);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function FieldsEditor({
  form,
  onClose,
  onSave,
}: {
  form: LeadForm;
  onClose: () => void;
  onSave: (fields: Field[]) => Promise<void>;
}) {
  const [fields, setFields] = useState<Field[]>(() => parseFields(form.fields));
  const [saving, setSaving] = useState(false);

  function updateField(i: number, patch: Partial<Field>) {
    setFields((cur) =>
      cur.map((f, idx) => {
        if (idx !== i) return f;
        const next = { ...f, ...patch };
        // If the label changes and the key still matches the auto-slug of the
        // previous label, regenerate the key so the new label drives it.
        // Once a user manually edits the key, leave it alone.
        if (patch.label !== undefined && f.key === slugify(f.label)) {
          next.key = slugify(patch.label);
        }
        return next;
      })
    );
  }

  function move(i: number, dir: -1 | 1) {
    setFields((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addField() {
    setFields((cur) => [
      ...cur,
      {
        key: `field_${cur.length + 1}`,
        label: "New field",
        type: "text",
        required: false,
      },
    ]);
  }

  function removeField(i: number) {
    setFields((cur) => cur.filter((_, idx) => idx !== i));
  }

  async function save() {
    // Force unique keys; if a user names two fields identically, suffix
    // the duplicates so the submission payload doesn't collide.
    const seen = new Map<string, number>();
    const deduped = fields.map((f) => {
      const baseKey = f.key || slugify(f.label);
      const n = seen.get(baseKey) || 0;
      seen.set(baseKey, n + 1);
      return { ...f, key: n === 0 ? baseKey : `${baseKey}_${n + 1}` };
    });
    setSaving(true);
    try {
      await onSave(deduped);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit form fields — {form.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {fields.length === 0 ? (
            <p className="text-sm font-bold text-fg-muted text-center py-6">
              No fields yet. Add one to get started.
            </p>
          ) : (
            fields.map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-line p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-fg-muted hover:text-fg disabled:opacity-30 text-xs"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <GripVertical className="w-3 h-3 text-fg-muted" />
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === fields.length - 1}
                      className="text-fg-muted hover:text-fg disabled:opacity-30 text-xs"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label
                        className="text-[11px]"
                        htmlFor={`field-label-${i}`}
                      >
                        Label
                      </Label>
                      <Input
                        id={`field-label-${i}`}
                        value={f.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        className="text-[11px]"
                        htmlFor={`field-type-${i}`}
                      >
                        Type
                      </Label>
                      {/* Native select kept: matches the deviation policy. */}
                      <select
                        id={`field-type-${i}`}
                        value={f.type}
                        onChange={(e) =>
                          updateField(i, { type: e.target.value as FieldType })
                        }
                        className="flex h-10 w-full rounded-md border border-line bg-card px-3 py-2 text-sm font-bold"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeField(i)}
                    className="h-8 w-8 p-0 text-fg-muted hover:text-rose-400 shrink-0"
                    title="Remove field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between pl-7">
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <Checkbox
                      checked={f.required}
                      onCheckedChange={(v) =>
                        updateField(i, { required: v === true })
                      }
                    />
                    Required
                  </label>
                  <code className="text-[10px] text-fg-muted">
                    key: {f.key}
                  </code>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-line">
          <Button type="button" variant="outline" onClick={addField}>
            <Plus className="w-4 h-4 mr-1" />
            Add field
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-fg-muted pt-1">
          Tip: use the keys{" "}
          <code className="font-bold">first_name</code>,{" "}
          <code className="font-bold">last_name</code>,{" "}
          <code className="font-bold">email</code>,{" "}
          <code className="font-bold">phone</code>,{" "}
          <code className="font-bold">address</code> to fill those columns on
          the lead. Everything else lands in the lead&apos;s notes.
        </p>
      </DialogContent>
    </Dialog>
  );
}
