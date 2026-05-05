"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ImportModal from "@/components/customers/ImportModal";
import AddressFields, {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/components/customers/AddressFields";
import { usePhone } from "@/components/PhoneClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Customer = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  address_line1: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  notes: string | null;
};

function customerToAddress(c: Customer | null): AddressValue {
  if (!c) return { ...EMPTY_ADDRESS };
  // If structured fields are blank but the legacy address has a value,
  // surface it in line1 so legacy customers don't appear "empty" in the
  // form (the user can still pick a Places suggestion to fill the rest).
  const line1 =
    c.address_line1?.trim() ||
    (c.address_line1 == null && c.formatted_address == null
      ? c.address?.trim() || ""
      : c.address_line1?.trim() || "");
  return {
    address_line1: line1,
    unit: c.unit ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    zip: c.zip ?? "",
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    formatted_address: c.formatted_address ?? "",
  };
}

function fullName(c: { first_name: string | null; last_name: string | null }) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
}

export default function CustomersPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CustomersPage />
    </Suspense>
  );
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const phone = usePhone();

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
          <h1 className="text-page-title text-white">Customers</h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            People you clean windows for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setImporting(true)}
            className="h-auto text-sm border border-[#2a2a32] bg-[#0f0f12] hover:bg-black text-zinc-300 rounded px-3 py-2 font-bold"
          >
            Import
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCreating(true)}
            className="h-auto text-sm bg-slate-900 hover:bg-slate-800 text-white rounded px-3 py-2 font-bold"
          >
            + Customer
          </Button>
        </div>
      </div>

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-lg overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400 font-bold">
            No customers yet.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-[#1f1f24]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto text-left px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Name</TableHead>
                <TableHead className="h-auto text-left px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Address</TableHead>
                <TableHead className="h-auto text-left px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Phone</TableHead>
                <TableHead className="h-auto text-left px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Email</TableHead>
                <TableHead className="h-auto px-4 py-2" />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#1f1f24]">
              {customers.map((c) => (
                <TableRow key={c.id} className="border-0 hover:bg-transparent">
                  <TableCell className="px-4 py-2 font-bold text-white tracking-tight">
                    {fullName(c) || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-zinc-300 font-bold">{c.address || "—"}</TableCell>
                  <TableCell className="px-4 py-2 text-zinc-300 font-bold">{c.phone || "—"}</TableCell>
                  <TableCell className="px-4 py-2 text-zinc-300 font-bold">{c.email || "—"}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    {phone.configured && c.phone && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          phone.startCall({
                            customerId: c.id,
                            customerName: fullName(c) || c.name,
                            toPhone: c.phone || "",
                          })
                        }
                        disabled={phone.state.kind !== "idle"}
                        className="h-auto p-0 text-[11px] uppercase tracking-[0.14em] font-extrabold text-emerald-400 hover:text-emerald-300 hover:bg-transparent mr-4"
                      >
                        Call
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setEditing(c)}
                      className="h-auto p-0 text-[11px] uppercase tracking-[0.14em] font-extrabold text-zinc-400 hover:text-white hover:bg-transparent mr-4"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => del(c.id)}
                      className="h-auto p-0 text-[11px] uppercase tracking-[0.14em] font-extrabold text-red-400 hover:text-red-300 hover:bg-transparent"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={async () => {
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
  const [address, setAddress] = useState<AddressValue>(() =>
    customerToAddress(customer)
  );
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
          address_line1: address.address_line1,
          unit: address.unit,
          city: address.city,
          state: address.state,
          zip: address.zip,
          latitude: address.latitude,
          longitude: address.longitude,
          formatted_address: address.formatted_address,
          notes,
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        (data && typeof data === "object" && "error" in data && data.error
          ? String(data.error)
          : "") || `Could not save customer (HTTP ${res.status})`
      );
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f0f12] rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f24]">
          <h3 className="font-bold">
            {customer ? "Edit customer" : "New customer"}
          </h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent text-xl leading-none"
          >
            ×
          </Button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-auto border-[#2a2a32] rounded px-3 py-2 text-sm"
                autoFocus
                required
              />
            </Field>
            <Field label="Last name" required>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-auto border-[#2a2a32] rounded px-3 py-2 text-sm"
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                type="tel"
                value={phone ?? ""}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-auto border-[#2a2a32] rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-auto border-[#2a2a32] rounded px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <AddressFields value={address} onChange={setAddress} />
          <Field label="Notes">
            <Textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border-[#2a2a32] rounded px-3 py-2 text-sm"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-auto text-sm border border-[#2a2a32] bg-[#0f0f12] hover:bg-black rounded px-3 py-2 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="ghost"
              disabled={saving}
              className="h-auto text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded px-3 py-2 font-bold"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
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
      <Label className="block text-eyebrow uppercase text-zinc-500 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
