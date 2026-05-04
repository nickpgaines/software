"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, User } from "lucide-react";

type PermissionLevel =
  | "admin"
  | "manager"
  | "team_lead"
  | "salesperson_all"
  | "salesperson_own"
  | "field_tech"
  | "custom";

type EmployeeInitial = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  color: string | null;
  permission_level: PermissionLevel | null;
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

const PERMISSIONS: {
  key: PermissionLevel;
  title: string;
  description: string;
}[] = [
  { key: "admin", title: "Admin", description: "Can manage all areas." },
  {
    key: "manager",
    title: "Manager",
    description:
      "Can see and edit all jobs, territories, and customer info. Recommended for team leads or office staff that need to view/edit all the jobs in the schedule, and all territories in the territory map.",
  },
  {
    key: "team_lead",
    title: "Team Lead",
    description:
      "Can manage their own jobs as well as the jobs of assigned salespeople. Recommend for team leads that do not need to see all jobs in the schedule, but need to manage the jobs of their assigned salespeople.",
  },
  {
    key: "salesperson_all",
    title: "Salesperson (All Jobs)",
    description:
      "Can see all jobs, can edit jobs and customer info, and can only see their territory but can see/edit all markers. Recommended for salespeople that need to know all of the jobs scheduled across the company.",
  },
  {
    key: "salesperson_own",
    title: "Salesperson (Own Jobs Only)",
    description:
      "Can see only jobs they created or are assigned to them, can edit their own job and customer info, and can see only their territory but can see/edit all markers. Recommended for salespeople that only need to see their own jobs.",
  },
  {
    key: "field_tech",
    title: "Field Tech",
    description:
      "Can only view and edit jobs that are dispatched to them. Recommended for field techs who will be servicing jobs they are dispatched to.",
  },
  {
    key: "custom",
    title: "Custom",
    description:
      "Set custom permissions for this employee. Recommended for employees that need a custom set of permissions.",
  },
];

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
  const [permission, setPermission] = useState<PermissionLevel>(
    initial?.permission_level || "manager"
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initial?.photo_url ?? null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const body: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      email: email.trim(),
      color,
      permission_level: permission,
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
        // not JSON — surface raw text trimmed
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

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
          Employees
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-[40px] font-extrabold tracking-tight leading-none text-white">
            {isEdit ? "Edit Employee" : "Add Employee"}
          </h1>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg px-5 py-2 text-sm font-medium"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Personal Info */}
      <section className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-[#1f1f24]">
          <h2 className="text-base font-extrabold text-white tracking-tight">
            Personal Info
          </h2>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
          {/* Photo column */}
          <div className="flex flex-col gap-3">
            <div className="w-[140px] h-[140px] rounded-lg bg-black border border-[#1f1f24] flex items-center justify-center overflow-hidden">
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              className="w-[140px] text-sm border border-[#2a2a32] hover:border-slate-400 rounded-lg px-3 py-2 text-zinc-300 disabled:opacity-60"
            >
              {photoBusy
                ? "Loading…"
                : photoUrl
                ? "Change Photo"
                : "Add Photo"}
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="w-[140px] text-xs text-zinc-400 hover:text-white"
              >
                Remove
              </button>
            )}
            {photoError && (
              <p className="w-[140px] text-xs text-rose-600">{photoError}</p>
            )}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" required>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-[#2a2a32] rounded-lg px-3 py-2 text-sm bg-[#0f0f12]"
              />
            </Field>
            <Field label="Last Name" required>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-[#2a2a32] rounded-lg px-3 py-2 text-sm bg-[#0f0f12]"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-[#2a2a32] rounded-lg px-3 py-2 text-sm bg-[#0f0f12]"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#2a2a32] rounded-lg px-3 py-2 text-sm bg-[#0f0f12]"
              />
            </Field>
            <Field label="Password" required={!isEdit}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep current" : ""}
                  className="w-full border border-[#2a2a32] rounded-lg pl-3 pr-10 py-2 text-sm bg-[#0f0f12]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </Field>
            <Field label="Color">
              <div ref={colorRef} className="relative">
                <button
                  type="button"
                  onClick={() => setColorOpen((v) => !v)}
                  className="w-full flex items-center gap-2 border border-[#2a2a32] rounded-lg px-3 py-2 text-sm bg-[#0f0f12] hover:border-slate-400"
                >
                  <span
                    className={`w-4 h-4 rounded-full ${selectedColor.swatch}`}
                  />
                  <span className="text-zinc-300">{selectedColor.label}</span>
                </button>
                {colorOpen && (
                  <div className="absolute z-10 left-0 top-full mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-lg shadow-lg p-2 grid grid-cols-3 gap-1 w-48">
                    {COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setColor(c.key);
                          setColorOpen(false);
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-black text-sm ${
                          c.key === color ? "bg-black" : ""
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${c.swatch}`}
                        />
                        <span className="text-zinc-300 text-xs">
                          {c.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>
      </section>

      {/* Permissions */}
      <section className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-[#1f1f24]">
          <h2 className="text-base font-extrabold text-white tracking-tight">Permissions</h2>
        </div>
        <div className="px-6 py-4 space-y-1">
          {PERMISSIONS.map((p) => {
            const checked = permission === p.key;
            return (
              <label
                key={p.key}
                className={`flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                  checked ? "bg-black" : "hover:bg-black"
                }`}
              >
                <input
                  type="radio"
                  name="permission"
                  value={p.key}
                  checked={checked}
                  onChange={() => setPermission(p.key)}
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
              </label>
            );
          })}

          {permission === "custom" && (
            <div className="mt-3 ml-7 px-4 py-3 border border-dashed border-[#2a2a32] rounded-lg text-sm text-zinc-400 bg-black">
              Custom permissions configuration coming soon.
            </div>
          )}
        </div>
      </section>
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
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
