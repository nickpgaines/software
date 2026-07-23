"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CheckoutModal from "@/components/jobs/CheckoutModal";
import PaymentsSection from "@/components/jobs/PaymentsSection";
import RecordPaymentModal from "@/components/jobs/RecordPaymentModal";
import {
  PickerInput,
  StaffMultiPicker,
  StaffSinglePicker,
  dateOnly,
  endForNewStart,
  parseLocal,
  timeOnly,
  type Staff,
} from "@/components/JobForm";
import type { JobAttachment, JobAttachmentKind } from "@/lib/db";
import { captureNativePhoto, isNativeApp } from "@/lib/native";
import { LEAD_METHODS } from "@/components/forms/LeadSourceField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LineItemDetail = {
  id: number;
  title: string;
  description: string | null;
  quantity: number;
  price_cents: number;
  taxable: number;
  upsell: number;
  is_addon: number;
};

type Detail = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  customer_formatted_address: string | null;
  scheduled_at: string;
  end_time: string | null;
  duration_minutes: number;
  price_cents: number;
  status: string;
  notes: string | null;
  anytime: number;
  schedule_later: number;
  lead_source: string | null;
  recurring: number;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  line_items: LineItemDetail[];
  checklist_items: { id: number; text: string; completed: number }[];
  sales: { id: number; name: string; role: string | null }[];
  techs: { id: number; name: string; role: string | null }[];
  payments: {
    id: number;
    amount_cents: number;
    tip_cents: number;
    method: string;
    payment_date: string;
    notes: string | null;
  }[];
  paid_total_cents: number;
  tip_total_cents: number;
  paid_status: "unpaid" | "partial" | "paid";
  job_status:
    | "scheduled"
    | "in_progress"
    | "completed_unpaid"
    | "completed_partial"
    | "completed_paid";
  subscription_id: number | null;
  subscription_visit_index: number | null;
};

type SubscriptionLite = {
  id: number;
  name: string;
  price_cents: number;
  interval: string;
  service_interval: string;
  status: string;
};

const INTERVAL_PERIOD_LABEL: Record<string, string> = {
  weekly: "weekly",
  biweekly: "every 2 weeks",
  monthly: "monthly",
  quarterly: "quarterly",
  triannually: "every 4 months",
  semiannually: "every 6 months",
  yearly: "annually",
};

type Step = "en_route" | "arrived" | "started" | "completed";

const STEPS: {
  key: Step;
  label: string;
  ts: keyof Detail;
  icon: React.ReactNode;
}[] = [
  {
    key: "en_route",
    label: "En Route",
    ts: "en_route_at",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    key: "arrived",
    label: "Arrived",
    ts: "arrived_at",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    key: "started",
    label: "Started",
    ts: "started_at",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    key: "completed",
    label: "Completed",
    ts: "completed_at",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

function timeStamp(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayStamp(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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
function combineLocal(date: string, time: string) {
  return new Date(`${date}T${time || "08:00"}`).toISOString();
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// Property location card. Prefers a Google Street View Static photo of the
// home (like Homebase); degrades gracefully when Google isn't available:
//   1. No API key            → keyless Google Maps iframe embed (works keyless).
//   2. Street View metadata  → if imagery exists render the <img>, else the
//      says no imagery / fails    iframe embed. Never a broken image.
//   3. <img> network error   → fall back to the iframe embed.
// The photo links out to Google Maps on tap.
function JobLocationView({
  address,
  latitude,
  longitude,
  mapsAddr,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  mapsAddr: string;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const location =
    typeof latitude === "number" && typeof longitude === "number"
      ? `${latitude},${longitude}`
      : address;
  const embedSrc = `https://maps.google.com/maps?q=${mapsAddr}&z=15&output=embed`;
  const mapsHref = `https://www.google.com/maps?q=${mapsAddr}`;

  // "checking" probes Street View metadata before committing to the photo so
  // Google's gray "no imagery" placeholder never renders as if it were a home.
  const [mode, setMode] = useState<"checking" | "streetview" | "embed">(
    key ? "checking" : "embed"
  );

  useEffect(() => {
    if (!key) {
      setMode("embed");
      return;
    }
    let cancelled = false;
    setMode("checking");
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?size=640x300&location=${encodeURIComponent(
      location
    )}&key=${key}`;
    fetch(metaUrl)
      .then((r) => r.json())
      .then((d: { status?: string }) => {
        if (cancelled) return;
        setMode(d.status === "OK" ? "streetview" : "embed");
      })
      .catch(() => {
        if (!cancelled) setMode("embed");
      });
    return () => {
      cancelled = true;
    };
  }, [key, location]);

  if (mode === "embed") {
    return (
      <iframe
        title="Map"
        src={embedSrc}
        className="w-full h-full"
        loading="lazy"
      />
    );
  }
  if (mode === "checking") {
    // Neutral fill while probing metadata — matches the wrapper, never broken.
    return <div className="w-full h-full bg-black" />;
  }
  const streetViewSrc = `https://maps.googleapis.com/maps/api/streetview?size=640x300&location=${encodeURIComponent(
    location
  )}&key=${key}`;
  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noreferrer"
      className="block w-full h-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={streetViewSrc}
        alt={`Street view of ${address}`}
        className="w-full h-full object-cover"
        onError={() => setMode("embed")}
      />
    </a>
  );
}

export default function JobDetailClient({
  initialJob,
  initialSubscription = null,
}: {
  initialJob: Detail;
  initialSubscription?: SubscriptionLite | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Detail>(initialJob);
  const [busy, setBusy] = useState<Step | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const subscription = initialSubscription;

  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);

  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then(setStaff)
      .catch(() => {});
  }, []);

  async function refreshJob() {
    const res = await fetch(`/api/jobs/${job.id}`);
    if (res.ok) {
      const updated = (await res.json()) as Detail;
      setJob(updated);
    }
    router.refresh();
  }

  async function patchJob(body: Record<string, unknown>) {
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = (await res.json()) as Detail;
      setJob(updated);
      router.refresh();
      return true;
    }
    return false;
  }

  async function toggleStep(step: Step) {
    const stepDef = STEPS.find((s) => s.key === step)!;
    const already = !!job[stepDef.ts];
    setBusy(step);
    const res = await fetch(`/api/jobs/${job.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, clear: already }),
    });
    setBusy(null);
    if (res.ok) {
      const updated = (await res.json()) as Detail;
      setJob(updated);
      router.refresh();
    }
  }

  async function deleteJob() {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    router.push("/schedule");
    router.refresh();
  }

  async function createInvoiceFromJob() {
    if (creatingInvoice) return;
    if (job.line_items.length === 0) {
      alert("Add at least one line item to this job before creating an invoice.");
      return;
    }
    setCreatingInvoice(true);
    const payload = {
      customer_id: job.customer_id,
      notes: null,
      lead_source: job.lead_source,
      sold_by_id: job.sales[0]?.id ?? null,
      items: job.line_items.map((li) => ({
        title: li.title,
        description: li.description,
        quantity: li.quantity,
        price_cents: li.price_cents,
        taxable: !!li.taxable,
      })),
    };
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setCreatingInvoice(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error || "Could not create invoice");
      return;
    }
    const created = (await res.json()) as { id: number };
    router.push(`/invoices/${created.id}`);
  }

  async function sendReviewRequest() {
    if (sendingReview) return;
    if (!job.customer_phone && !job.customer_email) {
      alert("This customer has no phone or email on file.");
      return;
    }
    if (!confirm("Send a review request to this customer?")) return;
    setSendingReview(true);
    const res = await fetch(`/api/jobs/${job.id}/review-request`, {
      method: "POST",
    });
    setSendingReview(false);
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      sent?: { sms?: boolean; email?: boolean };
    };
    if (!res.ok) {
      alert(j.error || "Could not send review request");
      return;
    }
    const channels = [
      j.sent?.sms ? "SMS" : null,
      j.sent?.email ? "email" : null,
    ].filter(Boolean);
    alert(
      channels.length > 0
        ? `Review request sent via ${channels.join(" + ")}.`
        : "Review request prepared but no channel was available."
    );
  }

  const start = new Date(job.scheduled_at);
  const end = job.end_time ? new Date(job.end_time) : null;
  const subtotal = job.line_items.reduce(
    (a, li) => a + Math.round(li.quantity * li.price_cents),
    0
  );

  const mapsAddr = encodeURIComponent(job.customer_address || "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/schedule"
            className="text-sm text-zinc-400 font-bold hover:text-white inline-flex items-center gap-1"
          >
            ← Back to schedule
          </Link>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <h1 className="text-page-title text-white">
              {job.customer_name}
            </h1>
            <JobStatusBadge status={job.job_status} />
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {dayStamp(job.scheduled_at)} ·{" "}
            {job.anytime
              ? "Anytime"
              : `${timeStamp(job.scheduled_at)}${
                  end ? ` – ${timeStamp(end.toISOString())}` : ""
                }`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={deleteJob}
            className="text-sm border-rose-200 text-rose-600 hover:bg-rose-50 rounded-full px-4 py-2 h-auto"
          >
            Delete
          </Button>
        </div>
      </div>

      {subscription && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 rounded-full px-2 py-0.5">
                  Active subscription
                </span>
                <span className="text-xs font-bold text-rose-300 bg-rose-500/20 rounded-full px-2 py-0.5">
                  Do not collect
                </span>
              </div>
              <div className="mt-1.5 text-sm font-bold text-white tracking-tight truncate">
                {subscription.name}
                {job.subscription_visit_index
                  ? ` · Visit #${job.subscription_visit_index}`
                  : ""}
              </div>
              <div className="text-xs text-emerald-200/80 mt-0.5">
                {money(subscription.price_cents)} per visit · billed{" "}
                {INTERVAL_PERIOD_LABEL[subscription.interval] ||
                  subscription.interval}
              </div>
            </div>
            <Link
              href={`/settings?tab=subscriptions`}
              className="text-xs text-emerald-300 hover:text-emerald-200 font-bold tracking-tight inline-flex items-center gap-1 shrink-0"
            >
              View subscription →
            </Link>
          </div>
        </section>
      )}

      <section className="bg-card border border-line rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {STEPS.map((s, idx) => (
            <StepButton
              key={s.key}
              index={idx}
              label={s.label}
              icon={s.icon}
              timestamp={job[s.ts] as string | null}
              busy={busy === s.key}
              onClick={() => toggleStep(s.key)}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
        <div className="space-y-6">
          <section className="bg-card border border-line rounded-2xl p-5">
            <h2 className="font-extrabold text-white tracking-tight mb-4">
              Contact Information
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-bold text-zinc-500">
                  Name
                </div>
                <div className="font-bold text-white tracking-tight">
                  {job.customer_name}
                </div>
              </div>
              {job.customer_phone && (
                <a
                  href={`sms:${job.customer_phone}`}
                  className="flex items-center gap-3 hover:text-white"
                >
                  <span className="w-8 h-8 rounded-full bg-black text-zinc-400 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                  </span>
                  <span className="font-bold text-white tracking-tight">
                    {job.customer_phone}
                  </span>
                </a>
              )}
              {job.customer_email && (
                <a
                  href={`mailto:${job.customer_email}`}
                  className="flex items-center gap-3 hover:text-white"
                >
                  <span className="w-8 h-8 rounded-full bg-black text-zinc-400 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <span className="font-bold text-white tracking-tight">
                    {job.customer_email}
                  </span>
                </a>
              )}
              {job.customer_address && (
                <a
                  href={`https://www.google.com/maps?q=${mapsAddr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 hover:text-white"
                >
                  <span className="w-8 h-8 rounded-full bg-black text-zinc-400 flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span className="font-bold text-white tracking-tight">
                    {job.customer_address}
                  </span>
                </a>
              )}
            </div>
            {job.customer_address && (
              <div className="mt-4 rounded-2xl overflow-hidden border border-line aspect-[4/3] bg-black">
                <JobLocationView
                  address={job.customer_address}
                  latitude={job.customer_latitude}
                  longitude={job.customer_longitude}
                  mapsAddr={mapsAddr}
                />
              </div>
            )}
          </section>

          <section className="bg-card border border-line rounded-2xl p-5">
            <h2 className="font-extrabold text-white tracking-tight mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="w-full inline-flex items-center justify-between bg-primary hover:opacity-90 text-primary-foreground rounded-2xl px-4 py-3 text-sm font-extrabold h-auto"
              >
                <span>Pay</span>
                <span>›</span>
              </Button>
              <Link
                href="/schedule"
                className="w-full inline-flex items-center justify-between border border-line hover:bg-black rounded-2xl px-4 py-3 text-sm text-zinc-300 font-bold"
              >
                <span>View in Schedule</span>
                <span className="text-zinc-500">›</span>
              </Link>
              <Button
                variant="ghost"
                type="button"
                onClick={createInvoiceFromJob}
                disabled={creatingInvoice}
                className="w-full inline-flex items-center justify-between border-line hover:bg-black rounded-2xl px-4 py-3 text-sm text-zinc-300 font-bold h-auto disabled:opacity-50"
              >
                <span>{creatingInvoice ? "Creating…" : "Create Invoice"}</span>
                <span className="text-zinc-500">›</span>
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={sendReviewRequest}
                disabled={sendingReview}
                className="w-full inline-flex items-center justify-between border-line hover:bg-black rounded-2xl px-4 py-3 text-sm text-zinc-300 font-bold h-auto disabled:opacity-50"
              >
                <span>{sendingReview ? "Sending…" : "Send Review Request"}</span>
                <span className="text-zinc-500">›</span>
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <JobDetailsSection job={job} staff={staff} onSave={patchJob} />

          <LineItemsSection
            job={job}
            subtotalCents={subtotal}
            onSave={patchJob}
          />

          <PaymentsSection
            jobId={job.id}
            customerId={job.customer_id}
            jobTotalCents={job.price_cents}
            customerEmail={job.customer_email}
            customerPhone={job.customer_phone}
            payments={job.payments}
            paidTotalCents={job.paid_total_cents}
            onChanged={refreshJob}
          />

          <NotesSection notes={job.notes} onSave={patchJob} />
          <AttachmentsSection jobId={job.id} />

          <ChecklistSection
            jobId={job.id}
            items={job.checklist_items}
            onLocalChange={(items) =>
              setJob((j) => ({ ...j, checklist_items: items }))
            }
            onSave={patchJob}
          />
        </div>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          jobId={job.id}
          jobTotalCents={job.price_cents}
          paidTotalCents={job.paid_total_cents}
          onClose={() => setCheckoutOpen(false)}
          onChoose={(choice) => {
            setCheckoutOpen(false);
            if (choice === "card" || choice === "other") {
              setPaymentModalOpen(true);
            }
          }}
        />
      )}

      {paymentModalOpen && (
        <RecordPaymentModal
          jobId={job.id}
          customerId={job.customer_id}
          jobTotalCents={job.price_cents}
          paidTotalCents={job.paid_total_cents}
          customerEmail={job.customer_email}
          customerPhone={job.customer_phone}
          onClose={() => setPaymentModalOpen(false)}
          onRecorded={async () => {
            setPaymentModalOpen(false);
            await refreshJob();
          }}
        />
      )}
    </div>
  );
}

function SectionEditButton({
  label = "Edit",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="text-sm border border-line bg-card hover:bg-black rounded-full px-3 py-1.5 text-zinc-300 h-auto"
    >
      {label}
    </Button>
  );
}

function SectionSaveCancel({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={saving}
        className="text-sm border border-line bg-card hover:bg-black rounded-full px-3 py-1.5 text-zinc-300 h-auto"
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onSave}
        disabled={saving}
        className="text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-3 py-1.5 font-bold h-auto"
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function JobDetailsSection({
  job,
  staff,
  onSave,
}: {
  job: Detail;
  staff: Staff[];
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState(toDateInput(job.scheduled_at));
  const [startTime, setStartTime] = useState(toTimeInput(job.scheduled_at));
  const [endDate, setEndDate] = useState(
    job.end_time ? toDateInput(job.end_time) : toDateInput(job.scheduled_at)
  );
  const [endTime, setEndTime] = useState(
    job.end_time ? toTimeInput(job.end_time) : toTimeInput(job.scheduled_at)
  );
  const [anytime, setAnytime] = useState(!!job.anytime);
  const [salesIds, setSalesIds] = useState<number[]>(
    job.sales.map((s) => s.id)
  );
  const [techIds, setTechIds] = useState<number[]>(
    job.techs.map((s) => s.id)
  );
  const [leadSource, setLeadSource] = useState(job.lead_source ?? "");
  const [recurring, setRecurring] = useState(!!job.recurring);

  function resetFromJob() {
    setStartDate(toDateInput(job.scheduled_at));
    setStartTime(toTimeInput(job.scheduled_at));
    setEndDate(
      job.end_time ? toDateInput(job.end_time) : toDateInput(job.scheduled_at)
    );
    setEndTime(
      job.end_time ? toTimeInput(job.end_time) : toTimeInput(job.scheduled_at)
    );
    setAnytime(!!job.anytime);
    setSalesIds(job.sales.map((s) => s.id));
    setTechIds(job.techs.map((s) => s.id));
    setLeadSource(job.lead_source ?? "");
    setRecurring(!!job.recurring);
  }

  // Same scheduling behavior as JobForm: moving Start drags End along to
  // preserve the current duration (falling back to +2h when the duration
  // is missing or non-positive)…
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
  // …and End can never land before Start — clamp back to Start.
  function applyNewEnd(newDate: string, newTime: string) {
    const start = parseLocal(startDate, startTime);
    const end = parseLocal(newDate, newTime);
    if (start && end && end.getTime() < start.getTime()) {
      setEndDate(dateOnly(start));
      setEndTime(timeOnly(start));
      return;
    }
    setEndDate(newDate);
    setEndTime(newTime);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave({
      start_time: combineLocal(startDate, anytime ? "00:00" : startTime),
      end_time: anytime
        ? null
        : combineLocal(endDate || startDate, endTime || startTime),
      anytime,
      sales_ids: salesIds,
      tech_ids: techIds,
      lead_source: leadSource || null,
      recurring,
    });
    setSaving(false);
    if (ok) setEditing(false);
  }

  function startEdit() {
    resetFromJob();
    setEditing(true);
  }

  const end = job.end_time ? new Date(job.end_time) : null;

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">Job Details</h2>
        {editing ? (
          <SectionSaveCancel
            saving={saving}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <SectionEditButton onClick={startEdit} />
        )}
      </div>
      {!editing ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-bold text-zinc-500">Scheduled</div>
            <div className="font-bold text-white tracking-tight">
              {dayStamp(job.scheduled_at)}
            </div>
            <div className="text-zinc-400">
              {job.anytime
                ? "Anytime"
                : `${timeStamp(job.scheduled_at)}${
                    end ? ` – ${timeStamp(end.toISOString())}` : ""
                  }`}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-500">Duration</div>
            <div className="font-bold text-white tracking-tight">
              {job.duration_minutes} min
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-500">Salesperson</div>
            <div className="font-bold text-white tracking-tight">
              {job.sales.length === 0
                ? "—"
                : job.sales.map((s) => s.name).join(", ")}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-500">Dispatched To</div>
            <div className="font-bold text-white tracking-tight">
              {job.techs.length === 0
                ? "—"
                : job.techs.map((s) => s.name).join(", ")}
            </div>
          </div>
          {job.lead_source && (
            <div>
              <div className="text-xs font-bold text-zinc-500">Lead Source</div>
              <div className="font-bold text-white tracking-tight">
                {job.lead_source}
              </div>
            </div>
          )}
          {job.recurring ? (
            <div>
              <div className="text-xs font-bold text-zinc-500">Recurring</div>
              <div className="font-bold text-white tracking-tight">Yes</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Start Date &amp; Time
              </Label>
              <div className="flex items-center gap-2">
                <PickerInput
                  type="date"
                  value={startDate}
                  onChange={(e) => applyNewStart(e.target.value, startTime)}
                  className="w-[150px]"
                />
                <PickerInput
                  type="time"
                  value={startTime}
                  onChange={(e) => applyNewStart(startDate, e.target.value)}
                  disabled={anytime}
                  className="w-[110px]"
                />
              </div>
            </div>
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                End Date &amp; Time
              </Label>
              <div className="flex items-center gap-2">
                <PickerInput
                  type="date"
                  value={endDate}
                  onChange={(e) => applyNewEnd(e.target.value, endTime)}
                  className="w-[150px]"
                />
                <PickerInput
                  type="time"
                  value={endTime}
                  onChange={(e) => applyNewEnd(endDate, e.target.value)}
                  disabled={anytime}
                  className="w-[110px]"
                />
              </div>
            </div>
            <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold">
              <Checkbox
                checked={anytime}
                onCheckedChange={(c) => setAnytime(c === true)}
                className="rounded border-line-strong text-white focus:ring-zinc-500"
              />
              Anytime (no specific time of day)
            </Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Lead Source
              </Label>
              <StaffSinglePicker
                staff={staff}
                id={salesIds[0] ?? null}
                setId={(id) => setSalesIds(id == null ? [] : [id])}
                placeholder="Select salesperson…"
              />
            </div>
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Dispatched To
              </Label>
              <StaffMultiPicker
                staff={staff}
                ids={techIds}
                setIds={setTechIds}
                placeholder="Search technicians…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {LEAD_METHODS.map((m) => (
              <Label
                key={m}
                className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold"
              >
                {/* Checkbox primitive used as a single-select toggle so the
                    lead-method row visually matches the Anytime / Schedule
                    later checkboxes elsewhere. */}
                <Checkbox
                  checked={leadSource === m}
                  onCheckedChange={(c) => setLeadSource(c === true ? m : "")}
                  className="rounded border-line-strong text-white focus:ring-zinc-500"
                />
                {m}
              </Label>
            ))}
            <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold">
              <Checkbox
                checked={recurring}
                onCheckedChange={(c) => setRecurring(c === true)}
                className="rounded border-line-strong text-white focus:ring-zinc-500"
              />
              Recurring service
            </Label>
          </div>
        </div>
      )}
    </section>
  );
}

type LineItemDraft = {
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

function fromDetail(li: LineItemDetail): LineItemDraft {
  return {
    key: uid(),
    id: li.id,
    title: li.title,
    description: li.description ?? "",
    quantity: li.quantity,
    // Legacy rows can hold float cents (written before the Math.round
    // guards existed) — normalize to integer cents on the way into the
    // editor so displays and re-saves never perpetuate the drift.
    price_cents: Math.round(li.price_cents),
    taxable: !!li.taxable,
    upsell: !!li.upsell,
    is_addon: !!li.is_addon,
  };
}

function LineItemsSection({
  job,
  subtotalCents,
  onSave,
}: {
  job: Detail;
  subtotalCents: number;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "add">("view");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<LineItemDraft[]>(
    job.line_items.map(fromDetail)
  );
  const [additions, setAdditions] = useState<LineItemDraft[]>([]);

  useEffect(() => {
    setExisting(job.line_items.map(fromDetail));
  }, [job.line_items]);

  function startEdit() {
    setExisting(job.line_items.map(fromDetail));
    setMode("edit");
  }
  function startAdd() {
    setAdditions([
      {
        key: uid(),
        title: "",
        description: "",
        quantity: 1,
        price_cents: 0,
        taxable: true,
        upsell: false,
        is_addon: true,
      },
    ]);
    setMode("add");
  }
  function cancel() {
    setExisting(job.line_items.map(fromDetail));
    setAdditions([]);
    setMode("view");
  }

  async function saveEdit() {
    setSaving(true);
    const ok = await onSave({
      line_items: existing.map((li) => ({
        title: li.title.trim(),
        description: li.description || null,
        quantity: li.quantity || 1,
        price_cents: Math.round(li.price_cents),
        taxable: li.taxable,
        upsell: li.is_addon ? li.upsell : false,
        is_addon: li.is_addon,
      })),
    });
    setSaving(false);
    if (ok) setMode("view");
  }

  async function saveAdd() {
    const filtered = additions.filter((li) => li.title.trim());
    if (filtered.length === 0) {
      setAdditions([]);
      setMode("view");
      return;
    }
    setSaving(true);
    const combined = [
      ...job.line_items.map((li) => ({
        title: li.title,
        description: li.description,
        quantity: li.quantity,
        // Round on resubmit too — never perpetuate legacy float cents.
        price_cents: Math.round(li.price_cents),
        taxable: !!li.taxable,
        upsell: !!li.upsell,
        is_addon: !!li.is_addon,
      })),
      ...filtered.map((li) => ({
        title: li.title.trim(),
        description: li.description || null,
        quantity: li.quantity || 1,
        price_cents: Math.round(li.price_cents),
        taxable: li.taxable,
        upsell: li.upsell,
        is_addon: true,
      })),
    ];
    const ok = await onSave({ line_items: combined });
    setSaving(false);
    if (ok) {
      setAdditions([]);
      setMode("view");
    }
  }

  function updateExisting(key: string, patch: Partial<LineItemDraft>) {
    setExisting((arr) =>
      arr.map((li) => (li.key === key ? { ...li, ...patch } : li))
    );
  }
  function removeExisting(key: string) {
    setExisting((arr) => arr.filter((li) => li.key !== key));
  }
  function updateAddition(key: string, patch: Partial<LineItemDraft>) {
    setAdditions((arr) =>
      arr.map((li) => (li.key === key ? { ...li, ...patch } : li))
    );
  }
  function removeAddition(key: string) {
    setAdditions((arr) => arr.filter((li) => li.key !== key));
  }
  function appendAddition() {
    setAdditions((arr) => [
      ...arr,
      {
        key: uid(),
        title: "",
        description: "",
        quantity: 1,
        price_cents: 0,
        taxable: true,
        upsell: false,
        is_addon: true,
      },
    ]);
  }

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-extrabold text-white tracking-tight">Line Items</h2>
        {mode === "view" && (
          <div className="flex gap-2">
            <SectionEditButton onClick={startEdit} />
            <Button
              type="button"
              variant="ghost"
              onClick={startAdd}
              className="text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-3 py-1.5 font-bold h-auto"
            >
              + Add
            </Button>
          </div>
        )}
        {mode === "edit" && (
          <SectionSaveCancel
            saving={saving}
            onSave={saveEdit}
            onCancel={cancel}
          />
        )}
        {mode === "add" && (
          <SectionSaveCancel
            saving={saving}
            onSave={saveAdd}
            onCancel={cancel}
          />
        )}
      </div>

      {mode === "view" && (
        <>
          {job.line_items.length === 0 ? (
            <p className="text-sm text-zinc-500">No line items.</p>
          ) : (
            <ul className="divide-y divide-line">
              {job.line_items.map((li) => (
                <li
                  key={li.id}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-white tracking-tight">
                      {li.title}
                    </div>
                    {li.description && (
                      <div className="text-sm text-zinc-400 mt-2 font-bold">
                        {li.description}
                      </div>
                    )}
                    <div className="text-xs font-bold text-zinc-500 mt-2 flex gap-2 flex-wrap">
                      <span>
                        Qty {li.quantity} · {money(li.price_cents)} ea
                      </span>
                      {li.taxable ? (
                        <span className="text-emerald-600">Taxable</span>
                      ) : null}
                      {li.upsell ? (
                        <span className="text-violet-600">Upsell</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-white tracking-tight tabular-nums whitespace-nowrap">
                    {money(Math.round(li.quantity * li.price_cents))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <TotalsPanel
            subtotalCents={subtotalCents}
            totalCents={job.price_cents}
            paidTotalCents={job.paid_total_cents}
            tipTotalCents={job.tip_total_cents}
          />
        </>
      )}

      {mode === "edit" && (
        <div className="space-y-3">
          {existing.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No line items. Use Add to create one.
            </p>
          ) : (
            existing.map((li) => (
              <LineItemEditor
                key={li.key}
                item={li}
                allowUpsell={li.is_addon}
                onChange={(patch) => updateExisting(li.key, patch)}
                onRemove={() => removeExisting(li.key)}
              />
            ))
          )}
        </div>
      )}

      {mode === "add" && (
        <div className="space-y-3">
          {additions.map((li) => (
            <LineItemEditor
              key={li.key}
              item={li}
              allowUpsell
              onChange={(patch) => updateAddition(li.key, patch)}
              onRemove={() => removeAddition(li.key)}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={appendAddition}
            className="text-sm border border-line bg-card hover:bg-black rounded-full px-3 py-1.5 text-zinc-300 h-auto"
          >
            + Another item
          </Button>
        </div>
      )}
    </section>
  );
}

function LineItemEditor({
  item,
  allowUpsell,
  onChange,
  onRemove,
}: {
  item: LineItemDraft;
  allowUpsell: boolean;
  onChange: (patch: Partial<LineItemDraft>) => void;
  onRemove: () => void;
}) {
  const lineTotal = Math.round(item.quantity * item.price_cents);
  return (
    <div className="border border-line rounded-2xl p-4 space-y-3 bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <Input
            type="text"
            value={item.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Service title"
            className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
          />
          <Textarea
            value={item.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="Description (optional)"
            className="w-full border-line rounded-2xl px-4 py-2 text-sm h-auto"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Quantity
              </Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={item.quantity}
                onChange={(e) =>
                  onChange({ quantity: Number(e.target.value) || 0 })
                }
                className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
              />
            </div>
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Price ($)
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={(item.price_cents / 100).toString()}
                onChange={(e) =>
                  onChange({
                    price_cents:
                      Math.round(Number(e.target.value) * 100) || 0,
                  })
                }
                className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Label className="inline-flex items-center gap-2 font-normal">
              <Checkbox
                checked={item.taxable}
                onCheckedChange={(c) => onChange({ taxable: c === true })}
                className="rounded border-line-strong text-white focus:ring-zinc-500"
              />
              Taxable
            </Label>
            {allowUpsell && (
              <Label className="inline-flex items-center gap-2 font-normal">
                <Checkbox
                  checked={item.upsell}
                  onCheckedChange={(c) => onChange({ upsell: c === true })}
                  className="rounded border-line-strong text-white focus:ring-zinc-500"
                />
                Upsell
              </Label>
            )}
          </div>
        </div>
        <Button
          type="button"
          onClick={onRemove}
          variant="ghost"
          className="text-zinc-500 hover:text-rose-500 p-1 h-auto"
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
        </Button>
      </div>
      <div className="flex justify-end text-sm text-zinc-400 font-bold">
        Item total:{" "}
        <span className="font-extrabold text-white tracking-tight ml-1">
          {money(lineTotal)}
        </span>
      </div>
    </div>
  );
}

function NotesSection({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");

  useEffect(() => {
    setDraft(notes ?? "");
  }, [notes]);

  async function save() {
    setSaving(true);
    const ok = await onSave({ notes: draft.trim() ? draft : null });
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">Private Notes</h2>
        {editing ? (
          <SectionSaveCancel
            saving={saving}
            onSave={save}
            onCancel={() => {
              setDraft(notes ?? "");
              setEditing(false);
            }}
          />
        ) : (
          <SectionEditButton onClick={() => setEditing(true)} />
        )}
      </div>
      {!editing ? (
        notes ? (
          <p className="text-sm text-zinc-300 font-bold whitespace-pre-wrap">
            {notes}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">No notes.</p>
        )
      ) : (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Add any additional notes…"
          className="w-full border-line rounded-2xl px-4 py-3 text-sm bg-card h-auto"
        />
      )}
    </section>
  );
}

function ChecklistSection({
  jobId,
  items,
  onLocalChange,
  onSave,
}: {
  jobId: number;
  items: { id: number; text: string; completed: number }[];
  onLocalChange: (
    items: { id: number; text: string; completed: number }[]
  ) => void;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<
    { key: string; text: string; completed: boolean }[]
  >(items.map((c) => ({ key: uid(), text: c.text, completed: !!c.completed })));

  useEffect(() => {
    if (!editing) {
      setDraft(
        items.map((c) => ({
          key: uid(),
          text: c.text,
          completed: !!c.completed,
        }))
      );
    }
  }, [items, editing]);

  async function toggle(idx: number) {
    const next = items.map((c, i) =>
      i === idx ? { ...c, completed: c.completed ? 0 : 1 } : c
    );
    onLocalChange(next);
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checklist_items: next.map((c) => ({
          text: c.text,
          completed: c.completed,
        })),
      }),
    });
  }

  async function save() {
    setSaving(true);
    const ok = await onSave({
      checklist_items: draft
        .filter((c) => c.text.trim())
        .map((c) => ({ text: c.text.trim(), completed: c.completed })),
    });
    setSaving(false);
    if (ok) setEditing(false);
  }

  function update(key: string, patch: Partial<{ text: string; completed: boolean }>) {
    setDraft((arr) =>
      arr.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  }
  function remove(key: string) {
    setDraft((arr) => arr.filter((c) => c.key !== key));
  }
  function append() {
    setDraft((arr) => [...arr, { key: uid(), text: "", completed: false }]);
  }

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">Checklist</h2>
        {editing ? (
          <SectionSaveCancel
            saving={saving}
            onSave={save}
            onCancel={() => {
              setDraft(
                items.map((c) => ({
                  key: uid(),
                  text: c.text,
                  completed: !!c.completed,
                }))
              );
              setEditing(false);
            }}
          />
        ) : (
          <SectionEditButton onClick={() => setEditing(true)} />
        )}
      </div>
      {!editing ? (
        items.length === 0 ? (
          <p className="text-sm text-zinc-500">No tasks selected.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <Checkbox
                  checked={!!c.completed}
                  onCheckedChange={() => toggle(i)}
                  className="rounded border-line-strong text-white focus:ring-zinc-500"
                />
                <span
                  className={
                    "text-sm " +
                    (c.completed
                      ? "text-zinc-500 line-through"
                      : "text-zinc-300")
                  }
                >
                  {c.text}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-2">
          {draft.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <Checkbox
                checked={c.completed}
                onCheckedChange={(ch) =>
                  update(c.key, { completed: ch === true })
                }
                className="rounded border-line-strong text-white focus:ring-zinc-500"
              />
              <Input
                type="text"
                value={c.text}
                onChange={(e) => update(c.key, { text: e.target.value })}
                placeholder="Task description"
                className="flex-1 border-line rounded-full px-4 py-2 text-sm h-auto"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove(c.key)}
                className="text-zinc-500 hover:text-rose-500 px-2 h-auto"
                aria-label="Remove task"
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={append}
            className="text-sm border border-line bg-card hover:bg-black rounded-full px-3 py-1.5 text-zinc-300 h-auto"
          >
            + Add task
          </Button>
        </div>
      )}
    </section>
  );
}

function TotalsPanel({
  subtotalCents,
  totalCents,
  paidTotalCents,
  tipTotalCents,
}: {
  subtotalCents: number;
  totalCents: number;
  paidTotalCents: number;
  tipTotalCents: number;
}) {
  const dueCents = Math.max(0, totalCents - paidTotalCents);
  const totalPaidCents = paidTotalCents + tipTotalCents;
  const hasTips = tipTotalCents > 0;
  return (
    <div className="border-t border-line mt-4 pt-4">
      <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
        <Row label="Subtotal" value={money(subtotalCents)} />
        <Row label="Total" value={money(totalCents)} bold />
        <Divider />
        {hasTips ? (
          <>
            <Row
              label="Paid (w/o tip)"
              value={money(paidTotalCents)}
              valueClass={
                paidTotalCents > 0 ? "text-emerald-600" : undefined
              }
            />
            <Row
              label="Tip"
              value={money(tipTotalCents)}
              valueClass="text-emerald-600"
            />
            <Row
              label="Total Paid"
              value={money(totalPaidCents)}
              valueClass={
                totalPaidCents > 0 ? "text-emerald-600" : undefined
              }
              bold
            />
          </>
        ) : (
          <Row
            label="Total Paid"
            value={money(paidTotalCents)}
            valueClass={
              paidTotalCents > 0 ? "text-emerald-600" : undefined
            }
            bold
          />
        )}
        <Divider />
        <Row
          label="Amount Due"
          value={money(dueCents)}
          bold
          valueClass={dueCents > 0 ? "text-rose-600" : undefined}
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  valueClass,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={"text-zinc-400 " + (bold ? "font-bold" : "")}>
        {label}
      </dt>
      <dd
        className={
          "tabular-nums " +
          (bold ? "font-bold " : "font-semibold ") +
          (valueClass || "text-white")
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-line my-1.5" />;
}

function StepButton({
  index,
  label,
  icon,
  timestamp,
  busy,
  onClick,
}: {
  index: number;
  label: string;
  icon: React.ReactNode;
  timestamp: string | null;
  busy: boolean;
  onClick: () => void;
}) {
  const done = !!timestamp;
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={busy}
      className={
        "relative text-left rounded-2xl border p-4 flex items-start gap-3 h-auto " +
        (done
          ? "border-line-strong bg-black"
          : "border-line bg-card hover:bg-black")
      }
    >
      <div
        className={
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 " +
          (done ? "bg-slate-900 text-white" : "bg-black text-zinc-500")
        }
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-zinc-500">
          Step {index + 1}
        </div>
        <div className="font-extrabold text-white tracking-tight">{label}</div>
        <div className="text-xs text-zinc-400 mt-0.5">
          {done ? `Logged ${timeStamp(timestamp)}` : "Tap to log"}
        </div>
      </div>
    </Button>
  );
}

type UnifiedStatus =
  | "scheduled"
  | "in_progress"
  | "completed_unpaid"
  | "completed_partial"
  | "completed_paid";

const STATUS_VISUALS: Record<
  UnifiedStatus,
  { label: string; outer: string; dot: string }
> = {
  scheduled: {
    label: "Scheduled",
    outer:
      "bg-black text-zinc-400 border border-line",
    dot: "bg-slate-400",
  },
  in_progress: {
    label: "In Progress",
    outer:
      "bg-amber-50 text-amber-700 border border-amber-100",
    dot: "bg-amber-500",
  },
  completed_unpaid: {
    label: "Completed - Unpaid",
    outer:
      "bg-rose-50 text-rose-700 border border-rose-100",
    dot: "bg-rose-500",
  },
  completed_partial: {
    label: "Partially Paid",
    outer:
      "bg-amber-50 text-amber-700 border border-amber-100",
    dot: "bg-amber-500",
  },
  completed_paid: {
    label: "Paid",
    outer:
      "bg-emerald-50 text-emerald-700 border border-emerald-100",
    dot: "bg-emerald-500",
  },
};

function JobStatusBadge({ status }: { status: UnifiedStatus }) {
  const v = STATUS_VISUALS[status];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full " +
        v.outer
      }
    >
      <span className={"w-1.5 h-1.5 rounded-full " + v.dot} />
      {v.label}
    </span>
  );
}

function AttachmentsSection({ jobId }: { jobId: number }) {
  const [items, setItems] = useState<JobAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  // Native camera is offered only inside the Capacitor shell. Resolved in an
  // effect (not at render) so SSR and the first client paint agree.
  const [native, setNative] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/attachments`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  useEffect(() => {
    load();
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function fileToDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function compressImage(
    file: File
  ): Promise<{ blob: Blob; mime: string }> {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image load failed"));
      });
      let { naturalWidth: width, naturalHeight: height } = img;
      const MAX = 1920;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.82)
      );
      if (!blob) throw new Error("canvas toBlob returned null");
      return { blob, mime: "image/jpeg" };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function upload(
    kind: JobAttachmentKind,
    filename: string,
    mime_type: string,
    content: string
  ) {
    setAdding(true);
    const res = await fetch(`/api/jobs/${jobId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, filename, mime_type, content }),
    });
    setAdding(false);
    if (res.ok) {
      const row = (await res.json()) as JobAttachment;
      setItems((arr) => [...arr, row]);
    } else {
      const j = await res.json().catch(() => ({}));
      setRecordError(j.error || "Could not upload attachment");
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      try {
        if (isImage) {
          const { blob, mime } = await compressImage(file);
          const content = await fileToDataUrl(blob);
          const stem = file.name.replace(/\.[^.]+$/, "");
          await upload("image", `${stem}.jpg`, mime, content);
          continue;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "compression failed";
        setRecordError(`Could not attach ${file.name}: ${msg}`);
        continue;
      }
      const content = await fileToDataUrl(file);
      await upload(
        "file",
        file.name,
        file.type || "application/octet-stream",
        content
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Native camera path. The picker returns a Blob; we wrap it in a File and run
  // it through the same compress + upload pipeline as the web file <input>.
  async function handleNativePhoto() {
    setRecordError(null);
    let blob: Blob | null;
    try {
      blob = await captureNativePhoto();
    } catch (err) {
      // captureNativePhoto throws on real failures (denied permission, no
      // camera, decode error) and returns null only on a deliberate cancel.
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Could not open the camera.";
      setRecordError(msg);
      return;
    }
    if (!blob) return; // user cancelled
    try {
      const file = new File([blob], "photo.jpg", {
        type: blob.type || "image/jpeg",
      });
      const { blob: out, mime } = await compressImage(file);
      const content = await fileToDataUrl(out);
      await upload("image", "photo.jpg", mime, content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "upload failed";
      setRecordError(`Could not add photo: ${msg}`);
    }
  }

  async function startRecording() {
    setRecordError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const content = await fileToDataUrl(blob);
        const ext = (recorder.mimeType || "audio/webm").includes("mp4")
          ? "mp4"
          : "webm";
        const filename = `voice-memo-${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.${ext}`;
        setRecording(false);
        setElapsed(0);
        await upload("audio", filename, recorder.mimeType || "audio/webm", content);
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not start recording";
      setRecordError(`Microphone access denied: ${msg}`);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  async function removeAttachment(id: number) {
    if (!confirm("Remove this attachment?")) return;
    const res = await fetch(`/api/jobs/${jobId}/attachments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setItems((arr) => arr.filter((a) => a.id !== id));
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">
          Attachments
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          disabled={adding}
          onClick={() => fileInputRef.current?.click()}
          className="h-auto inline-flex items-center gap-2 border border-dashed border-line bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-zinc-200 disabled:opacity-50"
        >
          Add Attachment
        </Button>
        {native && (
          <Button
            type="button"
            variant="ghost"
            disabled={adding}
            onClick={handleNativePhoto}
            className="h-auto inline-flex items-center gap-2 border border-dashed border-line bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-zinc-200 disabled:opacity-50"
          >
            Take Photo
          </Button>
        )}
        {recording ? (
          <Button
            type="button"
            variant="ghost"
            onClick={stopRecording}
            className="h-auto inline-flex items-center gap-2 border border-dashed border-rose-500/60 bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-rose-300"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Stop · {formatDuration(elapsed)}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={adding}
            onClick={startRecording}
            className="h-auto inline-flex items-center gap-2 border border-dashed border-line bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-zinc-200 disabled:opacity-50"
          >
            Add Voice Memo
          </Button>
        )}
      </div>
      {recordError && (
        <p className="mt-2 text-xs text-rose-400 font-bold">{recordError}</p>
      )}
      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No attachments.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 border border-line rounded-xl px-3 py-2 bg-black/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white tracking-tight truncate">
                  {a.filename}
                </div>
                <div className="text-xs text-zinc-500 font-bold">
                  {a.kind} · {formatBytes(a.size_bytes)}
                </div>
                {a.kind === "audio" && (
                  <audio
                    controls
                    src={a.content}
                    className="mt-2 w-full max-w-sm"
                  />
                )}
                {a.kind === "image" && (
                  <a
                    href={a.content}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={a.content}
                      alt={a.filename}
                      className="mt-2 max-h-40 rounded-lg border border-line"
                    />
                  </a>
                )}
                {a.kind === "file" && (
                  <a
                    href={a.content}
                    download={a.filename}
                    className="mt-1 inline-block text-xs text-zinc-300 hover:text-white underline"
                  >
                    Download
                  </a>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Remove ${a.filename}`}
                onClick={() => removeAttachment(a.id)}
                className="h-auto p-1 text-zinc-500 hover:text-white"
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
