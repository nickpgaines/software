"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
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

function DonutChart({
  segments,
  total,
}: {
  segments: { name: string; value: number; color: string }[];
  total: number;
}) {
  const formatted = `$${(total / 100).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={2}
            stroke="#0f0f12"
            strokeWidth={2}
          >
            {segments.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <RTooltip
            contentStyle={{
              background: "#0f0f12",
              border: "1px solid #1f1f24",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
            }}
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return `$${(n / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
          Total
        </div>
        <div className="text-lg font-black text-white tabular-nums tracking-tight">
          {formatted}
        </div>
      </div>
    </div>
  );
}

function RevenueBarChart({
  data,
  color,
}: {
  data: { name: string; revenue_cents: number }[];
  color: string;
}) {
  const chartData = data.map((d) => ({
    name: d.name,
    revenue: d.revenue_cents / 100,
  }));
  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f24" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f24" }}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f24" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`
            }
            width={48}
          />
          <RTooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0f0f12",
              border: "1px solid #1f1f24",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
            }}
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return [
                `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                "Revenue",
              ];
            }}
          />
          <Bar dataKey="revenue" fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CountDonut({
  segments,
  total,
}: {
  segments: { name: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="relative w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={2}
            stroke="#0f0f12"
            strokeWidth={2}
          >
            {segments.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <RTooltip
            contentStyle={{
              background: "#0f0f12",
              border: "1px solid #1f1f24",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
            }}
            formatter={(v, name) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              const pctStr =
                total > 0 ? ` (${((n / total) * 100).toFixed(1)}%)` : "";
              return [`${n}${pctStr}`, String(name)];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
          Jobs
        </div>
        <div className="text-lg font-black text-white tabular-nums tracking-tight">
          {total}
        </div>
      </div>
    </div>
  );
}

const SOURCE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#64748b",
];

type Tab = "overview" | "sales" | "jobs" | "subscriptions" | "map" | "employees" | "payroll";
type Range = "7d" | "30d" | "90d" | "ytd" | "1y" | "custom";

export type RangeQuery = {
  range: Range;
  start?: string;
  end?: string;
};

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
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "custom", label: "Custom" },
];

export function rangeQS(q: RangeQuery): string {
  const params = new URLSearchParams();
  params.set("range", q.range);
  if (q.range === "custom" && q.start && q.end) {
    params.set("start", q.start);
    params.set("end", q.end);
  }
  return params.toString();
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function ReportsClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState<string>(thirtyDaysAgoIso());
  const [customEnd, setCustomEnd] = useState<string>(todayIso());

  const qs = rangeQS({
    range,
    start: range === "custom" ? customStart : undefined,
    end: range === "custom" ? customEnd : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
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
        <RangePills
          range={range}
          setRange={setRange}
          customStart={customStart}
          customEnd={customEnd}
          setCustomStart={setCustomStart}
          setCustomEnd={setCustomEnd}
        />
      </div>

      {tab === "overview" && <OverviewPanel qs={qs} />}
      {tab === "sales" && <SalesPanel qs={qs} />}
      {tab === "jobs" && <JobsPanel qs={qs} />}
      {tab === "subscriptions" && <SubscriptionsPanel qs={qs} />}
      {tab === "map" && <MapPanel qs={qs} />}
      {tab === "employees" && <EmployeesPanel qs={qs} />}
      {tab === "payroll" && <PayrollPanel qs={qs} range={range} customStart={customStart} customEnd={customEnd} />}
    </div>
  );
}

function RangePills({
  range,
  setRange,
  customStart,
  customEnd,
  setCustomStart,
  setCustomEnd,
}: {
  range: Range;
  setRange: (r: Range) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (s: string) => void;
  setCustomEnd: (s: string) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-2 mb-3">
      <div className="flex items-center gap-1 bg-black rounded-full p-1 text-sm">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant="ghost"
            onClick={() => setRange(r.key)}
            className={
              "h-auto px-3 py-1 rounded-full whitespace-nowrap font-bold hover:bg-transparent " +
              (range === r.key
                ? "bg-card text-white shadow-sm"
                : "text-zinc-400 hover:text-white")
            }
          >
            {r.label}
          </Button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex items-center gap-2 text-xs">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-8 w-36"
          />
          <span className="text-zinc-500">to</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-8 w-36"
          />
        </div>
      )}
    </div>
  );
}

type JobBucket = {
  count: number;
  expected_cents: number;
  collected_cents: number;
  avg_value_cents: number;
};

type RevenueBuckets = {
  one_off_cents: number;
  recurring_cents: number;
  subscription_cents: number;
  tips_cents: number;
  other_cents: number;
  total_cents: number;
};

type GeneratedRevenue = {
  one_off_cents: number;
  recurring_jobs_cents: number;
  subscriptions_booked_arr_cents: number;
  total_cents: number;
};

type Overview = {
  revenue: {
    total_cents: number;
    collected_cents: number;
    unpaid_cents: number;
    collection_rate: number;
  };
  company_revenue: {
    collected: RevenueBuckets;
    generated: GeneratedRevenue;
  };
  profit: {
    total_revenue_cents: number;
    total_payout_cents: number;
    net_profit_cents: number;
  };
  arpc: { paying_customers: number; cents: number };
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
    arr_added_gross_cents: number;
    arr_added_net_cents: number;
    arr_churned_cents: number;
  };
  top_sales?: { id: number; name: string; revenue_cents: number }[];
  top_techs?: { id: number; name: string; revenue_cents: number }[];
};

function OverviewPanel({ qs }: { qs: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arrMode, setArrMode] = useState<"net" | "gross">("net");
  const [mixMode, setMixMode] = useState<"collected" | "generated">("collected");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/reports/overview?${qs}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body || !body.company_revenue) {
          throw new Error(
            (body && (body.error || body.message)) ||
              `Overview failed (HTTP ${r.status})`,
          );
        }
        return body as Overview;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qs]);

  if (loading && !data && !error)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
    );
  if (error)
    return (
      <p className="text-sm text-red-400 py-10 text-center font-bold">
        {error}
      </p>
    );
  if (!data) return null;

  const arrAdded =
    arrMode === "net"
      ? data.subscriptions.arr_added_net_cents
      : data.subscriptions.arr_added_gross_cents;

  const collected = data.company_revenue.collected;
  const generated = data.company_revenue.generated;

  const mixSegments =
    mixMode === "collected"
      ? [
          { name: "One-off jobs", value: collected.one_off_cents, color: "#3b82f6" },
          { name: "Recurring jobs", value: collected.recurring_cents, color: "#10b981" },
          { name: "Subscriptions", value: collected.subscription_cents, color: "#f59e0b" },
          { name: "Tips", value: collected.tips_cents, color: "#a855f7" },
          { name: "Other", value: collected.other_cents, color: "#64748b" },
        ].filter((s) => s.value > 0)
      : [
          { name: "One-off jobs", value: generated.one_off_cents, color: "#3b82f6" },
          { name: "Recurring jobs", value: generated.recurring_jobs_cents, color: "#10b981" },
          {
            name: "Subscriptions (booked ARR)",
            value: generated.subscriptions_booked_arr_cents,
            color: "#f59e0b",
          },
        ].filter((s) => s.value > 0);

  const mixTotal =
    mixMode === "collected" ? collected.total_cents : generated.total_cents;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigStatCard
          label="Total Company Revenue"
          value={money(collected.total_cents)}
          sub={`Generated ${money(generated.total_cents)}`}
        />
        <BigStatCard label="MRR" value={money(data.subscriptions.mrr_cents)} sub={`ARR ${money(data.subscriptions.arr_cents)}`} />
        <BigStatCard
          label={`ARR Added (${arrMode === "net" ? "Net" : "Gross"})`}
          value={money(arrAdded)}
          sub={`Churn ${money(data.subscriptions.arr_churned_cents)}`}
          action={
            <div className="flex gap-1 text-[10px] font-extrabold">
              <button
                onClick={() => setArrMode("net")}
                className={
                  "px-2 py-0.5 rounded-full " +
                  (arrMode === "net"
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300")
                }
              >
                NET
              </button>
              <button
                onClick={() => setArrMode("gross")}
                className={
                  "px-2 py-0.5 rounded-full " +
                  (arrMode === "gross"
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300")
                }
              >
                GROSS
              </button>
            </div>
          }
        />
        <BigStatCard
          label="Net Profit"
          value={money(data.profit.net_profit_cents)}
          sub={`Payroll ${money(data.profit.total_payout_cents)}`}
        />
      </div>

      <Section title="Income Mix">
        <div className="bg-card border border-line rounded-2xl px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-eyebrow uppercase text-zinc-500">
              {mixMode === "collected" ? "Cash collected" : "Revenue generated"} —{" "}
              {money(mixTotal)}
            </div>
            <div className="flex gap-1 text-[10px] font-extrabold">
              <button
                onClick={() => setMixMode("collected")}
                className={
                  "px-2 py-0.5 rounded-full " +
                  (mixMode === "collected"
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300")
                }
              >
                COLLECTED
              </button>
              <button
                onClick={() => setMixMode("generated")}
                className={
                  "px-2 py-0.5 rounded-full " +
                  (mixMode === "generated"
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300")
                }
              >
                GENERATED
              </button>
            </div>
          </div>
          {mixSegments.length === 0 ? (
            <p className="py-10 text-sm text-zinc-500 text-center">
              No revenue in this window.
            </p>
          ) : (
            <IncomeMixDonut segments={mixSegments} total={mixTotal} />
          )}
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Avg Revenue / Customer" value={money(data.arpc.cents)} />
        <StatCard label="Paying Customers" value={String(data.arpc.paying_customers)} />
        <StatCard label="Active Subscriptions" value={String(data.subscriptions.active)} />
        <StatCard label="New Customers" value={String(data.customers.new)} />
      </div>

      <Section title="Revenue (jobs)">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border border-line rounded-2xl px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-white tracking-tight">
              Top Salespeople
            </div>
            <div className="text-eyebrow uppercase text-zinc-500">Revenue</div>
          </div>
          {(data.top_sales || []).length === 0 ? (
            <p className="py-10 text-sm text-zinc-500 text-center">
              No sales activity in this window.
            </p>
          ) : (
            <RevenueBarChart data={data.top_sales || []} color="#3b82f6" />
          )}
        </div>
        <div className="bg-card border border-line rounded-2xl px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-white tracking-tight">
              Top Technicians
            </div>
            <div className="text-eyebrow uppercase text-zinc-500">Revenue</div>
          </div>
          {(data.top_techs || []).length === 0 ? (
            <p className="py-10 text-sm text-zinc-500 text-center">
              No technician activity in this window.
            </p>
          ) : (
            <RevenueBarChart data={data.top_techs || []} color="#10b981" />
          )}
        </div>
      </div>
    </div>
  );
}

function BigStatCard({
  label,
  value,
  sub,
  action,
}: {
  label: string;
  value: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-eyebrow uppercase text-zinc-500">
          {label}
        </div>
        {action}
      </div>
      <div className="text-[26px] font-black tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-xs font-bold text-zinc-500 tabular-nums">
          {sub}
        </div>
      )}
    </div>
  );
}

function IncomeMixDonut({
  segments,
  total,
}: {
  segments: { name: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-center">
      <div className="h-[220px]">
        <DonutChart segments={segments} total={total} />
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => {
          const p = total > 0 ? s.value / total : 0;
          return (
            <div
              key={s.name}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: s.color }}
                />
                <span className="font-bold text-zinc-300 truncate">{s.name}</span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-zinc-500 font-bold">{(p * 100).toFixed(1)}%</span>
                <span className="text-white font-extrabold tracking-tight">{money(s.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Sales = {
  doors: {
    total: number;
    sales: number;
    conversion_rate: number;
    revenue_cents: number;
    revenue_per_door_cents: number;
  };
  reps: {
    id: number;
    name: string;
    doors_knocked: number;
    sales: number;
    conversion_rate: number;
    revenue_cents: number;
  }[];
};

function SalesPanel({ qs }: { qs: string }) {
  const [data, setData] = useState<Sales | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/sales?${qs}`)
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
  }, [qs]);

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
            { label: "Revenue / Door", value: money(data.doors.revenue_per_door_cents) },
            { label: "Total Sales Revenue", value: money(data.doors.revenue_cents) },
          ]}
        />
      </Section>

      <Section title="Top reps">
        <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
          {data.reps.length === 0 ? (
            <p className="p-8 text-sm text-zinc-500 text-center">
              No rep activity in this window.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent text-eyebrow uppercase text-zinc-500">
                  <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Rep</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Doors</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Sales</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Conv.</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reps.map((r) => (
                  <TableRow key={r.id} className="border-t border-b-0 border-line hover:bg-transparent">
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
  churn: {
    churned_dollars_cents: number;
    logo_churn_pct: number;
    canceled_in_range: number;
    active_at_start: number;
  };
  nrr: {
    pct: number;
    mrr_at_start_cents: number;
    retained_mrr_cents: number;
  };
  forecast: { mrr_30d_cents: number };
  cohort_retention: {
    label: string;
    iso: string;
    started: number;
    retention_30d: number;
    retention_90d: number;
    retention_180d: number;
  }[];
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

function SubscriptionsPanel({ qs: rangeQs }: { qs: string }) {
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
    const params = new URLSearchParams(rangeQs);
    if (customerId) params.set("customers", customerId);
    if (templateId) params.set("templates", templateId);
    if (soldById) params.set("sold_by", soldById);
    if (!includeTax) params.set("include_tax", "0");
    if (!includeCanceled) params.set("include_paid_cancellations", "0");
    const fullQs = params.toString();
    fetch(`/api/reports/subscriptions${fullQs ? `?${fullQs}` : ""}`)
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
  }, [rangeQs, customerId, templateId, soldById, includeTax, includeCanceled]);

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

        <div className="bg-card border border-line rounded-2xl p-5 shadow-sm">
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

      <Section title="Retention">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BigStatCard
            label="NRR"
            value={pct(data.nrr.pct)}
            sub={`Retained ${money(data.nrr.retained_mrr_cents)} / ${money(data.nrr.mrr_at_start_cents)}`}
          />
          <BigStatCard
            label="Churn $"
            value={money(data.churn.churned_dollars_cents)}
            sub={`${data.churn.canceled_in_range} canceled in range`}
          />
          <BigStatCard
            label="Logo Churn"
            value={pct(data.churn.logo_churn_pct)}
            sub={`${data.churn.canceled_in_range} of ${data.churn.active_at_start} active at start`}
          />
          <BigStatCard
            label="Forecast MRR (30d)"
            value={money(data.forecast.mrr_30d_cents)}
            sub="From currently-active subs"
          />
        </div>
      </Section>

      <Section title="Cohort retention">
        <CohortRetentionTable rows={data.cohort_retention} />
      </Section>

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
        className="mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-line-strong"
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
          (checked ? "bg-emerald-500 hover:bg-emerald-500" : "bg-line-strong hover:bg-line-strong")
        }
        aria-pressed={checked}
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-card shadow transition " +
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
        "bg-card border border-line rounded-2xl " +
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
    <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
      {rows.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500 text-center">
          No subscriptions yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent text-eyebrow uppercase text-zinc-500 bg-black">
              <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">{header}</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Count</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">MRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="border-t border-b-0 border-line hover:bg-transparent">
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

function CohortRetentionTable({
  rows,
}: {
  rows: SubscriptionsReport["cohort_retention"];
}) {
  function fmt(v: number) {
    if (v < 0) return "—";
    return `${(v * 100).toFixed(0)}%`;
  }
  function bg(v: number) {
    if (v < 0) return "transparent";
    const a = Math.max(0.08, Math.min(0.85, v));
    return `rgba(16, 185, 129, ${a})`;
  }
  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Cohort</TableHead>
            <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Started</TableHead>
            <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">+30d</TableHead>
            <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">+90d</TableHead>
            <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">+180d</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.iso} className="border-t border-b-0 border-line hover:bg-transparent">
              <TableCell className="px-5 py-3 font-bold text-white tracking-tight">{r.label} {r.iso}</TableCell>
              <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">{r.started}</TableCell>
              <TableCell className="px-5 py-3 text-right font-extrabold text-white tabular-nums" style={{ background: bg(r.retention_30d) }}>{fmt(r.retention_30d)}</TableCell>
              <TableCell className="px-5 py-3 text-right font-extrabold text-white tabular-nums" style={{ background: bg(r.retention_90d) }}>{fmt(r.retention_90d)}</TableCell>
              <TableCell className="px-5 py-3 text-right font-extrabold text-white tabular-nums" style={{ background: bg(r.retention_180d) }}>{fmt(r.retention_180d)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
    <div className="bg-card border border-line rounded-2xl p-5">
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
          className="bg-card border border-line rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
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

function EmployeesPanel({ qs }: { qs: string }) {
  const [data, setData] = useState<EmployeesReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/employees?${qs}`)
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
  }, [qs]);

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
    <div className="bg-card border border-line rounded-2xl overflow-hidden">
      {rows.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500 text-center font-bold">{emptyText}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent bg-black">
              <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Employee</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Tenure</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Lifetime</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Monthly</TableHead>
              <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Daily</TableHead>
              {variant === "tech" && (
                <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">$/hr</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="border-t border-b-0 border-line hover:bg-transparent">
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
  range: string;
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

function PayrollPanel({
  qs,
  range,
  customStart,
  customEnd,
}: {
  qs: string;
  range: Range;
  customStart: string;
  customEnd: string;
}) {
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/payroll?${qs}`)
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
  }, [qs, reloadKey]);

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
    const body: Record<string, unknown> = { staff_id: staffId, role, paid, range };
    if (range === "custom") {
      body.start = customStart;
      body.end = customEnd;
    }
    await fetch(`/api/reports/payroll/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
          className="h-auto gap-2 px-3 py-2 text-eyebrow uppercase text-zinc-500 bg-card border border-line rounded-full hover:bg-black shadow-sm"
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
      <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-sm text-zinc-500 text-center">
            No employees yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent text-eyebrow uppercase text-zinc-500 bg-black">
                <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Employee</TableHead>
                <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Email</TableHead>
                <TableHead className="h-auto text-left px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Role</TableHead>
                <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">{rateLabel}</TableHead>
                <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Total</TableHead>
                {showTips && (
                  <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Tips</TableHead>
                )}
                {showBonus && (
                  <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Bonus</TableHead>
                )}
                <TableHead className="h-auto text-right px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Payout</TableHead>
                <TableHead className="h-auto text-center px-5 py-3 text-eyebrow-tight uppercase text-zinc-500">Paid</TableHead>
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
    <TableRow className="border-t border-b-0 border-line hover:bg-transparent">
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
              className="w-20 h-auto text-right border-line-strong rounded px-2 py-1"
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
    <div className="bg-card border border-line rounded-2xl shadow-sm divide-y divide-line">
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
  range: string;
  start: string;
  end: string;
  service_plan: JobBucket;
  one_off: JobBucket;
  all: JobBucket;
  cash_collected_cents: number;
  avg_collection_lag_days: number;
  customer_split: {
    first_time_cents: number;
    repeat_cents: number;
  };
  by_source?: { name: string; count: number }[];
};

function JobsPanel({ qs }: { qs: string }) {
  const [data, setData] = useState<JobsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/jobs?${qs}`)
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
  }, [qs]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center font-bold">Loading…</p>
    );
  if (!data) return null;

  const split = data.customer_split;
  const splitTotal = split.first_time_cents + split.repeat_cents;
  const firstTimePct = splitTotal > 0 ? split.first_time_cents / splitTotal : 0;

  const sourceList = data.by_source || [];
  const sourceTotal = sourceList.reduce((s, r) => s + r.count, 0);
  const sourceSegments = sourceList.map((r, i) => ({
    name: r.name,
    value: r.count,
    color: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }));

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
              label: "Completed Job Value",
              value: money(data.all.collected_cents),
            },
            {
              label: "Average Job Value",
              value: money(data.all.avg_value_cents),
            },
          ]}
        />
      </Section>

      <Section title="Cash flow">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BigStatCard
            label="Cash Collected"
            value={money(data.cash_collected_cents)}
            sub="From payments table"
          />
          <BigStatCard
            label="Avg Collection Lag"
            value={`${data.avg_collection_lag_days.toFixed(1)} days`}
            sub="Completion → first payment"
          />
          <BigStatCard
            label="First-time vs Repeat"
            value={pct(firstTimePct)}
            sub={`${money(split.first_time_cents)} new · ${money(split.repeat_cents)} repeat`}
          />
        </div>
      </Section>

      <Section title="Jobs by Lead Source">
        <div className="bg-card border border-line rounded-2xl px-5 py-5">
          {sourceTotal === 0 ? (
            <p className="py-10 text-sm text-zinc-500 text-center">
              No jobs in this window.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <CountDonut segments={sourceSegments} total={sourceTotal} />
              <div className="space-y-2">
                {sourceSegments.map((s) => {
                  const p = sourceTotal > 0 ? (s.value / sourceTotal) * 100 : 0;
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: s.color }}
                        />
                        <span className="font-bold text-white truncate">
                          {s.name}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                        <span className="text-zinc-300 font-bold">
                          {s.value}
                        </span>
                        <span className="text-eyebrow-tight uppercase text-zinc-500">
                          {p.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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

function MapPanel({ qs }: { qs: string }) {
  const [data, setData] = useState<MapReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/map?${qs}`)
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
  }, [qs]);

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
    <div className="bg-card border border-line rounded-2xl overflow-hidden">
      {objections.breakdown.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500 text-center font-bold">
          No objections recorded in this window.
        </p>
      ) : (
        <div className="divide-y divide-line">
          <div className="px-5 py-3 text-eyebrow-tight uppercase text-zinc-500 bg-black flex items-center justify-between">
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
              <div className="mt-2 h-2 w-full rounded-full bg-line overflow-hidden">
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
