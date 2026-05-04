"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerCard from "@/components/jobs/CustomerCard";
import AddressFields, {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/components/customers/AddressFields";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};
type Staff = { id: number; name: string; role: string | null };

type LineItem = {
  key: string;
  id?: number;
  title: string;
  description: string;
  quantity: number;
  price_cents: number;
  taxable: boolean;
  upsell: boolean;
};

type ChecklistItem = {
  key: string;
  id?: number;
  text: string;
  completed: boolean;
};

const LEAD_SOURCES = [
  "Referral",
  "Online",
  "Door-to-door",
  "Repeat customer",
  "Other",
];

const SERVICE_PRESETS = [
  "Window Cleaning",
  "Gutter Cleaning",
  "Pressure Washing",
  "Solar Panel Cleaning",
  "Screen Repair",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function combine(date: string, time: string) {
  if (!date) return "";
  const t = time || "08:00";
  const d = new Date(`${date}T${t}`);
  return d.toISOString();
}

function defaultStart(): { date: string; time: string } {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return { date: toDateInput(d.toISOString()), time: toTimeInput(d.toISOString()) };
}

function defaultEnd(start: { date: string; time: string }) {
  if (!start.date) return { date: "", time: "" };
  const d = new Date(`${start.date}T${start.time || "08:00"}`);
  d.setHours(d.getHours() + 2);
  return { date: toDateInput(d.toISOString()), time: toTimeInput(d.toISOString()) };
}

function dateOnly(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function timeOnly(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseLocal(date: string, time: string): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "08:00"}`);
  return isNaN(d.getTime()) ? null : d;
}
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
function endForNewStart(
  newStart: Date,
  oldStart: Date | null,
  oldEnd: Date | null
): Date {
  let durationMs = TWO_HOURS_MS;
  if (oldStart && oldEnd) {
    const diff = oldEnd.getTime() - oldStart.getTime();
    if (diff > 0) durationMs = diff;
  }
  return new Date(newStart.getTime() + durationMs);
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type ExistingJob = {
  id: number;
  customer_id: number;
  customer_name: string;
  scheduled_at: string;
  end_time: string | null;
  anytime: number;
  schedule_later: number;
  lead_source: string | null;
  notes: string | null;
  status: string;
  recurring: number;
  line_items: {
    id: number;
    title: string;
    description: string | null;
    quantity: number;
    price_cents: number;
    taxable: number;
    upsell: number;
  }[];
  checklist_items: { id: number; text: string; completed: number }[];
  sales: { id: number; name: string; role: string | null }[];
  techs: { id: number; name: string; role: string | null }[];
};

export default function JobForm({
  mode,
  job,
}: {
  mode: "create" | "edit";
  job?: ExistingJob;
}) {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then(setCustomers);
    fetch("/api/staff")
      .then((r) => r.json())
      .then(setStaff);
  }, []);

  const initialStart = job
    ? { date: toDateInput(job.scheduled_at), time: toTimeInput(job.scheduled_at) }
    : defaultStart();
  const initialEnd = job?.end_time
    ? { date: toDateInput(job.end_time), time: toTimeInput(job.end_time) }
    : defaultEnd(initialStart);

  const [customerId, setCustomerId] = useState<number | null>(
    job?.customer_id ?? null
  );
  const [customerQuery, setCustomerQuery] = useState(job?.customer_name ?? "");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [anytime, setAnytime] = useState(!!job?.anytime);

  // When Start date or time changes, drag End along to preserve the
  // current duration. If End is before Start (or duration is 0/missing),
  // fall back to Start + 2 hours.
  function applyNewStart(newDate: string, newTime: string) {
    const newStart = parseLocal(newDate, newTime);
    setStartDate(newDate);
    setStartTime(newTime);
    if (!newStart) return;
    const oldStart = parseLocal(startDate, startTime);
    const oldEnd = parseLocal(endDate, endTime);
    const newEnd = endForNewStart(newStart, oldStart, oldEnd);
    setEndDate(dateOnly(newEnd));
    setEndTime(timeOnly(newEnd));
  }
  const [scheduleLater, setScheduleLater] = useState(!!job?.schedule_later);

  const [leadSource, setLeadSource] = useState(job?.lead_source ?? "");
  const [salesIds, setSalesIds] = useState<number[]>(
    job?.sales.map((s) => s.id) ?? []
  );
  const [techIds, setTechIds] = useState<number[]>(
    job?.techs.map((s) => s.id) ?? []
  );

  const [items, setItems] = useState<LineItem[]>(
    job
      ? job.line_items.map((li) => ({
          key: uid(),
          id: li.id,
          title: li.title,
          description: li.description ?? "",
          quantity: li.quantity,
          price_cents: li.price_cents,
          taxable: !!li.taxable,
          upsell: !!li.upsell,
        }))
      : [
          {
            key: uid(),
            title: "Window Cleaning",
            description: "",
            quantity: 1,
            price_cents: 0,
            taxable: true,
            upsell: false,
          },
        ]
  );

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    job
      ? job.checklist_items.map((c) => ({
          key: uid(),
          id: c.id,
          text: c.text,
          completed: !!c.completed,
        }))
      : []
  );
  const [showChecklist, setShowChecklist] = useState(
    !!job && job.checklist_items.length > 0
  );

  const [notes, setNotes] = useState(job?.notes ?? "");
  const [recurring, setRecurring] = useState(!!job?.recurring);
  const [paid, setPaid] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () =>
      items.reduce((a, li) => a + Math.round(li.quantity * li.price_cents), 0),
    [items]
  );
  const total = subtotal;
  const balance = Math.max(0, total - Math.round(paid * 100));

  const customerSuggestions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [customerQuery, customers]);

  function pickCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustomerQuery(c.name);
  }

  function addItem() {
    setItems((arr) => [
      ...arr,
      {
        key: uid(),
        title: "",
        description: "",
        quantity: 1,
        price_cents: 0,
        taxable: true,
        upsell: false,
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((li) => (li.key === key ? { ...li, ...patch } : li)));
  }

  function removeItem(key: string) {
    setItems((arr) => arr.filter((li) => li.key !== key));
  }

  function addChecklist() {
    setChecklist((arr) => [...arr, { key: uid(), text: "", completed: false }]);
    setShowChecklist(true);
  }

  function updateCheck(key: string, patch: Partial<ChecklistItem>) {
    setChecklist((arr) =>
      arr.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  }

  function removeCheck(key: string) {
    setChecklist((arr) => arr.filter((c) => c.key !== key));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Choose a customer");
      return;
    }
    if (items.length === 0 || items.some((li) => !li.title.trim())) {
      setError("Add at least one line item with a title");
      return;
    }
    if (!scheduleLater && !startDate) {
      setError("Pick a start date or check 'Schedule later'");
      return;
    }

    const startIso = scheduleLater
      ? new Date().toISOString()
      : combine(startDate, anytime ? "00:00" : startTime);
    const endIso = scheduleLater
      ? null
      : anytime
      ? null
      : combine(endDate || startDate, endTime || startTime);

    const payload = {
      customer_id: customerId,
      start_time: startIso,
      end_time: endIso,
      anytime,
      schedule_later: scheduleLater,
      lead_source: leadSource || null,
      sales_ids: salesIds,
      tech_ids: techIds,
      notes: notes || null,
      recurring,
      line_items: items.map((li) => ({
        title: li.title.trim(),
        description: li.description || null,
        quantity: li.quantity || 1,
        price_cents: Math.round(li.price_cents),
        taxable: li.taxable,
        upsell: li.upsell,
      })),
      checklist_items: checklist
        .filter((c) => c.text.trim())
        .map((c) => ({ text: c.text.trim(), completed: c.completed })),
    };

    setSaving(true);
    const url = mode === "edit" && job ? `/api/jobs/${job.id}` : "/api/jobs";
    const method = mode === "edit" ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save job");
      return;
    }
    const data = (await res.json()) as { id?: number };
    const jobId = mode === "edit" && job ? job.id : data.id;
    router.push(jobId ? `/schedule/${jobId}` : "/schedule");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[40px] font-extrabold tracking-tight leading-none text-white">
            {mode === "edit" ? "Edit Job" : "Create Job"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Schedule a window cleaning visit and assign your team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-zinc-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium shadow-sm"
          >
            {saving
              ? "Saving…"
              : mode === "edit"
              ? "Save changes"
              : "Create Job"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <Section title="Customer">
        {customerId &&
        (() => {
          const selected = customers.find((c) => c.id === customerId);
          if (!selected) return null;
          return (
            <CustomerCard
              customer={selected}
              onRemove={() => {
                setCustomerId(null);
                setCustomerQuery("");
              }}
            />
          );
        })()}
        {!customerId && (
          <>
            <div className="flex gap-2">
              <CustomerSearch
                query={customerQuery}
                setQuery={setCustomerQuery}
                suggestions={customerSuggestions}
                onPick={pickCustomer}
                onClear={() => {
                  setCustomerId(null);
                }}
                selectedId={customerId}
              />
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-zinc-300 whitespace-nowrap"
              >
                + New Customer
              </button>
            </div>
            {showNewCustomer && (
              <NewCustomerInline
                onClose={() => setShowNewCustomer(false)}
                onCreated={(c) => {
                  setCustomers((arr) => [...arr, c]);
                  setCustomerId(c.id);
                  setCustomerQuery(c.name);
                  setShowNewCustomer(false);
                }}
              />
            )}
          </>
        )}
      </Section>

      <Section title="Scheduling">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr] items-center gap-3">
            <label className="text-sm font-medium text-zinc-300">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => applyNewStart(e.target.value, startTime)}
              disabled={scheduleLater}
              className="border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12] disabled:bg-black"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => applyNewStart(startDate, e.target.value)}
              disabled={scheduleLater || anytime}
              className="border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12] disabled:bg-black"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr] items-center gap-3">
            <label className="text-sm font-medium text-zinc-300">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={scheduleLater}
              className="border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12] disabled:bg-black"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={scheduleLater || anytime}
              className="border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12] disabled:bg-black"
            />
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={anytime}
                onChange={(e) => setAnytime(e.target.checked)}
                className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
              />
              Anytime (no specific time of day)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={scheduleLater}
                onChange={(e) => setScheduleLater(e.target.checked)}
                className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
              />
              Schedule later
            </label>
          </div>
        </div>
      </Section>

      <Section title="Assignment">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Lead Source">
            <select
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12]"
            >
              <option value="">Select source…</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Select Salesperson(s)">
            <StaffMultiPicker
              staff={staff}
              ids={salesIds}
              setIds={setSalesIds}
              placeholder="Search salespeople…"
            />
          </Field>
          <Field label="Dispatched To">
            <StaffMultiPicker
              staff={staff}
              ids={techIds}
              setIds={setTechIds}
              placeholder="Search technicians…"
            />
          </Field>
        </div>
      </Section>

      <Section
        title={
          <span className="flex items-center gap-1">
            Line Items
            <span className="text-rose-500">*</span>
          </span>
        }
        action={
          <button
            type="button"
            onClick={addItem}
            className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-3 py-1.5"
          >
            + Add Item
          </button>
        }
      >
        <div className="space-y-3">
          {items.map((li) => (
            <LineItemCard
              key={li.key}
              item={li}
              onChange={(patch) => updateItem(li.key, patch)}
              onRemove={() => removeItem(li.key)}
            />
          ))}
        </div>
        <div className="border-t border-[#1f1f24] mt-4 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Total label="Subtotal" value={money(subtotal)} />
          <Total label="Total" value={money(total)} bold />
          <Total label="Total Paid" value={money(Math.round(paid * 100))} className="text-emerald-600">
            <input
              type="number"
              min={0}
              step="0.01"
              value={paid}
              onChange={(e) => setPaid(Number(e.target.value))}
              className="mt-1 border border-[#1f1f24] rounded-full px-3 py-1 text-sm w-full"
            />
          </Total>
          <Total
            label="Balance Due"
            value={money(balance)}
            className={balance > 0 ? "text-rose-600" : "text-zinc-400"}
            bold
          />
        </div>
      </Section>

      <Section
        title="Checklist"
        action={
          <button
            type="button"
            onClick={addChecklist}
            className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-3 py-1.5"
          >
            + Add Item
          </button>
        }
      >
        {checklist.length === 0 || !showChecklist ? (
          <p className="text-sm text-zinc-500">No tasks selected.</p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.completed}
                  onChange={(e) =>
                    updateCheck(c.key, { completed: e.target.checked })
                  }
                  className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
                />
                <input
                  type="text"
                  value={c.text}
                  onChange={(e) => updateCheck(c.key, { text: e.target.value })}
                  placeholder="Task description"
                  className="flex-1 border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeCheck(c.key)}
                  className="text-zinc-500 hover:text-rose-500 px-2"
                  aria-label="Remove task"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add any additional notes..."
          className="w-full border border-[#1f1f24] rounded-2xl px-4 py-3 text-sm bg-[#0f0f12]"
        />
      </Section>

      <Section title="Attachments">
        <Dropzone />
      </Section>

      <Section title="Recurring Service">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
          />
          Make this a recurring service
        </label>
      </Section>

      <div className="flex justify-end gap-2">
        <Link
          href="/schedule"
          className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-5 py-2 text-zinc-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium shadow-sm"
        >
          {saving
            ? "Saving…"
            : mode === "edit"
            ? "Save changes"
            : "Create Job"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
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
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Total({
  label,
  value,
  bold,
  className,
  children,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={
          (bold ? "font-bold text-lg " : "font-semibold ") +
          "tabular-nums " +
          (className || "text-white")
        }
      >
        {value}
      </div>
      {children}
    </div>
  );
}

function CustomerSearch({
  query,
  setQuery,
  suggestions,
  onPick,
  onClear,
  selectedId,
}: {
  query: string;
  setQuery: (v: string) => void;
  suggestions: Customer[];
  onPick: (c: Customer) => void;
  onClear: () => void;
  selectedId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onClear();
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search customer by name…"
        className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12]"
      />
      {open && suggestions.length > 0 && !selectedId && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-black text-sm"
            >
              <div className="font-bold text-white tracking-tight">{c.name}</div>
              {c.address && (
                <div className="text-xs text-zinc-400 truncate">
                  {c.address}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewCustomerInline({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Customer) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
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
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save customer");
      return;
    }
    const c = (await res.json()) as Customer;
    onCreated(c);
  }

  const pillCls =
    "border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12]";

  return (
    <div className="mt-3 border border-[#1f1f24] rounded-2xl p-4 space-y-3 bg-black">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="First name *"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={pillCls}
        />
        <input
          type="text"
          placeholder="Last name *"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={pillCls}
        />
        <input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={pillCls}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={pillCls}
        />
      </div>
      <AddressFields
        value={address}
        onChange={setAddress}
        label={false}
        inputClassName={pillCls + " w-full"}
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-1.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-1.5"
        >
          Save customer
        </button>
      </div>
    </div>
  );
}

function StaffMultiPicker({
  staff,
  ids,
  setIds,
  placeholder,
}: {
  staff: Staff[];
  ids: number[];
  setIds: (ids: number[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const picked = staff.filter((s) => ids.includes(s.id));
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => !ids.includes(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [staff, ids, query]);

  return (
    <div ref={ref} className="relative">
      <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 border border-[#1f1f24] rounded-2xl px-2 py-1.5 bg-[#0f0f12]">
        {picked.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 bg-black text-zinc-300 rounded-full px-2.5 py-0.5 text-xs"
          >
            {s.name}
            <button
              type="button"
              onClick={() => setIds(ids.filter((id) => id !== s.id))}
              className="text-zinc-400 hover:text-white"
              aria-label={`Remove ${s.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={picked.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent px-2"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setIds([...ids, s.id]);
                setQuery("");
              }}
              className="w-full text-left px-4 py-2 hover:bg-black text-sm flex items-center justify-between"
            >
              <span className="font-bold text-white tracking-tight">{s.name}</span>
              {s.role && (
                <span className="text-xs text-zinc-500">{s.role}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LineItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: LineItem;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  const [titleOpen, setTitleOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!titleRef.current?.contains(e.target as Node)) setTitleOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const lineTotal = Math.round(item.quantity * item.price_cents);

  return (
    <div className="border border-[#1f1f24] rounded-2xl p-4 space-y-3 bg-[#0f0f12]">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <div ref={titleRef} className="relative">
            <input
              type="text"
              value={item.title}
              onChange={(e) => {
                onChange({ title: e.target.value });
                setTitleOpen(true);
              }}
              onFocus={() => setTitleOpen(true)}
              placeholder="Service title"
              className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
            />
            {titleOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-lg overflow-hidden">
                {SERVICE_PRESETS.filter(
                  (p) =>
                    !item.title ||
                    p.toLowerCase().includes(item.title.toLowerCase())
                ).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onChange({ title: p });
                      setTitleOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-black text-sm"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <textarea
              value={item.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              placeholder="Description (optional)"
              className="w-full border border-[#1f1f24] rounded-2xl px-4 py-2 text-sm"
            />
            <button
              type="button"
              title="AI write — coming soon"
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-full px-2.5 py-1"
            >
              <span>✦</span> AI Write
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                min={0}
                step="1"
                value={item.quantity}
                onChange={(e) =>
                  onChange({ quantity: Number(e.target.value) || 0 })
                }
                className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
              />
            </Field>
            <Field label="Price ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={(item.price_cents / 100).toString()}
                onChange={(e) =>
                  onChange({
                    price_cents: Math.round(Number(e.target.value) * 100) || 0,
                  })
                }
                className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.taxable}
                onChange={(e) => onChange({ taxable: e.target.checked })}
                className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
              />
              Taxable
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.upsell}
                onChange={(e) => onChange({ upsell: e.target.checked })}
                className="rounded border-[#2a2a32] text-white focus:ring-zinc-500"
              />
              Upsell
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-500 hover:text-rose-500 p-1"
          aria-label="Remove item"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>
      <div className="flex justify-end text-sm text-zinc-400">
        Item total:{" "}
        <span className="font-extrabold text-white tracking-tight ml-1">
          {money(lineTotal)}
        </span>
      </div>
    </div>
  );
}

function Dropzone() {
  const [isOver, setIsOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
      }}
      className={
        "border-2 border-dashed rounded-2xl py-10 text-center transition " +
        (isOver
          ? "border-slate-400 bg-black"
          : "border-[#1f1f24] bg-black/40")
      }
    >
      <div className="text-3xl text-zinc-500">⤴</div>
      <p className="mt-2 text-sm font-medium text-zinc-300">
        Click to upload or drag and drop
      </p>
      <p className="text-xs text-zinc-500">PNG, JPG, GIF up to 5MB</p>
    </div>
  );
}
