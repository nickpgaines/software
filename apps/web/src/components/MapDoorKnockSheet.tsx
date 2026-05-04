"use client";

import { useEffect, useState } from "react";
import { OBJECTIONS, STATUSES, statusByKey, iconSvg } from "@/lib/map-status";

export type SheetPin = {
  id?: number;
  lat: number;
  lng: number;
  address: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status?: string;
  objections?: string[] | null;
  customer_id?: number | null;
};

export default function MapDoorKnockSheet({
  pin,
  onClose,
  onSaved,
  onDelete,
}: {
  pin: SheetPin;
  onClose: () => void;
  onSaved: (saved: SheetPin & { id: number }) => void;
  onDelete?: (id: number) => void;
}) {
  const [firstName, setFirstName] = useState(pin.first_name || "");
  const [lastName, setLastName] = useState(pin.last_name || "");
  const [phone, setPhone] = useState(pin.phone || "");
  const [status, setStatus] = useState(pin.status || "not_home");
  const [objectionsOpen, setObjectionsOpen] = useState(
    !!(pin.objections && pin.objections.length > 0)
  );
  const [objections, setObjections] = useState<string[]>(pin.objections || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleObj(obj: string) {
    setObjections((arr) =>
      arr.includes(obj) ? arr.filter((o) => o !== obj) : [...arr, obj]
    );
  }

  async function save(asCustomer: boolean) {
    setError(null);
    setSaving(true);
    const payload = {
      lat: pin.lat,
      lng: pin.lng,
      address: pin.address,
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      status,
      objections,
    };

    let customerId: number | null = pin.customer_id ?? null;
    if (asCustomer) {
      const first = firstName.trim();
      const last = lastName.trim();
      if (!first || !last) {
        setSaving(false);
        setError("First and last name are required to create a customer");
        return;
      }
      const cRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          phone,
          address: pin.address,
        }),
      });
      if (cRes.ok) {
        const c = (await cRes.json()) as { id: number };
        customerId = c.id;
      }
    }

    const finalPayload = { ...payload, customer_id: customerId };
    const url = pin.id ? `/api/map/pins/${pin.id}` : "/api/map/pins";
    const method = pin.id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save pin");
      return;
    }
    const saved = (await res.json()) as SheetPin & { id: number };
    onSaved(saved);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-[#0f0f12] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0f0f12] px-5 pt-5 pb-3 border-b border-[#1f1f24] flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-white tracking-tight truncate">
              {pin.address || "Unknown address"}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none -mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
              />
            </Field>
            <Field label="Last Name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Mobile">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
            />
          </Field>

          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
              Status
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {STATUSES.map((s) => {
                const active = status === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key)}
                    className={
                      "shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 w-24 transition " +
                      (active
                        ? "border-[#2a2a32] bg-black"
                        : "border-[#1f1f24] bg-[#0f0f12] hover:bg-black")
                    }
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                      style={{
                        backgroundColor: s.color,
                        boxShadow: s.glow ? "0 0 12px rgba(239,68,68,0.5)" : "",
                      }}
                      dangerouslySetInnerHTML={{ __html: iconSvg(s.iconKey, 18) }}
                    />
                    <span className="text-[11px] font-medium text-zinc-300 text-center leading-tight">
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-[#1f1f24] rounded-2xl">
            <button
              type="button"
              onClick={() => setObjectionsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500"
            >
              <span>Objections{objections.length > 0 ? ` (${objections.length})` : ""}</span>
              <svg
                className={
                  "w-4 h-4 transition-transform " +
                  (objectionsOpen ? "rotate-180" : "")
                }
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {objectionsOpen && (
              <div className="border-t border-[#1f1f24] p-4 space-y-2">
                {OBJECTIONS.map((obj) => (
                  <label
                    key={obj}
                    className="flex items-center gap-2 text-sm text-zinc-300 font-bold"
                  >
                    <input
                      type="checkbox"
                      checked={objections.includes(obj)}
                      onChange={() => toggleObj(obj)}
                      className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
                    />
                    {obj}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-[#0f0f12] border-t border-[#1f1f24] px-5 py-3 flex items-center gap-2">
          {pin.id && onDelete && (
            <button
              onClick={() => {
                if (confirm("Delete this pin?")) onDelete(pin.id!);
              }}
              className="text-sm text-rose-600 hover:text-rose-700 px-2"
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            disabled={saving}
            title="Coming soon"
            className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black disabled:opacity-50 rounded-full px-4 py-2"
          >
            Create Subscription
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-4 py-2 font-bold"
          >
            {saving ? "Saving…" : "Create Customer"}
          </button>
        </div>

        {!pin.id && (
          <div className="px-5 pb-4 -mt-2 text-xs text-zinc-400 text-right">
            <button
              type="button"
              onClick={() => save(false)}
              className="hover:text-white underline"
            >
              Save as door knock without creating customer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
