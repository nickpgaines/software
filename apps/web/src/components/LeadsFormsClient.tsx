"use client";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import type { LeadForm } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LeadsFormsClient({
  initialForms,
}: {
  initialForms: LeadForm[];
}) {
  const [forms, setForms] = useState<LeadForm[]>(initialForms);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

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

  return (
    <div className="space-y-6">
      <div>
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
          className="h-auto gap-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-bold px-4 py-2 rounded-full"
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
            return (
              <div
                key={f.id}
                className="border border-line rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-extrabold text-white tracking-tight">{f.name}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 break-all">
                    /forms/{f.slug}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {f.submit_count} submissions
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
              Default fields: first name, last name, email, phone. You can
              customize them later.
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
                className="h-auto px-4 py-2 text-sm bg-sky-400 hover:bg-sky-500 text-white rounded-full font-bold"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
