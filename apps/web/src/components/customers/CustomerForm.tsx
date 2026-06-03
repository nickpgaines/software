"use client";

import { useState } from "react";
import AddressFields, {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/components/customers/AddressFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {customer ? "Edit customer" : "New customer"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <Field label="Last name" required>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <AddressFields value={address} onChange={setAddress} />
          <Field label="Notes">
            <Textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </Field>
          {error && <p className="text-sm font-bold text-rose-400">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      <Label className="mb-2 block text-xs font-bold text-zinc-500">
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
      </Label>
      {children}
    </div>
  );
}
