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
    };
    if (password) body.password = password;

    setSaving(true);
    const url = isEdit ? `/api/staff/${initial!.id}` : "/api/staff";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not save");
      return;
    }
    router.push("/settings");
    router.refresh();
  }

  const selectedColor =
    COLORS.find((c) => c.key === color) || COLORS[0];

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Employees
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">
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
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Personal Info
          </h2>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
          {/* Photo column */}
          <div className="flex flex-col gap-3">
            <div className="w-[140px] h-[140px] rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <User className="w-14 h-14" strokeWidth={1.5} />
            </div>
            <button
              type="button"
              onClick={() =>
                console.log("Photo upload not yet implemented")
              }
              className="w-[140px] text-sm border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 text-slate-700"
            >
              Add Photo
            </button>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" required>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </Field>
            <Field label="Last Name" required>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </Field>
            <Field label="Password" required={!isEdit}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep current" : ""}
                  className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                  className="w-full flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-400"
                >
                  <span
                    className={`w-4 h-4 rounded-full ${selectedColor.swatch}`}
                  />
                  <span className="text-slate-700">{selectedColor.label}</span>
                </button>
                {colorOpen && (
                  <div className="absolute z-10 left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 grid grid-cols-3 gap-1 w-48">
                    {COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setColor(c.key);
                          setColorOpen(false);
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-sm ${
                          c.key === color ? "bg-slate-50" : ""
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${c.swatch}`}
                        />
                        <span className="text-slate-700 text-xs">
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
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Permissions</h2>
        </div>
        <div className="px-6 py-4 space-y-1">
          {PERMISSIONS.map((p) => {
            const checked = permission === p.key;
            return (
              <label
                key={p.key}
                className={`flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                  checked ? "bg-teal-50/50" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="permission"
                  value={p.key}
                  checked={checked}
                  onChange={() => setPermission(p.key)}
                  className="mt-1 accent-teal-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {p.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.description}
                  </div>
                </div>
              </label>
            );
          })}

          {permission === "custom" && (
            <div className="mt-3 ml-7 px-4 py-3 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 bg-slate-50">
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
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
