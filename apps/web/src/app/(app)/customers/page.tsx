"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function CustomersPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CustomersPage />
    </Suspense>
  );
}

type Customer = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

function fullName(c: { first_name: string | null; last_name: string | null }) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  async function load() {
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreating(true);
      router.replace("/customers");
    }
  }, [searchParams, router]);

  async function del(id: number) {
    if (!confirm("Delete this customer and all their jobs?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">
            People you clean windows for.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2"
        >
          + Customer
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No customers yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Address</th>
                <th className="text-left px-4 py-2 font-medium">Phone</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {fullName(c) || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{c.address || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{c.phone || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{c.email || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setEditing(c)}
                      className="text-xs text-slate-500 hover:text-slate-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => del(c.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <CustomerForm
          customer={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }
    setSaving(true);
    const res = await fetch(
      customer ? `/api/customers/${customer.id}` : "/api/customers",
      {
        method: customer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          address,
          notes,
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      setError("Could not save customer");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-medium">
            {customer ? "Edit customer" : "New customer"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                autoFocus
                required
              />
            </Field>
            <Field label="Last name" required>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                type="tel"
                value={phone ?? ""}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Address">
            <input
              type="text"
              value={address ?? ""}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm border border-slate-300 bg-white hover:bg-slate-50 rounded px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded px-3 py-2"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
