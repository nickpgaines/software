"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import PayrollSettingsModal, {
  type PayrollSettingsValue,
} from "./PayrollSettingsModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tab = "overview" | "sales" | "jobs" | "subscriptions" | "map" | "employees" | "payroll";
type Range = "1w" | "1m" | "3m" | "1y";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "jobs", label: "Jobs" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "map", label: "Map" },
  { key: "employees", label: "Employees" },
  { key: "payroll", label: "Payroll" },
];

const RANGES: { key: Range; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function ReportsClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<Range>("1m");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-[#1f1f24]">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Button
                key={t.key}
                variant="ghost"
                onClick={() => setTab(t.key)}
                className={
                  "h-auto rounded-none whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-bold hover:bg-transparent " +
                  (active
                    ? "border-slate-900 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-300")
                }
              >
                {t.label}
              </Button>
            );
          })}
        </nav>
        {tab !== "subscriptions" && tab !== "employees" && (
          <RangePills range={range} setRange={setRange} />
        )}
      </div>

      {tab === "overview" && <OverviewPanel range={range} />}
      {tab === "sales" && <SalesPanel range={range} />}
      {tab === "jobs" && <JobsPanel range={range} />}
      {tab === "subscriptions" && <SubscriptionsPanel />}
      {tab === "map" && <MapPanel range={range} />}
      {tab === "employees" && <EmployeesPanel />}
      {tab === "payroll" && <PayrollPanel range={range} />}
    </div>
  );
}

function RangePills({
  range,
  setRange,
}: {
  range: Range;
  setRange: (r: Range) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-black rounded-full p-1 text-sm mb-3">
      {RANGES.map((r) => (
        <Button
          key={r.key}
          variant="ghost"
          onClick={() => setRange(r.key)}
          className={
            "h-auto px-3 py-1 rounded-full whitespace-nowrap font-bold hover:bg-transparent " +
            (range === r.key
              ? "bg-[#0f0f12] text-white shadow-sm"
              : "text-zinc-400 hover:text-white")
          }
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

type JobBucket = {
  count: number;
  expected_cents: number;
  collected_cents: number;
  avg_value_cents: number;
};

type Overview = {
  revenue: {
    total_cents: number;
    collected_cents: number;
    unpaid_cents: number;
    collection_rate: number;
  };
  jobs: {
    total: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    avg_value_cents: number;
    service_plan: JobBucket;
    one_off: JobBucket;
  };
  customers: { total: number; new: number; repeat: number };
  subscriptions: {
    active: number;
    new: number;
    canceled: number;
    mrr_cents: number;
    arr_cents: number;
    arr_added_cents: number;
  };
};

function OverviewPanel({ range }: { range: Range }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/overview?range=${range}`)
      .then((r) => r.json())
      .then((d: Overview) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Section title="Revenue">
        <Stats
          items={[
            { label: "Total Revenue", value: money(data.revenue.total_cents) },
            { label: "Collected", value: money(data.revenue.collected_cents) },
            { label: "Unpaid", value: money(data.revenue.unpaid_cents) },
            { label: "Collection Rate", value: pct(data.revenue.collection_rate) },
          ]}
        />
      </Section>

      <Section title="Jobs">
        <Stats
          items={[
            { label: "Total Jobs", value: String(data.jobs.total) },
            { label: "Scheduled", value: String(data.jobs.scheduled) },
            { label: "Completed", value: String(data.jobs.completed) },
            { label: "Canceled", value: String(data.jobs.cancelled) },
            { label: "Avg Job Value", value: money(data.jobs.avg_value_cents) },
          ]}
        />
      </Section>

      <Section title="Customers">
        <Stats
          items={[
            { label: "Total Customers", value: String(data.customers.total) },
            { label: "New Customers", value: String(data.customers.new) },
            { label: "Repeat Customers", value: String(data.customers.repeat) },
          ]}
        />
      </Section>

      <Section title="Subscriptions">
        <Stats
          items={[
            {
              label: "Active Subscriptions",
              value: String(data.subscriptions.active),
            },
            {
              label: "New Subscriptions",
              value: String(data.subscriptions.new),
            },
            {
              label: "Canceled",
              value: String(data.subscriptions.canceled),
            },
            { label: "Total MRR", value: money(data.subscriptions.mrr_cents) },
            { label: "Total ARR", value: money(data.subscriptions.arr_cents) },
          ]}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl px-5 py-4">
            <div className="text-eyebrow uppercase text-zinc-500 mb-1.5">ARR Added</div>
            <div className="text-[26px] font-black tracking-tight leading-none tabular-nums text-white">
              {money(data.subscriptions.arr_added_cents)}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

type Sales = {
  doors: { total: number; sales: number; conversion_rate: number };
  reps: {
    id: number;
    name: string;
    doors_knocked: number;
    sales: number;
    conversion_rate: number;
    revenue_cents: number;
  }[];
};

function SalesPanel({ range }: { range: Range }) {
  const [data, setData] = useState<Sales | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/sales?range=${range}`)
      .then((r) => r.json())
      .then((d: Sales) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Section title="Door knocking">
        <Stats
          items={[
            { label: "Total Doors Knocked", value: String(data.doors.total) },
            { label: "Sales Made", value: String(data.doors.sales) },
            { label: "Conversion Rate", value: pct(data.doors.conversion_rate) },
          ]}
        />
      </Section>

      <Section title="Top reps">
        <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
          {data.reps.length === 0 ? (
            <p className="p-8 text-sm text-zinc-500 text-center">
              No rep activity in this window.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent text-eyebrow uppercase text-zinc-500">
                  <TableHead className="h-auto text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Rep</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Doors</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Sales</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Conv.</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reps.map((r) => (
                  <TableRow key={r.id} className="border-t border-b-0 border-[#1f1f24] hover:bg-transparent">
                    <TableCell className="px-5 py-3 font-bold text-white tracking-tight">
                      {r.name}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                      {r.doors_knocked}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                      {r.sales}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                      {pct(r.conversion_rate)}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-right font-extrabold text-white tracking-tight tabular-nums">
                      {money(r.revenue_cents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Section>
    </div>
  );
}

type SubscriptionsReport = {
  filters: {
    customers: { id: number; name: string }[];
    templates: { id: number; name: string; active: boolean }[];
    sold_by: { id: number; name: string }[];
  };
  options: {
    include_tax: boolean;
    include_paid_cancellations: boolean;
  };
  totals: {
    total: number;
    active: number;
    pending: number;
    canceled: number;
    declined: number;
  };
  revenue: { mrr_cents: number; arr_cents: number };
  monthly: { label: string; iso: string; mrr_cents: number }[];
  arr_added: {
    label: string;
    iso: string;
    arr_cents: number;
    count: number;
  }[];
  breakdowns: {
    by_template: {
      template_id: number | null;
      name: string;
      count: number;
      mrr_cents: number;
    }[];
    by_sold_by: {
      sold_by_id: number;
      name: string;
      count: number;
      mrr_cents: number;
    }[];
  };
};

function SubscriptionsPanel() {
  const [data, setData] = useState<SubscriptionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [soldById, setSoldById] = useState<string>("");
  const [includeTax, setIncludeTax] = useState(true);
  const [includeCanceled, setIncludeCanceled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (customerId) params.set("customers", customerId);
    if (templateId) params.set("templates", templateId);
    if (soldById) params.set("sold_by", soldById);
    if (!includeTax) params.set("include_tax", "0");
    if (!includeCanceled) params.set("include_paid_cancellations", "0");
    const qs = params.toString();
    fetch(`/api/reports/subscriptions${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d: SubscriptionsReport) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, templateId, soldById, includeTax, includeCanceled]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
    );
  if (!data) return null;

  const monthlyMax = Math.max(1, ...data.monthly.map((m) => m.mrr_cents));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectFilter
          label="Customers"
          value={customerId}
          onChange={setCustomerId}
          options={data.filters.customers}
        />
        <SelectFilter
          label="Templates"
          value={templateId}
          onChange={setTemplateId}
          options={data.filters.templates.map((t) => ({
            id: t.id,
            name: t.active ? t.name : `${t.name} (inactive)`,
          }))}
        />
        <SelectFilter
          label="Sold By"
          value={soldById}
          onChange={setSoldById}
          options={data.filters.sold_by}
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-zinc-500">
          Statistics
        </h2>
        <div className="flex items-center gap-6">
          <Toggle
            label="Include Taxes"
            checked={includeTax}
            onChange={setIncludeTax}
          />
          <Toggle
            label="Include Paid Cancellations"
            checked={includeCanceled}
            onChange={setIncludeCanceled}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 grid-cols-2 lg:col-span-2">
          <StatCard label="Total Subscriptions" value={String(data.totals.total)} />
          <StatCard
            label="Active Subscriptions"
            value={String(data.totals.active)}
            valueClassName="text-emerald-600"
          />
          <StatCard
            label={`Current MRR${includeTax ? " (w/ tax)" : ""}`}
            value={money(data.revenue.mrr_cents)}
          />
          <StatCard
            label={`Current ARR${includeTax ? " (w/ tax)" : ""}`}
            value={money(data.revenue.arr_cents)}
          />
        </div>

        <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl p-5 shadow-sm">
          <div className="text-sm font-extrabold text-white tracking-tight">
            Monthly Recurring Revenue
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {data.monthly[0]?.iso} – {data.monthly[data.monthly.length - 1]?.iso}
          </div>
          <div className="mt-4 flex items-end gap-2 h-40">
            {data.monthly.map((m) => {
              const h = Math.max(2, Math.round((m.mrr_cents / monthlyMax) * 100));
              return (
                <div
                  key={m.iso}
                  className="flex-1 flex flex-col items-center justify-end gap-1"
                >
                  <div className="text-[10px] text-zinc-400 tabular-nums">
                    {m.mrr_cents > 0 ? money(m.mrr_cents) : "—"}
                  </div>
                  <div
                    className="w-full bg-amber-400 rounded-sm"
                    style={{ height: `${h}%` }}
                  />
                  <div className="text-[10px] text-zinc-400">{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard label="Pending" value={String(data.totals.pending)} compact />
        <StatCard label="Canceled" value={String(data.totals.canceled)} compact />
        <StatCard label="Declined" value={String(data.totals.declined)} compact />
      </div>

      <Section title="ARR added over time">
        <ArrAddedChart points={data.arr_added} includeTax={includeTax} />
      </Section>

      <Section title="By template">
        <BreakdownTable
          header="Template"
          rows={data.breakdowns.by_template.map((t) => ({
            key: `${t.template_id ?? "none"}-${t.name}`,
            name: t.name,
            count: t.count,
            mrr_cents: t.mrr_cents,
          }))}
        />
      </Section>

      <Section title="By salesperson">
        <BreakdownTable
          header="Sold By"
          rows={data.breakdowns.by_sold_by.map((s) => ({
            key: String(s.sold_by_id),
            name: s.name,
            count: s.count,
            mrr_cents: s.mrr_cents,
          }))}
        />
      </Section>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: number; name: string }[];
}) {
  return (
    <Label className="block font-normal">
      <span className="text-eyebrow uppercase text-zinc-500">{label}</span>
      {/* Native <select> kept: Radix Select forbids empty-string item values, which breaks the "All" clear-filter sentinel. Flagged for follow-up. */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-xl border border-[#1f1f24] bg-[#0f0f12] px-3 py-2 text-sm text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2a2a32]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold cursor-pointer">
      <span>{label}</span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChange(!checked)}
        className={
          "relative h-5 w-9 p-0 rounded-full justify-start hover:bg-current " +
          (checked ? "bg-emerald-500 hover:bg-emerald-500" : "bg-[#2a2a32] hover:bg-[#2a2a32]")
        }
        aria-pressed={checked}
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-[#0f0f12] shadow transition " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </Button>
    </Label>
  );
}

function StatCard({
  label,
  value,
  valueClassName,
  compact,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        "bg-[#0f0f12] border border-[#1f1f24] rounded-2xl " +
        (compact ? "px-4 py-3" : "px-5 py-4")
      }
    >
      <div className="text-eyebrow uppercase text-zinc-500 mb-1.5">
        {label}
      </div>
      <div
        className={
          (compact ? "text-[22px]" : "text-[26px]") +
          " font-black tracking-tight leading-none tabular-nums " +
          (valueClassName || "text-white")
        }
      >
        {value}
      </div>
    </div>
  );
}

function BreakdownTable({
  header,
  rows,
}: {
  header: string;
  rows: { key: string; name: string; count: number; mrr_cents: number }[];
}) {
  return (
    <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
      {rows.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500 text-center">
          No subscriptions yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent text-eyebrow uppercase text-zinc-500 bg-black">
              <TableHead className="h-auto text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">{header}</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Count</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">MRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="border-t border-b-0 border-[#1f1f24] hover:bg-transparent">
                <TableCell className="px-5 py-3 font-bold text-white tracking-tight">
                  {r.name}
                </TableCell>
                <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                  {r.count}
                </TableCell>
                <TableCell className="px-5 py-3 text-right font-extrabold text-white tracking-tight tabular-nums">
                  {money(r.mrr_cents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ArrAddedChart({
  points,
  includeTax,
}: {
  points: SubscriptionsReport["arr_added"];
  includeTax: boolean;
}) {
  const max = Math.max(1, ...points.map((p) => p.arr_cents));
  const total = points.reduce((sum, p) => sum + p.arr_cents, 0);
  const totalCount = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-extrabold text-white tracking-tight">
            New ARR per month{includeTax ? " (w/ tax)" : ""}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 font-bold">
            {points[0]?.iso} – {points[points.length - 1]?.iso}
          </div>
        </div>
        <div className="text-right">
          <div className="text-eyebrow uppercase text-zinc-500">
            Total added ({totalCount} subs)
          </div>
          <div className="text-xl font-black text-white tracking-tight tabular-nums mt-1">
            {money(total)}
          </div>
        </div>
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-10 font-bold">
          No subscription activity yet.
        </p>
      ) : (
        <div className="mt-4 flex items-end gap-2 h-48">
          {points.map((p) => {
            const h = Math.max(2, Math.round((p.arr_cents / max) * 100));
            return (
              <div
                key={p.iso}
                className="flex-1 flex flex-col items-center justify-end gap-1"
                title={`${p.iso}: ${money(p.arr_cents)} from ${p.count} sub${
                  p.count === 1 ? "" : "s"
                }`}
              >
                <div className="text-[10px] text-zinc-500 tabular-nums font-bold">
                  {p.arr_cents > 0 ? money(p.arr_cents) : "—"}
                </div>
                <div
                  className="w-full bg-emerald-500 rounded-sm"
                  style={{ height: `${h}%` }}
                />
                <div className="text-[10px] text-zinc-500 font-bold">{p.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stats({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="text-eyebrow uppercase text-zinc-500 mb-1.5">
              {it.label}
            </div>
            <div className="text-[26px] font-black tracking-tight leading-none tabular-nums text-white">
              {it.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type EmployeeSalesRow = {
  id: number;
  name: string;
  email: string | null;
  days_active: number;
  months_active: number;
  lifetime_revenue_cents: number;
  avg_monthly_revenue_cents: number;
  avg_daily_revenue_cents: number;
};

type EmployeeTechRow = EmployeeSalesRow & {
  minutes_worked: number;
  avg_dollar_per_hour_cents: number;
};

type EmployeesReport = {
  sales: EmployeeSalesRow[];
  tech: EmployeeTechRow[];
  aggregates: {
    sales_avg_monthly_cents: number;
    sales_avg_lifetime_cents: number;
    sales_avg_daily_cents: number;
    tech_avg_monthly_cents: number;
    tech_avg_daily_cents: number;
    tech_avg_per_hour_cents: number;
  };
};

function EmployeesPanel() {
  const [data, setData] = useState<EmployeesReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/employees`)
      .then((r) => r.json())
      .then((d: EmployeesReport) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center font-bold">Loading…</p>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Section title="Sales reps · averages across team">
        <Stats
          items={[
            {
              label: "Avg Monthly Revenue / Rep",
              value: money(data.aggregates.sales_avg_monthly_cents),
            },
            {
              label: "Avg Lifetime Value / Rep",
              value: money(data.aggregates.sales_avg_lifetime_cents),
            },
            {
              label: "Avg Daily Revenue / Rep",
              value: money(data.aggregates.sales_avg_daily_cents),
            },
          ]}
        />
        <EmployeeTable
          rows={data.sales}
          variant="sales"
          emptyText="No sales reps with attributed revenue yet."
        />
      </Section>

      <Section title="Technicians · averages across team">
        <Stats
          items={[
            {
              label: "Avg Monthly Revenue / Tech",
              value: money(data.aggregates.tech_avg_monthly_cents),
            },
            {
              label: "Avg Daily Revenue / Tech",
              value: money(data.aggregates.tech_avg_daily_cents),
            },
            {
              label: "Avg $ / Hour Cleaned",
              value: money(data.aggregates.tech_avg_per_hour_cents),
            },
          ]}
        />
        <EmployeeTable
          rows={data.tech}
          variant="tech"
          emptyText="No technicians with attributed revenue yet."
        />
      </Section>
    </div>
  );
}

function EmployeeTable({
  rows,
  variant,
  emptyText,
}: {
  rows: (EmployeeSalesRow | EmployeeTechRow)[];
  variant: "sales" | "tech";
  emptyText: string;
}) {
  return (
    <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl overflow-hidden">
      {rows.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500 text-center font-bold">{emptyText}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent bg-black">
              <TableHead className="h-auto text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Employee</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Tenure</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Lifetime</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Monthly</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Daily</TableHead>
              {variant === "tech" && (
                <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">$/hr</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="border-t border-b-0 border-[#1f1f24] hover:bg-transparent">
                <TableCell className="px-5 py-3">
                  <div className="font-bold text-white tracking-tight">{r.name}</div>
                  {r.email && (
                    <div className="text-xs text-zinc-500 font-bold">{r.email}</div>
                  )}
                </TableCell>
                <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                  {Math.round(r.days_active)} d
                </TableCell>
                <TableCell className="px-5 py-3 text-right font-extrabold text-white tracking-tight tabular-nums">
                  {money(r.lifetime_revenue_cents)}
                </TableCell>
                <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                  {money(r.avg_monthly_revenue_cents)}
                </TableCell>
                <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                  {money(r.avg_daily_revenue_cents)}
                </TableCell>
                {variant === "tech" && (
                  <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                    {money((r as EmployeeTechRow).avg_dollar_per_hour_cents)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

type PayrollRow = {
  id: number;
  name: string;
  email: string | null;
  role: string;
  rate: number;
  total_cents: number;
  tips_cents: number;
  bonus_cents?: number;
  payout_cents: number;
  paid: boolean;
};

type PayrollData = {
  range: Range;
  period: { start: string; end: string };
  sales: PayrollRow[];
  tech: PayrollRow[];
  summary: {
    total_revenue_cents: number;
    sales_commission_cents: number;
    tech_commission_cents: number;
    tips_cents: number;
    plan_sale_bonus_cents?: number;
    total_payout_cents: number;
    net_profit_cents: number;
    total_tips_collected_cents: number;
  };
  settings: PayrollSettingsValue | null;
};

function PayrollPanel({ range }: { range: Range }) {
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/payroll?range=${range}`)
      .then((r) => r.json())
      .then((d: PayrollData) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  async function updateRate(staffId: number, role: "sales" | "tech", rate: number) {
    await fetch(`/api/reports/payroll/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, role, rate }),
    });
    setReloadKey((k) => k + 1);
  }

  async function togglePaid(
    staffId: number,
    role: "sales" | "tech",
    paid: boolean
  ) {
    await fetch(`/api/reports/payroll/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, role, paid, range }),
    });
    setReloadKey((k) => k + 1);
  }

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
    );
  if (!data) return null;

  const salesTiered = data.settings?.sales_commission_mode === "tiers";
  const techTiered = data.settings?.tech_commission_mode === "tiers";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">Payroll</h2>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Calculate commissions for sales and technician teams.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          className="h-auto gap-2 px-3 py-2 text-eyebrow uppercase text-zinc-500 bg-[#0f0f12] border border-[#1f1f24] rounded-full hover:bg-black shadow-sm"
          aria-label="Payroll settings"
        >
          <Settings className="w-4 h-4" />
          <span>Payroll settings</span>
        </Button>
      </div>

      <PayrollTable
        title="Sales Payroll"
        rows={data.sales}
        showTips={false}
        showBonus={!!data.summary.plan_sale_bonus_cents}
        rateEditable={!salesTiered}
        rateLabel={salesTiered ? "Effective" : "Rate"}
        onRateChange={(id, rate) => updateRate(id, "sales", rate)}
        onPaidToggle={(id, paid) => togglePaid(id, "sales", paid)}
      />

      <PayrollTable
        title="Technician Payroll"
        rows={data.tech}
        showTips
        showBonus={false}
        rateEditable={!techTiered}
        rateLabel={techTiered ? "Effective" : "Rate"}
        onRateChange={(id, rate) => updateRate(id, "tech", rate)}
        onPaidToggle={(id, paid) => togglePaid(id, "tech", paid)}
      />

      <PayrollSummary summary={data.summary} />

      {data.settings && (
        <PayrollSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          initial={data.settings}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function PayrollTable({
  title,
  rows,
  showTips,
  showBonus,
  rateEditable,
  rateLabel,
  onRateChange,
  onPaidToggle,
}: {
  title: string;
  rows: PayrollRow[];
  showTips: boolean;
  showBonus: boolean;
  rateEditable: boolean;
  rateLabel: string;
  onRateChange: (staffId: number, rate: number) => void;
  onPaidToggle: (staffId: number, paid: boolean) => void;
}) {
  return (
    <Section title={title}>
      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-sm text-zinc-500 text-center">
            No employees yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent text-eyebrow uppercase text-zinc-500 bg-black">
                <TableHead className="h-auto text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Employee</TableHead>
                <TableHead className="h-auto text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Email</TableHead>
                <TableHead className="h-auto text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Role</TableHead>
                <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">{rateLabel}</TableHead>
                <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Total</TableHead>
                {showTips && (
                  <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Tips</TableHead>
                )}
                {showBonus && (
                  <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Bonus</TableHead>
                )}
                <TableHead className="h-auto text-right px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Payout</TableHead>
                <TableHead className="h-auto text-center px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <PayrollRowView
                  key={r.id}
                  row={r}
                  showTips={showTips}
                  showBonus={showBonus}
                  rateEditable={rateEditable}
                  onRateChange={(rate) => onRateChange(r.id, rate)}
                  onPaidToggle={(paid) => onPaidToggle(r.id, paid)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Section>
  );
}

function PayrollRowView({
  row,
  showTips,
  showBonus,
  rateEditable,
  onRateChange,
  onPaidToggle,
}: {
  row: PayrollRow;
  showTips: boolean;
  showBonus: boolean;
  rateEditable: boolean;
  onRateChange: (rate: number) => void;
  onPaidToggle: (paid: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((row.rate * 100).toFixed(1));

  useEffect(() => {
    setDraft((row.rate * 100).toFixed(1));
  }, [row.rate]);

  function commit() {
    setEditing(false);
    const pct = parseFloat(draft);
    if (!Number.isFinite(pct)) return;
    const rate = Math.max(0, Math.min(1, pct / 100));
    if (Math.abs(rate - row.rate) > 1e-6) onRateChange(rate);
  }

  return (
    <TableRow className="border-t border-b-0 border-[#1f1f24] hover:bg-transparent">
      <TableCell className="px-5 py-3 font-bold text-white tracking-tight">{row.name}</TableCell>
      <TableCell className="px-5 py-3 text-zinc-400">{row.email || "—"}</TableCell>
      <TableCell className="px-5 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold capitalize">
          {row.role.replace(/_/g, " ")}
        </span>
      </TableCell>
      <TableCell className="px-5 py-3 text-right tabular-nums">
        {rateEditable ? (
          editing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft((row.rate * 100).toFixed(1));
                  setEditing(false);
                }
              }}
              className="w-20 h-auto text-right border-[#2a2a32] rounded px-2 py-1"
            />
          ) : (
            <Button
              variant="ghost"
              onClick={() => setEditing(true)}
              className="h-auto p-0 text-zinc-300 hover:bg-transparent hover:text-white hover:underline font-bold"
            >
              {(row.rate * 100).toFixed(1)}%
            </Button>
          )
        ) : (
          <span className="text-zinc-300">
            {(row.rate * 100).toFixed(1)}%
          </span>
        )}
      </TableCell>
      <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
        {money(row.total_cents)}
      </TableCell>
      {showTips && (
        <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
          {money(row.tips_cents)}
        </TableCell>
      )}
      {showBonus && (
        <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
          {money(row.bonus_cents || 0)}
        </TableCell>
      )}
      <TableCell className="px-5 py-3 text-right font-extrabold text-white tracking-tight tabular-nums">
        {money(row.payout_cents)}
      </TableCell>
      <TableCell className="px-5 py-3 text-center">
        <Checkbox
          checked={row.paid}
          onCheckedChange={(checked) => onPaidToggle(checked === true)}
          className="cursor-pointer"
        />
      </TableCell>
    </TableRow>
  );
}

function PayrollSummary({
  summary,
}: {
  summary: PayrollData["summary"];
}) {
  const items: { label: string; value: string; emphasis?: boolean }[] = [
    { label: "Total Revenue", value: money(summary.total_revenue_cents) },
    { label: "Sales Commission", value: money(summary.sales_commission_cents) },
    {
      label: "Technician Commission",
      value: money(summary.tech_commission_cents),
    },
    { label: "Tips", value: money(summary.tips_cents) },
  ];
  if ((summary.plan_sale_bonus_cents || 0) > 0) {
    items.push({
      label: "Plan Sale Bonuses",
      value: money(summary.plan_sale_bonus_cents || 0),
    });
  }
  items.push(
    {
      label: "Total Payout (Commissions + Tips + Bonuses)",
      value: money(summary.total_payout_cents),
    },
    {
      label: "Net Profit",
      value: money(summary.net_profit_cents),
      emphasis: true,
    }
  );
  return (
    <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm divide-y divide-[#1f1f24]">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between px-5 py-3"
        >
          <span
            className={
              "text-sm " +
              (it.emphasis
                ? "font-extrabold text-white tracking-tight"
                : "text-zinc-400")
            }
          >
            {it.label}
          </span>
          <span
            className={
              "tabular-nums " +
              (it.emphasis
                ? "text-lg font-bold text-white"
                : "font-extrabold text-white tracking-tight")
            }
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

type JobsReport = {
  range: Range;
  start: string;
  end: string;
  service_plan: JobBucket;
  one_off: JobBucket;
  all: JobBucket;
};

function JobsPanel({ range }: { range: Range }) {
  const [data, setData] = useState<JobsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/jobs?range=${range}`)
      .then((r) => r.json())
      .then((d: JobsReport) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center font-bold">Loading…</p>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Section title="All jobs">
        <Stats
          items={[
            { label: "Jobs", value: String(data.all.count) },
            {
              label: "Expected Revenue",
              value: money(data.all.expected_cents),
            },
            {
              label: "Collected Revenue",
              value: money(data.all.collected_cents),
            },
            {
              label: "Average Job Value",
              value: money(data.all.avg_value_cents),
            },
          ]}
        />
      </Section>
    </div>
  );
}

type MapReport = {
  range: Range;
  start: string;
  end: string;
  days: number;
  pins: {
    total: number;
    sales: number;
    quotes: number;
    not_home: number;
    answered: number;
    conversion_rate: number;
    close_rate: number;
    quote_rate: number;
    answer_rate: number;
    avg_per_day: number;
  };
  objections: {
    pins_with_objections: number;
    breakdown: { name: string; count: number; pct: number }[];
  };
};

function MapPanel({ range }: { range: Range }) {
  const [data, setData] = useState<MapReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/map?range=${range}`)
      .then((r) => r.json())
      .then((d: MapReport) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center font-bold">Loading…</p>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Section title="Pins added">
        <Stats
          items={[
            { label: "Pins Added", value: String(data.pins.total) },
            { label: "Sales Won", value: String(data.pins.sales) },
            { label: "Conversion Rate", value: pct(data.pins.conversion_rate) },
            { label: "Close Rate", value: pct(data.pins.close_rate) },
            {
              label: "Avg Pins / Day",
              value: data.pins.avg_per_day.toFixed(1),
            },
            { label: "Pins with Quotes", value: String(data.pins.quotes) },
            { label: "Quote Rate", value: pct(data.pins.quote_rate) },
            { label: "Answer Rate", value: pct(data.pins.answer_rate) },
          ]}
        />
      </Section>

      <Section title="Objections breakdown">
        <ObjectionsBreakdown objections={data.objections} />
      </Section>
    </div>
  );
}

function ObjectionsBreakdown({
  objections,
}: {
  objections: MapReport["objections"];
}) {
  return (
    <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl overflow-hidden">
      {objections.breakdown.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500 text-center font-bold">
          No objections recorded in this window.
        </p>
      ) : (
        <div className="divide-y divide-[#1f1f24]">
          <div className="px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500 bg-black flex items-center justify-between">
            <span>
              Objection ({objections.pins_with_objections} pin
              {objections.pins_with_objections === 1 ? "" : "s"} with objections)
            </span>
            <span>Share</span>
          </div>
          {objections.breakdown.map((o) => (
            <div key={o.name} className="px-5 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-white tracking-tight">{o.name}</span>
                <span className="text-zinc-300 font-bold tabular-nums">
                  {o.count} · {pct(o.pct)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-[#1f1f24] overflow-hidden">
                <div
                  className="h-full bg-rose-500"
                  style={{
                    width: `${Math.max(2, Math.round(o.pct * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
