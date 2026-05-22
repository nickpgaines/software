"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUILT_IN_ROLES,
  BUILT_IN_ROLE_LABELS,
  BUILT_IN_ROLE_DESCRIPTIONS,
  type BuiltInRole,
  type Permission,
} from "@/lib/permissions";
import RoleEditorModal, {
  type RoleSummary,
} from "@/components/RoleEditorModal";

type PermissionLevel = BuiltInRole;

type EmployeeInitial = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  color: string | null;
  permission_level: PermissionLevel | string | null;
  custom_role_id: number | null;
  photo_url: string | null;
};

const COLORS: { key: string; label: string; swatch: string }[] = [
  { key: "blue", label: "Blue", swatch: "bg-blue-500" },
  { key: "green", label: "Green", swatch: "bg-green-500" },
  { key: "red", label: "Red", swatch: "bg-red-500" },
  { key: "yellow", label: "Yellow", swatch: "bg-yellow-400" },
  { key: "purple", label: "Purple", swatch: "bg-purple-500" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500" },
  { key: "teal", label: "Teal", swatch: "bg-teal-500" },
  { key: "pink", label: "Pink", swatch: "bg-pink-500" },
  { key: "gray", label: "Gray", swatch: "bg-slate-400" },
];

const ROLE_SWATCH_FROM_COLOR: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  gray: "bg-slate-400",
};

const BUILT_IN_OPTIONS: {
  key: BuiltInRole;
  title: string;
  description: string;
}[] = BUILT_IN_ROLES.map((k) => ({
  key: k,
  title: BUILT_IN_ROLE_LABELS[k],
  description: BUILT_IN_ROLE_DESCRIPTIONS[k],
}));

type SelectedRole =
  | { kind: "builtin"; value: BuiltInRole }
  | { kind: "custom"; id: number };

export default function EmployeeForm({
  initial,
}: {
  initial?: EmployeeInitial;
}) {
  const router = useRouter();
  const isEdit = !!initial;

  const [firstName, setFirstName] = useState(initial?.first_name || "");
  const [lastName, setLastName] = useState(initial?.last_name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [color, setColor] = useState(initial?.color || "blue");

  const initialSelected: SelectedRole = (() => {
    if (initial?.custom_role_id) {
      return { kind: "custom", id: initial.custom_role_id };
    }
    const lvl = (initial?.permission_level || "admin") as string;
    if (lvl === "admin" || lvl === "salesperson" || lvl === "technician") {
      return { kind: "builtin", value: lvl };
    }
    return { kind: "builtin", value: "admin" };
  })();
  const [selectedRole, setSelectedRole] =
    useState<SelectedRole>(initialSelected);

  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initial?.photo_url ?? null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const [customRoles, setCustomRoles] = useState<RoleSummary[]>([]);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/roles")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: RoleSummary[]) => {
        if (!cancelled) setCustomRoles(Array.isArray(d) ? d : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!colorRef.current?.contains(e.target as Node)) setColorOpen(false);
    }
    if (colorOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [colorOpen]);

  async function processImage(file: File): Promise<string> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not read image"));
        el.src = objectUrl;
      });
      const MAX = 320;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.85);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("Image is too large (max 8 MB)");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await processImage(file);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not load image");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    if (!firstName.trim()) return setError("First name is required");
    if (!lastName.trim()) return setError("Last name is required");
    if (!email.trim()) return setError("Email is required");
    if (!isEdit && !password) return setError("Password is required");

    // When a custom role is selected we still need to write *some* built-in
    // value to permission_level so legacy queries that look at that column
    // don't blow up. Use 'admin' as the safe fallback; the resolved perms
    // come from the custom role anyway.
    const permission_level: BuiltInRole =
      selectedRole.kind === "builtin" ? selectedRole.value : "admin";
    const custom_role_id =
      selectedRole.kind === "custom" ? selectedRole.id : null;

    const body: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      email: email.trim(),
      color,
      permission_level,
      custom_role_id,
      photo_url: photoUrl,
    };
    if (password) body.password = password;

    setSaving(true);
    const url = isEdit ? `/api/staff/${initial!.id}` : "/api/staff";
    const method = isEdit ? "PATCH" : "POST";
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
    router.push("/employees");
    router.refresh();
  }

  const selectedColor =
    COLORS.find((c) => c.key === color) || COLORS[0];

  function onSavedRole(role: RoleSummary) {
    setCustomRoles((prev) => {
      const without = prev.filter((r) => r.id !== role.id);
      return [...without, role].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    });
    setSelectedRole({ kind: "custom", id: role.id });
    setRoleEditorOpen(false);
    setEditingRole(null);
  }

  function onDeletedRole(roleId: number) {
    setCustomRoles((prev) => prev.filter((r) => r.id !== roleId));
    if (selectedRole.kind === "custom" && selectedRole.id === roleId) {
      setSelectedRole({ kind: "builtin", value: "admin" });
    }
    setRoleEditorOpen(false);
    setEditingRole(null);
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 font-bold hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
          Employees
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-page-title text-white">
            {isEdit ? "Edit Employee" : "Add Employee"}
          </h1>
          <Button
            type="submit"
            variant="ghost"
            disabled={saving}
            className="h-auto gap-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-lg px-5 py-2 text-sm font-bold"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Personal Info */}
      <section className="bg-card border border-line rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="text-base font-extrabold text-white tracking-tight">
            Personal Info
          </h2>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
          {/* Photo column */}
          <div className="flex flex-col gap-3">
            <div className="w-[140px] h-[140px] rounded-lg bg-black border border-line flex items-center justify-center overflow-hidden">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Employee"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User
                  className="w-14 h-14 text-zinc-500"
                  strokeWidth={1.5}
                />
              )}
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              className="w-[140px] h-auto text-sm border border-line-strong hover:border-slate-400 rounded-lg px-3 py-2 text-zinc-300 hover:bg-transparent font-bold"
            >
              {photoBusy
                ? "Loading…"
                : photoUrl
                ? "Change Photo"
                : "Add Photo"}
            </Button>
            {photoUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPhotoUrl(null)}
                className="w-[140px] h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent font-bold"
              >
                Remove
              </Button>
            )}
            {photoError && (
              <p className="w-[140px] text-xs text-rose-600">{photoError}</p>
            )}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" required>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-auto border-line-strong rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <Field label="Last Name" required>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-auto border-line-strong rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-auto border-line-strong rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-auto border-line-strong rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <Field label="Password" required={!isEdit}>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep current" : ""}
                  className="w-full h-auto border-line-strong rounded-lg pl-3 pr-10 py-2 text-sm bg-card"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </Field>
            <Field label="Color">
              <div ref={colorRef} className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setColorOpen((v) => !v)}
                  className="w-full h-auto justify-start gap-2 border border-line-strong rounded-lg px-3 py-2 text-sm bg-card hover:border-slate-400 hover:bg-transparent"
                >
                  <span
                    className={`inline-block w-3.5 h-3.5 rounded-full shrink-0 ${selectedColor.swatch}`}
                  />
                  <span className="text-zinc-300">{selectedColor.label}</span>
                </Button>
                {colorOpen && (
                  <div className="absolute z-10 left-0 top-full mt-1 bg-card border border-line rounded-lg shadow-lg p-2 grid grid-cols-3 gap-1 w-48">
                    {COLORS.map((c) => (
                      <Button
                        key={c.key}
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setColor(c.key);
                          setColorOpen(false);
                        }}
                        className={`h-auto justify-start gap-2 px-2 py-1.5 rounded hover:bg-black text-sm font-bold ${
                          c.key === color ? "bg-black" : ""
                        }`}
                      >
                        <span
                          className={`inline-block w-3.5 h-3.5 rounded-full shrink-0 ${c.swatch}`}
                        />
                        <span className="text-zinc-300 text-xs">
                          {c.label}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>
      </section>

      {/* Permissions */}
      <section className="bg-card border border-line rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white tracking-tight">
            Permissions
          </h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditingRole(null);
              setRoleEditorOpen(true);
            }}
            className="h-auto gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-300 border border-line-strong hover:border-slate-400 hover:bg-transparent"
          >
            <Plus className="w-3.5 h-3.5" />
            New Custom Role
          </Button>
        </div>
        <div className="px-6 py-4 space-y-1">
          {BUILT_IN_OPTIONS.map((p) => {
            const checked =
              selectedRole.kind === "builtin" && selectedRole.value === p.key;
            return (
              <Label
                key={p.key}
                className={`flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer font-normal ${
                  checked ? "bg-black" : "hover:bg-black"
                }`}
              >
                {/* Native <input type="radio"> kept: no Radio primitive in components/ui yet. */}
                <input
                  type="radio"
                  name="permission"
                  value={p.key}
                  checked={checked}
                  onChange={() =>
                    setSelectedRole({ kind: "builtin", value: p.key })
                  }
                  className="mt-1 accent-slate-900"
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

          {customRoles.length > 0 && (
            <div className="pt-3 mt-2 border-t border-line space-y-1">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wider text-zinc-500 font-bold">
                Custom Roles
              </div>
              {customRoles.map((r) => {
                const checked =
                  selectedRole.kind === "custom" && selectedRole.id === r.id;
                return (
                  <Label
                    key={r.id}
                    className={`flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer font-normal ${
                      checked ? "bg-black" : "hover:bg-black"
                    }`}
                  >
                    {/* Native <input type="radio"> kept: no Radio primitive in components/ui yet. */}
                    <input
                      type="radio"
                      name="permission"
                      checked={checked}
                      onChange={() =>
                        setSelectedRole({ kind: "custom", id: r.id })
                      }
                      className="mt-1 accent-slate-900"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-3 h-3 rounded-full shrink-0 ${
                            ROLE_SWATCH_FROM_COLOR[r.color] || "bg-blue-500"
                          }`}
                        />
                        <div className="text-sm font-extrabold text-white tracking-tight">
                          {r.name}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {r.permissions.length} permission
                        {r.permissions.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditingRole(r);
                        setRoleEditorOpen(true);
                      }}
                      className="h-auto px-2 py-1 text-xs font-bold text-zinc-400 hover:text-white hover:bg-transparent"
                    >
                      Edit
                    </Button>
                  </Label>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <RoleEditorModal
        open={roleEditorOpen}
        initial={editingRole}
        onClose={() => {
          setRoleEditorOpen(false);
          setEditingRole(null);
        }}
        onSaved={onSavedRole}
        onDeleted={onDeletedRole}
      />
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="block text-xs font-bold text-zinc-500 mb-2">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
