"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PaymentsSection from "@/components/jobs/PaymentsSection";
import RecordPaymentModal from "@/components/jobs/RecordPaymentModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Detail = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
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
  const subscription = initialSubscription;

  // Sync local job state with initialJob whenever the server-provided
  // record changes. Without this, useState(initialJob) only seeds on
  // the first render — so freshly-fetched timestamps (e.g. step
  // logs persisted on a previous visit, auto-completed steps from a
  // payment, or any router refresh) won't appear in the buttons until
  // the next click triggers a setJob().
  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);

  async function refreshJob() {
    const res = await fetch(`/api/jobs/${job.id}`);
    if (res.ok) {
      const updated = (await res.json()) as Detail;
      setJob(updated);
    }
    // Bust the router's client-side cache so the next navigation back
    // to this URL re-renders the server component with fresh data.
    router.refresh();
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
      // Bust the router cache. Without this, navigating away and back
      // to /schedule/[id] serves the previously-rendered tree (with
      // pre-click timestamps), making the step buttons appear unlogged
      // even though the DB has them.
      router.refresh();
    }
  }

  async function deleteJob() {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    router.push("/schedule");
    router.refresh();
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
          <Link
            href={`/schedule/${job.id}/edit`}
            className="text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300"
          >
            Edit
          </Link>
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
                <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-emerald-300 bg-emerald-500/20 rounded-full px-2 py-0.5">
                  Active Subscription
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-rose-300 bg-rose-500/20 rounded-full px-2 py-0.5">
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
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
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
                <iframe
                  title="Map"
                  src={`https://maps.google.com/maps?q=${mapsAddr}&z=15&output=embed`}
                  className="w-full h-full"
                  loading="lazy"
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
                onClick={() => setPaymentModalOpen(true)}
                className="w-full inline-flex items-center justify-between border-line hover:bg-black rounded-2xl px-4 py-3 text-sm text-zinc-300 font-bold h-auto"
              >
                <span>Record Payment</span>
                <span className="text-zinc-500">›</span>
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
                title="Coming soon"
                className="w-full inline-flex items-center justify-between border-line hover:bg-black rounded-2xl px-4 py-3 text-sm text-zinc-300 font-bold h-auto"
              >
                <span>Create Invoice</span>
                <span className="text-zinc-500">›</span>
              </Button>
              <Button
                variant="ghost"
                type="button"
                title="Coming soon"
                className="w-full inline-flex items-center justify-between border-line hover:bg-black rounded-2xl px-4 py-3 text-sm text-zinc-300 font-bold h-auto"
              >
                <span>Send Review Request</span>
                <span className="text-zinc-500">›</span>
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-card border border-line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-white tracking-tight">Job Details</h2>
              <Link
                href={`/schedule/${job.id}/edit`}
                className="text-sm text-zinc-300 font-bold hover:text-white hover:underline"
              >
                Edit
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Scheduled
                </div>
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
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Duration
                </div>
                <div className="font-bold text-white tracking-tight">
                  {job.duration_minutes} min
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Salesperson
                </div>
                <div className="font-bold text-white tracking-tight">
                  {job.sales.length === 0
                    ? "—"
                    : job.sales.map((s) => s.name).join(", ")}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Dispatched To
                </div>
                <div className="font-bold text-white tracking-tight">
                  {job.techs.length === 0
                    ? "—"
                    : job.techs.map((s) => s.name).join(", ")}
                </div>
              </div>
              {job.lead_source && (
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">
                    Lead Source
                  </div>
                  <div className="font-bold text-white tracking-tight">
                    {job.lead_source}
                  </div>
                </div>
              )}
              {job.recurring ? (
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">
                    Recurring
                  </div>
                  <div className="font-bold text-white tracking-tight">Yes</div>
                </div>
              ) : null}
            </div>
            {job.notes && (
              <div className="mt-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Notes
                </div>
                <p className="text-sm text-zinc-300 font-bold mt-1 whitespace-pre-wrap">
                  {job.notes}
                </p>
              </div>
            )}
          </section>

          <section className="bg-card border border-line rounded-2xl p-5">
            <h2 className="font-extrabold text-white tracking-tight mb-4">Line Items</h2>
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
                      <div className="font-bold text-white tracking-tight">{li.title}</div>
                      {li.description && (
                        <div className="text-sm text-zinc-400 mt-2 font-bold">
                          {li.description}
                        </div>
                      )}
                      <div className="text-eyebrow uppercase text-zinc-500 mt-2 flex gap-2 flex-wrap">
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
              subtotalCents={subtotal}
              totalCents={job.price_cents}
              paidTotalCents={job.paid_total_cents}
              tipTotalCents={job.tip_total_cents}
            />
          </section>

          <PaymentsSection
            jobId={job.id}
            jobTotalCents={job.price_cents}
            customerEmail={job.customer_email}
            customerPhone={job.customer_phone}
            payments={job.payments}
            paidTotalCents={job.paid_total_cents}
            onChanged={refreshJob}
          />

          <section className="bg-card border border-line rounded-2xl p-5">
            <h2 className="font-extrabold text-white tracking-tight mb-4">Checklist</h2>
            {job.checklist_items.length === 0 ? (
              <p className="text-sm text-zinc-500">No tasks selected.</p>
            ) : (
              <ChecklistView
                jobId={job.id}
                items={job.checklist_items}
                onChange={(items) =>
                  setJob((j) => ({ ...j, checklist_items: items }))
                }
              />
            )}
          </section>
        </div>
      </div>

      {paymentModalOpen && (
        <RecordPaymentModal
          jobId={job.id}
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

// Step button reads its "logged" state directly from the timestamp
// prop on every render — no local React state, no useEffect-only
// sync. If the parent's `job.en_route_at` is a string, the button is
// rendered as logged. Period.
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
        <div className="text-xs text-zinc-500 uppercase tracking-wide">
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

function ChecklistView({
  jobId,
  items,
  onChange,
}: {
  jobId: number;
  items: { id: number; text: string; completed: number }[];
  onChange: (
    items: { id: number; text: string; completed: number }[]
  ) => void;
}) {
  async function toggle(idx: number) {
    const next = items.map((c, i) =>
      i === idx ? { ...c, completed: c.completed ? 0 : 1 } : c
    );
    onChange(next);
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
  return (
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
              (c.completed ? "text-zinc-500 line-through" : "text-zinc-300")
            }
          >
            {c.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
