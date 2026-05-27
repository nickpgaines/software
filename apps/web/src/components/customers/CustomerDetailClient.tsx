"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import CustomerForm, {
  type CustomerFormCustomer,
} from "@/components/customers/CustomerForm";
import { usePhone } from "@/components/PhoneClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/components/pulse/format";
import type {
  Customer,
  CustomerSubscription,
  Estimate,
  Invoice,
  Message,
} from "@/lib/db";
import type { JobStatus } from "@/lib/jobs";

type CustomerJobRow = {
  id: number;
  scheduled_at: string;
  description: string | null;
  lead_source: string | null;
  employees: string | null;
  price_cents: number;
  paid_total_cents: number;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  job_status: JobStatus;
};

type DetailResponse = {
  customer: Customer;
  stats: {
    jobs_count: number;
    lifetime_revenue_cents: number;
    avg_job_cents: number;
    last_service_at: string | null;
    outstanding_cents: number;
  };
  jobs: CustomerJobRow[];
  estimates: Estimate[];
  invoices: Invoice[];
  subscriptions: CustomerSubscription[];
  last_message: Message | null;
  unread_message_count: number;
};

type ActivityItem = {
  id: string;
  ts: string;
  kind: "job" | "message" | "invoice" | "estimate" | "subscription";
  title: string;
  detail: string | null;
  href: string | null;
};

function fullName(c: { first_name: string | null; last_name: string | null; name?: string }) {
  const composed = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return composed || c.name || "";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  })}, ${d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(" ", " ")}`;
}

function formatPhone(p: string | null) {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length === 10)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
}

function jobStatusBadge(status: JobStatus) {
  switch (status) {
    case "completed_paid":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
          Paid
        </Badge>
      );
    case "completed_partial":
      return (
        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
          Partial
        </Badge>
      );
    case "completed_unpaid":
      return (
        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30">
          Unpaid
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30">
          In&nbsp;progress
        </Badge>
      );
    case "scheduled":
    default:
      return (
        <Badge className="bg-zinc-500/15 text-zinc-300 border-zinc-500/30">
          Scheduled
        </Badge>
      );
  }
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    sent: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    pending: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    overdue: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    declined: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    canceled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    void: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    draft: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  };
  const cls = map[s] || "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  return <Badge className={cls}>{status}</Badge>;
}

export default function CustomerDetailClient({
  initialCustomer,
}: {
  initialCustomer: Customer;
}) {
  const router = useRouter();
  const phone = usePhone();
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [chargingId, setChargingId] = useState<number | null>(null);

  async function load() {
    const res = await fetch(`/api/customers/${customer.id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = (await res.json()) as DetailResponse;
    setData(json);
    setCustomer(json.customer);
    setLoading(false);
  }

  // Manually run a subscription's recurring charge now (vs. waiting for the
  // daily auto-biller). Shares the exact billing path, so it's idempotent.
  async function chargeSubscriptionNow(subId: number) {
    if (chargingId) return;
    setChargingId(subId);
    try {
      const res = await fetch(`/api/customer-subscriptions/${subId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(j.error || "Charge failed");
      }
      await load();
    } finally {
      setChargingId(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = fullName(customer);
  const address =
    (customer.formatted_address || "").trim() ||
    [
      customer.address_line1,
      customer.unit ? `#${customer.unit}` : null,
      [customer.city, customer.state].filter(Boolean).join(", "),
      customer.zip,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer.address ||
    "";

  const activity: ActivityItem[] = useMemo(() => {
    if (!data) return [];
    const items: ActivityItem[] = [];
    for (const j of data.jobs) {
      items.push({
        id: `job-${j.id}`,
        ts: j.completed_at || j.scheduled_at,
        kind: "job",
        title: j.description || "Job",
        detail: `${formatCents(j.price_cents)} · ${
          j.completed_at ? "completed" : "scheduled"
        }`,
        href: `/schedule/${j.id}`,
      });
    }
    for (const i of data.invoices) {
      items.push({
        id: `inv-${i.id}`,
        ts: i.created_at,
        kind: "invoice",
        title: i.title || `Invoice #${i.id}`,
        detail: `${formatCents(i.total_cents)} · ${i.status}`,
        href: `/invoices/${i.id}`,
      });
    }
    for (const e of data.estimates) {
      items.push({
        id: `est-${e.id}`,
        ts: e.created_at,
        kind: "estimate",
        title: e.title || `Estimate #${e.id}`,
        detail: `${formatCents(e.total_cents)} · ${e.status}`,
        href: `/estimates/${e.id}`,
      });
    }
    for (const s of data.subscriptions) {
      items.push({
        id: `sub-${s.id}`,
        ts: s.created_at,
        kind: "subscription",
        title: s.name,
        detail: `${formatCents(s.price_cents)} · ${s.interval} · ${s.status}`,
        href: null,
      });
    }
    if (data.last_message) {
      const m = data.last_message;
      items.push({
        id: `msg-${m.id}`,
        ts: m.created_at,
        kind: "message",
        title: m.direction === "inbound" ? "Message received" : "Message sent",
        detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
        href: `/messages?customer=${customer.id}`,
      });
    }
    return items.sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
  }, [data, customer.id]);

  return (
    <div className="-m-6">
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] min-h-[calc(100vh-64px)]">
        <aside className="border-b lg:border-b-0 lg:border-r border-line bg-canvas p-6 space-y-6 overflow-y-auto">
          <div>
            <Link
              href="/customers"
              className="inline-flex items-center text-xs font-bold text-zinc-500 hover:text-zinc-300"
            >
              ← Customers
            </Link>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-extrabold text-sm">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold tracking-tight text-white truncate">
                {name || "Customer"}
              </h1>
              <p className="text-xs text-zinc-500 mt-1 font-bold">
                Created {formatDate(customer.created_at)}
              </p>
              {customer.is_recurring ? (
                <div className="mt-2">
                  <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">
                    Recurring
                  </Badge>
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              onClick={() => setEditing(true)}
              className="h-auto text-xs font-bold border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-3 py-1.5"
            >
              Edit
            </Button>
          </div>

          <Section title="Phone">
            {customer.phone ? (
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`tel:${customer.phone}`}
                  className="text-zinc-200 font-bold hover:underline"
                >
                  {formatPhone(customer.phone)}
                </a>
                {phone.configured && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      phone.startCall({
                        customerId: customer.id,
                        customerName: name || customer.name,
                        toPhone: customer.phone || "",
                      })
                    }
                    disabled={phone.state.kind !== "idle"}
                    className="h-auto p-0 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-transparent"
                  >
                    Call
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </Section>

          <Section title="Email">
            {customer.email ? (
              <a
                href={`mailto:${customer.email}`}
                className="text-zinc-200 font-bold hover:underline break-all"
              >
                {customer.email}
              </a>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </Section>

          <Section
            title="Last Message"
            action={
              <Link
                href={`/messages?customer=${customer.id}`}
                className="text-xs font-bold text-zinc-400 hover:text-white"
              >
                Open
              </Link>
            }
          >
            {data?.last_message ? (
              <div className="flex items-start justify-between gap-2">
                <p className="text-zinc-200 text-sm leading-snug font-bold truncate">
                  {data.last_message.body}
                </p>
                <span className="text-[11px] text-zinc-500 font-bold whitespace-nowrap">
                  {formatDateTime(data.last_message.created_at)}
                </span>
              </div>
            ) : (
              <span className="text-zinc-500">No messages yet.</span>
            )}
          </Section>

          <Section title="Payment Method">
            <span className="text-zinc-500">No card on file.</span>
          </Section>

          <Section title="Address">
            {address ? (
              <p className="text-zinc-200 font-bold leading-snug">{address}</p>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </Section>

          <div className="rounded-xl border border-line overflow-hidden bg-black h-56">
            <LocationMap
              address={address}
              latitude={customer.latitude}
              longitude={customer.longitude}
            />
          </div>

          <Section title="Notes">
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
              {customer.notes?.trim() || (
                <span className="text-zinc-500 font-bold">No notes.</span>
              )}
            </p>
          </Section>
        </aside>

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                router.push(`/schedule/new?customer=${customer.id}`)
              }
              className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded px-3 py-2 font-bold"
            >
              + Job
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push(`/estimates/new?customer=${customer.id}`)}
              className="h-auto text-sm border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-3 py-2 font-bold"
            >
              + Estimate
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push(`/messages?customer=${customer.id}`)}
              className="h-auto text-sm border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-3 py-2 font-bold"
            >
              Message
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Lifetime Revenue" value={formatCents(data?.stats.lifetime_revenue_cents ?? 0)} />
            <Stat label="Jobs" value={String(data?.stats.jobs_count ?? 0)} />
            <Stat label="Avg Job" value={formatCents(data?.stats.avg_job_cents ?? 0)} />
            <Stat
              label="Outstanding"
              value={formatCents(data?.stats.outstanding_cents ?? 0)}
              tone={
                (data?.stats.outstanding_cents ?? 0) > 0 ? "warn" : "default"
              }
            />
            <Stat
              label="Last Service"
              value={
                data?.stats.last_service_at
                  ? formatDate(data.stats.last_service_at)
                  : "—"
              }
            />
          </div>

          <Tabs defaultValue="jobs" className="space-y-4">
            <TabsList>
              <TabsTrigger value="jobs">
                Jobs{data ? ` (${data.jobs.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="estimates">
                Estimates{data ? ` (${data.estimates.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices{data ? ` (${data.invoices.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="subscriptions">
                Subscriptions{data ? ` (${data.subscriptions.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="jobs">
              <Card className="overflow-hidden">
                {loading ? (
                  <Empty label="Loading…" />
                ) : !data || data.jobs.length === 0 ? (
                  <Empty label="No jobs yet." />
                ) : (
                  <Table>
                    <Th
                      cols={["Date", "Description", "Lead Source", "Employees", "Amount", "Status"]}
                    />
                    <TableBody className="divide-y divide-line">
                      {data.jobs.map((j) => (
                        <TableRow
                          key={j.id}
                          className="border-0 hover:bg-black/40 cursor-pointer"
                          onClick={() => router.push(`/schedule/${j.id}`)}
                        >
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatDate(j.scheduled_at)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {j.description || "—"}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-300 font-bold">
                            {j.lead_source || "—"}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-300 font-bold">
                            {j.employees || "—"}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatCents(j.price_cents)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {jobStatusBadge(j.job_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="estimates">
              <Card className="overflow-hidden">
                {loading ? (
                  <Empty label="Loading…" />
                ) : !data || data.estimates.length === 0 ? (
                  <Empty label="No estimates yet." />
                ) : (
                  <Table>
                    <Th cols={["Date", "Title", "Total", "Status"]} />
                    <TableBody className="divide-y divide-line">
                      {data.estimates.map((e) => (
                        <TableRow
                          key={e.id}
                          className="border-0 hover:bg-black/40 cursor-pointer"
                          onClick={() => router.push(`/estimates/${e.id}`)}
                        >
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatDate(e.created_at)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {e.title || `Estimate #${e.id}`}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatCents(e.total_cents)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {statusBadge(e.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card className="overflow-hidden">
                {loading ? (
                  <Empty label="Loading…" />
                ) : !data || data.invoices.length === 0 ? (
                  <Empty label="No invoices yet." />
                ) : (
                  <Table>
                    <Th cols={["Date", "Number", "Total", "Paid", "Status"]} />
                    <TableBody className="divide-y divide-line">
                      {data.invoices.map((i) => (
                        <TableRow
                          key={i.id}
                          className="border-0 hover:bg-black/40 cursor-pointer"
                          onClick={() => router.push(`/invoices/${i.id}`)}
                        >
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatDate(i.created_at)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {i.title || `#${i.id}`}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatCents(i.total_cents)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-300 font-bold">
                            {formatCents(i.paid_cents)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {statusBadge(i.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions">
              <Card className="overflow-hidden">
                {loading ? (
                  <Empty label="Loading…" />
                ) : !data || data.subscriptions.length === 0 ? (
                  <Empty label="No subscriptions yet." />
                ) : (
                  <Table>
                    <Th cols={["Plan", "Cadence", "Price", "Next charge", "Status", ""]} />
                    <TableBody className="divide-y divide-line">
                      {data.subscriptions.map((s) => (
                        <TableRow key={s.id} className="border-0">
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {s.name}
                            {s.status === "active" && (
                              <span
                                className={
                                  "ml-2 text-[10px] font-bold " +
                                  (s.auto_bill ? "text-emerald-400" : "text-zinc-500")
                                }
                              >
                                {s.auto_bill ? "AUTO" : "MANUAL"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-300 font-bold capitalize">
                            {s.interval}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-200 font-bold">
                            {formatCents(s.price_cents)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-zinc-300 font-bold">
                            {s.status === "active" && s.next_charge_at
                              ? formatDate(s.next_charge_at)
                              : "—"}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              {statusBadge(s.status)}
                              {s.billing_status === "past_due" && (
                                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-400">
                                  Past due
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right">
                            {s.status === "active" && (
                              <Button
                                variant="ghost"
                                onClick={() => chargeSubscriptionNow(s.id)}
                                disabled={chargingId === s.id}
                                className="h-auto text-xs border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-2 py-1 font-bold disabled:opacity-50"
                              >
                                {chargingId === s.id ? "Charging…" : "Charge now"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card className="overflow-hidden">
                {loading ? (
                  <Empty label="Loading…" />
                ) : activity.length === 0 ? (
                  <Empty label="No activity yet." />
                ) : (
                  <ul className="divide-y divide-line">
                    {activity.map((a) => {
                      const inner = (
                        <div className="flex items-start gap-4 px-4 py-3">
                          <span className="text-xs font-bold text-zinc-500 w-20 pt-0.5">
                            {a.kind}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-200 font-bold truncate">
                              {a.title}
                            </p>
                            {a.detail && (
                              <p className="text-zinc-400 text-sm truncate">
                                {a.detail}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 font-bold whitespace-nowrap pt-0.5">
                            {formatDateTime(a.ts)}
                          </span>
                        </div>
                      );
                      return (
                        <li key={a.id}>
                          {a.href ? (
                            <Link
                              href={a.href}
                              className="block hover:bg-black/40"
                            >
                              {inner}
                            </Link>
                          ) : (
                            inner
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {editing && (
        <CustomerForm
          customer={customer as CustomerFormCustomer}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-500">
          {title}
        </h3>
        {action}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[14px] font-semibold text-zinc-500">
        {label}
      </p>
      <p
        className={
          "mt-2.5 text-[28px] font-extrabold tracking-tight leading-none tabular-nums " +
          (tone === "warn" ? "text-amber-300" : "text-white")
        }
      >
        {value}
      </p>
    </Card>
  );
}

function Th({ cols }: { cols: string[] }) {
  return (
    <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-line">
      <TableRow className="hover:bg-transparent">
        {cols.map((c) => (
          <TableHead
            key={c}
            className="h-auto text-left px-4 py-2 text-xs font-bold text-zinc-500"
          >
            {c}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="p-8 text-center text-sm text-zinc-400 font-bold">
      {label}
    </div>
  );
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number }
  | { status: "error"; message: string };

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPS_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${MAPS_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };
  if (data.status !== "OK" || !data.results.length) return null;
  return data.results[0].geometry.location;
}

function LocationMap({
  address,
  latitude,
  longitude,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const [geo, setGeo] = useState<GeoState>(() =>
    typeof latitude === "number" && typeof longitude === "number"
      ? { status: "ok", lat: latitude, lng: longitude }
      : { status: "idle" }
  );

  useEffect(() => {
    if (typeof latitude === "number" && typeof longitude === "number") {
      setGeo({ status: "ok", lat: latitude, lng: longitude });
      return;
    }
    if (!address) {
      setGeo({ status: "error", message: "No address on file" });
      return;
    }
    if (!MAPS_KEY) {
      setGeo({ status: "error", message: "Map not configured" });
      return;
    }
    let cancelled = false;
    setGeo({ status: "loading" });
    geocodeAddress(address)
      .then((loc) => {
        if (cancelled) return;
        if (!loc) {
          setGeo({ status: "error", message: "Address not found" });
          return;
        }
        setGeo({ status: "ok", lat: loc.lat, lng: loc.lng });
      })
      .catch(() => {
        if (!cancelled)
          setGeo({ status: "error", message: "Address not found" });
      });
    return () => {
      cancelled = true;
    };
  }, [address, latitude, longitude]);

  if (geo.status === "ok") {
    return (
      <APIProvider apiKey={MAPS_KEY}>
        <Map
          defaultCenter={{ lat: geo.lat, lng: geo.lng }}
          defaultZoom={19}
          mapTypeId="satellite"
          gestureHandling="greedy"
          mapTypeControl
          streetViewControl
          fullscreenControl
          zoomControl
          style={{ width: "100%", height: "100%" }}
        >
          <Marker position={{ lat: geo.lat, lng: geo.lng }} />
        </Map>
      </APIProvider>
    );
  }
  return (
    <div className="h-full flex items-center justify-center text-sm text-zinc-500 font-bold px-4 text-center">
      {geo.status === "loading" ? "Looking up address…" : geo.status === "error" ? geo.message : "—"}
    </div>
  );
}
