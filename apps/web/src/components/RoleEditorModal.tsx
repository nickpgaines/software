"use client";

import { useEffect, useState } from "react";
import { Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PERMISSION_GROUPS,
  type Permission,
} from "@/lib/permissions";

export type RoleSummary = {
  id: number;
  name: string;
  permissions: Permission[];
};

export default function RoleEditorModal({
  open,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  initial: RoleSummary | null;
  onClose: () => void;
  onSaved: (role: RoleSummary) => void;
  onDeleted: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Set<Permission>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setPerms(new Set(initial?.permissions || []));
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, initial]);

  if (!open) return null;

  function togglePerm(key: Permission) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return setError("Role name is required");
    if (perms.size === 0) return setError("Select at least one permission");

    setSaving(true);
    const body = {
      name: trimmed,
      permissions: Array.from(perms),
    };
    const url = initial ? `/api/roles/${initial.id}` : "/api/roles";
    const method = initial ? "PATCH" : "POST";
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Network error");
      return;
    }
    setSaving(false);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = "";
      try {
        message = (JSON.parse(text) as { error?: string }).error || "";
      } catch {
        message = text.slice(0, 200);
      }
      setError(message || `Could not save (HTTP ${res.status})`);
      return;
    }
    const saved = (await res.json()) as RoleSummary;
    onSaved(saved);
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const res = await fetch(`/api/roles/${initial.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setError("Could not delete role");
      return;
    }
    onDeleted(initial.id);
  }

  const totalSelected = perms.size;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-card border border-line rounded-2xl shadow-xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-line">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-black border border-line flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-zinc-300" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {initial ? "Edit Role" : "Create New Role"}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Define a role with specific permissions
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-auto p-1.5 text-zinc-400 hover:text-white hover:bg-transparent"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-2">
              Role Name<span className="text-rose-500 ml-0.5">*</span>
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter role name"
              className="w-full h-auto border-line-strong rounded-lg px-3 py-2 text-sm bg-card"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Choose a descriptive name that clearly identifies this role&apos;s
              responsibilities
            </p>
          </div>

          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-1">
              Permissions<span className="text-rose-500 ml-0.5">*</span>
            </Label>
            <p className="mb-4 text-xs text-zinc-500">
              Select the permissions this role should have. Choose at least one
              permission to create the role.
            </p>

            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => (
                <div
                  key={group.key}
                  className="border border-line rounded-xl p-4 space-y-3"
                >
                  <div className="text-sm font-extrabold text-white tracking-tight">
                    {group.label}
                  </div>
                  <div className="space-y-2">
                    {group.permissions.map((p) => {
                      const checked = perms.has(p.key);
                      return (
                        <Label
                          key={p.key}
                          className="flex items-start gap-3 px-2 py-2 rounded-lg cursor-pointer font-normal hover:bg-black"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePerm(p.key)}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-sm font-extrabold text-white tracking-tight">
                              {p.title}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {p.description}
                            </div>
                          </div>
                        </Label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 px-3 py-2 rounded-lg bg-black border border-line text-xs font-bold text-zinc-300">
              Selected {totalSelected} permission
              {totalSelected === 1 ? "" : "s"}
            </div>
          </div>

          {error && (
            <div className="text-sm font-bold text-rose-400">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-line">
          <div>
            {initial && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-400">
                    Delete this role?
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={remove}
                    disabled={saving}
                    className="h-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/15 text-rose-300 border border-rose-600/40 hover:bg-rose-600/25"
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    className="h-auto px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="h-auto gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-transparent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Role
                </Button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-auto px-4 py-2 rounded-lg text-sm font-bold text-zinc-300 border border-line-strong hover:border-slate-400 hover:bg-transparent"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={save}
              disabled={saving}
              className="h-auto px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : initial ? "Save Role" : "Create Role"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
