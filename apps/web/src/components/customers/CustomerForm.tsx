"use client";

import { useState } from "react";
import AddressFields, {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/components/customers/AddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CustomerFormCustomer = {
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

function customerToAddress(c: CustomerFormCustomer | null): AddressValue {
  if (!c) return { ...EMPTY_ADDRESS };
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

export default function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerFormCustomer | null;
  onClose: () => void;
  onSaved: (saved: CustomerFormCustomer) => void;
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
    const saved = (await res.json()) as CustomerFormCustomer;
    onSaved(saved);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
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
                className="w-full h-auto border-line-strong rounded px-3 py-2 text-sm"
                autoFocus
                required
              />
            </Field>
            <Field label="Last name" required>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-auto border-line-strong rounded px-3 py-2 text-sm"
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
                className="w-full h-auto border-line-strong rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-auto border-line-strong rounded px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <AddressFields value={address} onChange={setAddress} />
          <Field label="Notes">
            <Textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border-line-strong rounded px-3 py-2 text-sm"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold"
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
      <Label className="block text-xs font-bold text-zinc-500 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
