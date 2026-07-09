"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CustomerCard from "@/components/jobs/CustomerCard";
import AddressFields, {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/components/customers/AddressFields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineItemsSection } from "@/components/LineItemsSection";
import {
  StaffSinglePicker,
  StaffMultiPicker,
  type Staff,
} from "@/components/forms/StaffPickers";
import { LeadSourceField } from "@/components/forms/LeadSourceField";
import { PrivateNotesSection } from "@/components/forms/PrivateNotesSection";
import type { AttachmentDraft } from "@/components/forms/PrivateNotesSection";

export { StaffSinglePicker, StaffMultiPicker, type Staff };

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
type LineItem = {
  key: string;
  id?: number;
  title: string;
  description: string;
  quantity: number;
  price_cents: number;
  taxable: boolean;
  upsell: boolean;
  is_addon: boolean;
};

type ChecklistItem = {
  key: string;
  id?: number;
  text: string;
  completed: boolean;
};

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
    is_addon: number;
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
  const searchParams = useSearchParams();

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

  // Calendar hover-to-add hands us ?start=<iso>&tech=<id> so the new
  // job lands in the slot the user clicked. Only consulted on create.
  const prefillStartIso = !job ? searchParams?.get("start") ?? null : null;
  const prefillTechId = !job
    ? Number(searchParams?.get("tech") ?? "") || null
    : null;
  // Approving an estimate routes here with ?customer=<id> so the new job is
  // pre-attached to the customer the estimate was for. Only consulted on create.
  const prefillCustomerId = !job
    ? Number(searchParams?.get("customer") ?? "") || null
    : null;

  const initialStart = job
    ? { date: toDateInput(job.scheduled_at), time: toTimeInput(job.scheduled_at) }
    : prefillStartIso
    ? { date: toDateInput(prefillStartIso), time: toTimeInput(prefillStartIso) }
    : defaultStart();
  const initialEnd = job?.end_time
    ? { date: toDateInput(job.end_time), time: toTimeInput(job.end_time) }
    : defaultEnd(initialStart);

  const [customerId, setCustomerId] = useState<number | null>(
    job?.customer_id ?? prefillCustomerId
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
    job?.techs.map((s) => s.id) ?? (prefillTechId ? [prefillTechId] : [])
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
          is_addon: !!li.is_addon,
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
            is_addon: false,
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
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [recurring, setRecurring] = useState(!!job?.recurring);

  type IntervalUnit = "week" | "month" | "year";
  type EndMode = "never" | "1y" | "2y";
  // Preset frequency list — visits always land on the same calendar date in
  // the target month/year. Default is every 3 months (quarterly).
  const FREQUENCY_PRESETS: {
    key: string;
    n: number;
    unit: IntervalUnit;
    label: string;
  }[] = [
    { key: "2w", n: 2, unit: "week", label: "Every 2 weeks" },
    { key: "1mo", n: 1, unit: "month", label: "Every month" },
    { key: "2mo", n: 2, unit: "month", label: "Every 2 months" },
    { key: "3mo", n: 3, unit: "month", label: "Every 3 months" },
    { key: "4mo", n: 4, unit: "month", label: "Every 4 months" },
    { key: "6mo", n: 6, unit: "month", label: "Every 6 months" },
    { key: "1y", n: 1, unit: "year", label: "Every year" },
  ];
  const [frequencyKey, setFrequencyKey] = useState("3mo");
  const [endMode, setEndMode] = useState<EndMode>("never");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        is_addon: mode === "edit",
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

    let recurrencePayload: {
      interval_n: number;
      interval_unit: IntervalUnit;
      end_mode: "never" | "years";
      end_years?: number | null;
    } | null = null;
    if (recurring && mode === "create") {
      const preset = FREQUENCY_PRESETS.find((p) => p.key === frequencyKey);
      if (!preset) {
        setError("Pick a frequency");
        return;
      }
      recurrencePayload = {
        interval_n: preset.n,
        interval_unit: preset.unit,
        end_mode: endMode === "never" ? "never" : "years",
        end_years: endMode === "1y" ? 1 : endMode === "2y" ? 2 : null,
      };
    }

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
      recurrence: recurrencePayload,
      line_items: items.map((li) => ({
        title: li.title.trim(),
        description: li.description || null,
        quantity: li.quantity || 1,
        price_cents: Math.round(li.price_cents),
        taxable: li.taxable,
        upsell: li.upsell,
        is_addon: li.is_addon,
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
      const detail = await res
        .json()
        .then((d) => (d && typeof d.error === "string" ? d.error : null))
        .catch(() => null);
      setError(detail ? `Could not save job: ${detail}` : "Could not save job");
      return;
    }
    const data = (await res.json()) as { id?: number };
    const jobId = mode === "edit" && job ? job.id : data.id;
    if (jobId && attachments.length > 0) {
      const results = await Promise.all(
        attachments.map(async (a) => {
          try {
            const r = await fetch(`/api/jobs/${jobId}/attachments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kind: a.kind,
                filename: a.filename,
                mime_type: a.mime_type,
                content: a.content,
              }),
            });
            if (!r.ok) {
              const detail = await r
                .json()
                .then((d) => (d && typeof d.error === "string" ? d.error : null))
                .catch(() => null);
              return {
                ok: false as const,
                filename: a.filename,
                detail: detail || `HTTP ${r.status}`,
              };
            }
            return { ok: true as const };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "network error";
            return { ok: false as const, filename: a.filename, detail: msg };
          }
        })
      );
      const failed = results.filter(
        (r): r is { ok: false; filename: string; detail: string } => !r.ok
      );
      if (failed.length > 0) {
        const summary = failed
          .map((f) => `${f.filename}: ${f.detail}`)
          .join("; ");
        setError(
          `Job saved, but ${failed.length} attachment${
            failed.length === 1 ? "" : "s"
          } failed to upload — ${summary}`
        );
        setSaving(false);
        return;
      }
    }
    router.push(jobId ? `/schedule/${jobId}` : "/schedule");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-page-title text-white">
          {mode === "edit" ? "Edit Job" : "Create Job"}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className="text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={saving}
            variant="ghost"
            className="text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold shadow-sm h-auto"
          >
            {saving
              ? "Saving…"
              : mode === "edit"
              ? "Save changes"
              : "Create Job"}
          </Button>
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
              <Button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                variant="ghost"
                className="text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300 whitespace-nowrap h-auto"
              >
                + New Customer
              </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <Section title="Scheduling">
          <div className="space-y-3">
            <Field label="Start Date & Time">
              <div className="flex items-center gap-2">
                <PickerInput
                  type="date"
                  value={startDate}
                  onChange={(e) => applyNewStart(e.target.value, startTime)}
                  disabled={scheduleLater}
                  className="w-[150px]"
                />
                <PickerInput
                  type="time"
                  value={startTime}
                  onChange={(e) => applyNewStart(startDate, e.target.value)}
                  disabled={scheduleLater || anytime}
                  className="w-[110px]"
                />
              </div>
            </Field>
            <Field label="End Date & Time">
              <div className="flex items-center gap-2">
                <PickerInput
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={scheduleLater}
                  className="w-[150px]"
                />
                <PickerInput
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={scheduleLater || anytime}
                  className="w-[110px]"
                />
              </div>
            </Field>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold">
                <Checkbox
                  checked={anytime}
                  onCheckedChange={(c) => setAnytime(c === true)}
                  className="rounded border-line-strong text-white focus:ring-zinc-500"
                />
                Anytime (no specific time of day)
              </Label>
              <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold">
                <Checkbox
                  checked={scheduleLater}
                  onCheckedChange={(c) => setScheduleLater(c === true)}
                  className="rounded border-line-strong text-white focus:ring-zinc-500"
                />
                Schedule later
              </Label>
            </div>
          </div>
        </Section>

        <Section title="Assignment">
          <div className="space-y-3">
            <Field label="Dispatched To">
              <StaffMultiPicker
                staff={staff}
                ids={techIds}
                setIds={setTechIds}
                placeholder="Search technicians…"
              />
            </Field>
            <LeadSourceField
              staff={staff}
              salesId={salesIds[0] ?? null}
              setSalesId={(id) => setSalesIds(id == null ? [] : [id])}
              leadMethod={leadSource}
              setLeadMethod={setLeadSource}
            />
          </div>
        </Section>
      </div>

      <LineItemsSection
        items={items}
        presets={SERVICE_PRESETS}
        onAdd={addItem}
        onChange={(key, patch) => updateItem(key, patch as Partial<LineItem>)}
        onRemove={removeItem}
        required
        extraRow={(li) => {
          const item = li as LineItem;
          if (!item.is_addon) return null;
          return (
            <Label className="inline-flex items-center gap-2 font-normal">
              <Checkbox
                checked={item.upsell}
                onCheckedChange={(c) => updateItem(item.key, { upsell: c === true })}
                className="rounded border-line-strong text-white focus:ring-zinc-500"
              />
              Upsell
            </Label>
          );
        }}
      />

      <Section
        title="Checklist"
        action={
          <Button
            type="button"
            onClick={addChecklist}
            variant="ghost"
            className="text-sm border border-line bg-card hover:bg-black rounded-full px-3 py-1.5 h-auto"
          >
            + Add Item
          </Button>
        }
      >
        {checklist.length === 0 || !showChecklist ? (
          <p className="text-sm text-zinc-500">No tasks selected.</p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <Checkbox
                  checked={c.completed}
                  onCheckedChange={(ch) =>
                    updateCheck(c.key, { completed: ch === true })
                  }
                  className="rounded border-line-strong text-white focus:ring-zinc-500"
                />
                <Input
                  type="text"
                  value={c.text}
                  onChange={(e) => updateCheck(c.key, { text: e.target.value })}
                  placeholder="Task description"
                  className="flex-1 border-line rounded-full px-4 py-2 text-sm h-auto"
                />
                <Button
                  type="button"
                  onClick={() => removeCheck(c.key)}
                  variant="ghost"
                  className="text-zinc-500 hover:text-rose-500 px-2 h-auto"
                  aria-label="Remove task"
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <PrivateNotesSection
        notes={notes}
        setNotes={setNotes}
        attachments={attachments}
        setAttachments={setAttachments}
      />

      <Section title="Recurring Service">
        <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold">
          <Checkbox
            checked={recurring}
            onCheckedChange={(c) => setRecurring(c === true)}
            className="rounded border-line-strong text-white focus:ring-zinc-500"
          />
          Make this a recurring service
        </Label>

        {recurring && mode === "create" && (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <Field label="Frequency">
              <select
                value={frequencyKey}
                onChange={(e) => setFrequencyKey(e.target.value)}
                className="h-9 w-full sm:w-72 border border-line rounded-full px-3 bg-card text-sm font-bold text-white"
              >
                {FREQUENCY_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ends">
              <select
                value={endMode}
                onChange={(e) => setEndMode(e.target.value as EndMode)}
                className="h-9 w-full sm:w-72 border border-line rounded-full px-3 bg-card text-sm font-bold text-white"
              >
                <option value="never">Never (until canceled)</option>
                <option value="1y">After 1 year</option>
                <option value="2y">After 2 years</option>
              </select>
            </Field>

            <p className="text-xs text-zinc-500">
              Visits land on the same calendar date in each target month. Only
              the next year is placed on the schedule at any time — new visits
              are added automatically as time rolls forward.
            </p>
          </div>
        )}
        {recurring && mode === "edit" && (
          <p className="mt-3 text-xs text-zinc-500">
            Existing recurrence settings can&apos;t be edited here yet.
          </p>
        )}
      </Section>

      <div className="flex justify-end gap-2">
        <Link
          href="/schedule"
          className="text-sm border border-line bg-card hover:bg-black rounded-full px-5 py-2 text-zinc-300"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={saving}
          variant="ghost"
          className="text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold shadow-sm h-auto"
        >
          {saving
            ? "Saving…"
            : mode === "edit"
            ? "Save changes"
            : "Create Job"}
        </Button>
      </div>
    </form>
  );
}

export function PickerInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  // Click-anywhere date/time input. The native picker only opens via the
  // (now-hidden) calendar/clock indicator, so we trigger showPicker() on
  // the whole input. Disabled inputs skip the call.
  return (
    <Input
      {...props}
      onMouseDown={(e) => {
        if (props.disabled) return;
        const el = e.currentTarget as HTMLInputElement & {
          showPicker?: () => void;
        };
        if (typeof el.showPicker === "function") {
          e.preventDefault();
          el.focus();
          el.showPicker();
        }
      }}
      className={`input-picker border-line rounded-full px-3 text-sm font-bold bg-card disabled:bg-black h-9 ${
        className ?? ""
      }`}
    />
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
    <section className="bg-card border border-line rounded-2xl p-5 sm:p-6">
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
      <Label className="block text-xs font-bold text-zinc-500 mb-2">
        {label}
      </Label>
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
      <Input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onClear();
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search customer by name…"
        className="w-full border-line rounded-full px-4 py-2 text-sm bg-card h-auto"
      />
      {open && suggestions.length > 0 && !selectedId && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-card border border-line rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((c) => (
            <Button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              variant="ghost"
              className="w-full text-left px-4 py-2 hover:bg-black text-sm h-auto block rounded-none"
            >
              <div className="font-bold text-white tracking-tight">{c.name}</div>
              {c.address && (
                <div className="text-xs text-zinc-400 truncate">
                  {c.address}
                </div>
              )}
            </Button>
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
    "border border-line rounded-full px-4 py-2 text-sm bg-card";

  return (
    <div className="mt-3 border border-line rounded-2xl p-4 space-y-3 bg-black">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="text"
          placeholder="First name *"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={pillCls}
        />
        <Input
          type="text"
          placeholder="Last name *"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={pillCls}
        />
        <Input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={pillCls}
        />
        <Input
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
        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          className="text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-1.5 h-auto"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          variant="ghost"
          className="text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-4 py-1.5 h-auto"
        >
          Save customer
        </Button>
      </div>
    </div>
  );
}

