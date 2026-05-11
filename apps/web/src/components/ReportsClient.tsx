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
  ReferenceLine,
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

function RevenueBarChart({
  data,
  color,
  averageDollars,
  tooltipLabel = "Revenue",
}: {
  data: { name: string; revenue_cents: number }[];
  color: string;
  averageDollars?: number;
  tooltipLabel?: string;
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
                tooltipLabel,
              ];
            }}
          />
          <Bar dataKey="revenue" fill={color} radius={[6, 6, 0, 0]} />
          {typeof averageDollars === "number" && averageDollars > 0 && (
            <ReferenceLine
              y={averageDollars}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Team avg $${averageDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                position: "insideTopRight",
                fill: "#f59e0b",
                fontSize: 11,
                fontWeight: 800,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CountDonut({
  segments,
  total,
  centerLabel = "Jobs",
}: {
  segments: { name: string; value: number; color: string }[];
  total: number;
  centerLabel?: string;
}) {
  return (
    <div className="relative w-full h-44">
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
          {centerLabel}
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
type Range = "1w" | "1m" | "3m" | "ytd" | "custom";

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
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "ytd", label: "YTD" },
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

function formatMonthIso(iso?: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
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
  const [range, setRange] = useState<Range>("1m");
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
  jobs_summary: {
    scheduled: { count: number; revenue_cents: number; delta_pct: number | null };
    completed: { count: number; revenue_cents: number; delta_pct: number | null };
    paid: { count: number; revenue_cents: number; delta_pct: number | null };
    avg_job_value: { cents: number; delta_pct: number | null };
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
  const [subs, setSubs] = useState<SubscriptionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/reports/overview?${qs}`).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body || !body.jobs_summary) {
          throw new Error(
            (body && (body.error || body.message)) ||
              `Overview failed (HTTP ${r.status})`,
          );
        }
        return body as Overview;
      }),
      fetch(`/api/reports/subscriptions?${qs}`).then((r) => r.json()) as Promise<SubscriptionsReport>,
    ])
      .then(([d, s]) => {
        if (!cancelled) {
          setData(d);
          setSubs(s);
        }
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

  const js = data.jobs_summary;

  return (
    <div className="space-y-6">
      <Section title="Jobs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <JobStatCard
            label="Scheduled"
            count={js.scheduled.count}
            amountCents={js.scheduled.revenue_cents}
            deltaPct={js.scheduled.delta_pct}
          />
          <JobStatCard
            label="Completed"
            count={js.completed.count}
            amountCents={js.completed.revenue_cents}
            deltaPct={js.completed.delta_pct}
          />
          <JobStatCard
            label="Paid"
            count={js.paid.count}
            amountCents={js.paid.revenue_cents}
            deltaPct={js.paid.delta_pct}
          />
          <JobStatCard
            label="Avg Job Value"
            amountCents={js.avg_job_value.cents}
            deltaPct={js.avg_job_value.delta_pct}
          />
        </div>
      </Section>

      <Section title="Subscriptions">
        <SubscriptionsSummary
          totalCount={subs?.totals.total ?? 0}
          activeCount={data.subscriptions.active}
          mrrCents={data.subscriptions.mrr_cents}
          arrCents={data.subscriptions.arr_cents}
          byTemplate={subs?.breakdowns.by_template ?? []}
          monthly={subs?.monthly ?? []}
        />
      </Section>

      <Section title="Employees">
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
      </Section>
    </div>
  );
}

function JobStatCard({
  label,
  count,
  amountCents,
  deltaPct,
}: {
  label: string;
  count?: number;
  amountCents: number;
  deltaPct: number | null;
}) {
  const hasCount = typeof count === "number";
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4 flex flex-col min-h-[160px]">
      <div className="text-eyebrow uppercase text-zinc-500">{label}</div>
      <div className="flex-1 flex items-center">
        <div className="text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
          {hasCount ? count : money(amountCents)}
        </div>
      </div>
      {hasCount && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-bold text-zinc-300 tabular-nums">
            {money(amountCents)}
          </div>
          <DeltaBadge value={deltaPct} />
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null;
  const pct = value * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  if (rounded === 0) {
    return (
      <div className="text-xs font-bold text-zinc-500 tabular-nums">0%</div>
    );
  }
  const positive = rounded > 0;
  return (
    <div
      className={
        "text-xs font-bold tabular-nums " +
        (positive ? "text-emerald-500" : "text-red-500")
      }
    >
      {positive ? "+" : ""}
      {rounded}%
    </div>
  );
}

function SubscriptionsSummary({
  totalCount,
  activeCount,
  mrrCents,
  arrCents,
  byTemplate,
  monthly,
}: {
  totalCount: number;
  activeCount: number;
  mrrCents: number;
  arrCents: number;
  byTemplate: SubscriptionsReport["breakdowns"]["by_template"];
  monthly: SubscriptionsReport["monthly"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 items-stretch">
      <div className="grid gap-4 grid-cols-2">
        <StatCard label="Total Subscriptions" value={String(totalCount)} />
        <StatCard
          label="Active Subscriptions"
          value={String(activeCount)}
          valueClassName="text-emerald-500"
        />
        <StatCard label="Total MRR" value={money(mrrCents)} />
        <StatCard label="Total ARR" value={money(arrCents)} />
      </div>
      <SubscriptionsByTemplateDonut rows={byTemplate} />
      <MonthlyMrrChart monthly={monthly} />
    </div>
  );
}

function MonthlyMrrChart({
  monthly,
}: {
  monthly: SubscriptionsReport["monthly"];
}) {
  const chartData = monthly.map((m) => ({
    name: m.label,
    iso: m.iso,
    mrr: m.mrr_cents / 100,
    is_forecast: m.is_forecast,
  }));
  return (
    <div className="bg-card border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-white tracking-tight">
            Monthly Recurring Revenue
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {formatMonthIso(monthly[0]?.iso)} – {formatMonthIso(monthly[monthly.length - 1]?.iso)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/40 border border-amber-400/60" />
            Forecast
          </span>
        </div>
      </div>
      {monthly.length === 0 ? (
        <p className="py-10 text-sm text-zinc-500 text-center">
          No subscription activity yet.
        </p>
      ) : (
        <div className="mt-4 w-full h-44">
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
                  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
                }
                width={56}
              />
              <RTooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#0f0f12",
                  border: "1px solid #1f1f24",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fafafa",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#fafafa" }}
                formatter={(v, _name, item) => {
                  const n = typeof v === "number" ? v : Number(v) || 0;
                  const label =
                    item && (item.payload as { is_forecast?: boolean })?.is_forecast
                      ? "Forecast MRR"
                      : "MRR";
                  return [
                    `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                    label,
                  ];
                }}
              />
              <Bar dataKey="mrr" radius={[6, 6, 0, 0]}>
                {chartData.map((d) => (
                  <Cell
                    key={d.iso}
                    fill={d.is_forecast ? "rgba(251, 191, 36, 0.4)" : "#fbbf24"}
                    stroke={d.is_forecast ? "rgba(251, 191, 36, 0.7)" : undefined}
                    strokeWidth={d.is_forecast ? 1 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
      <div className="text-[22px] font-extrabold tracking-tight leading-none tabular-nums text-white">
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
  monthly: { label: string; iso: string; mrr_cents: number; is_forecast: boolean }[];
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
  const [includeTax, setIncludeTax] = useState(true);
  const [includeCanceled, setIncludeCanceled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(rangeQs);
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
  }, [rangeQs, includeTax, includeCanceled]);

  if (loading && !data)
    return (
      <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-6">
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

      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        <div className="grid gap-4 grid-cols-2">
          <StatCard label="Total Subscriptions" value={String(data.totals.total)} />
          <StatCard
            label="Active Subscriptions"
            value={String(data.totals.active)}
            valueClassName="text-emerald-500"
          />
          <StatCard
            label={`Total MRR${includeTax ? " (w/ tax)" : ""}`}
            value={money(data.revenue.mrr_cents)}
          />
          <StatCard
            label={`Total ARR${includeTax ? " (w/ tax)" : ""}`}
            value={money(data.revenue.arr_cents)}
          />
        </div>
        <SubscriptionsByTemplateDonut rows={data.breakdowns.by_template} />
        <MonthlyMrrChart monthly={data.monthly} />
      </div>
    </div>
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
        "bg-card border border-line rounded-2xl flex flex-col " +
        (compact ? "px-4 py-3 min-h-[110px]" : "px-5 py-4 min-h-[160px]")
      }
    >
      <div className="text-eyebrow uppercase text-zinc-500">{label}</div>
      <div className="flex-1 flex items-center">
        <div
          className={
            (compact ? "text-[20px]" : "text-[28px]") +
            " font-extrabold tracking-tight leading-none tabular-nums " +
            (valueClassName || "text-white")
          }
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function SubscriptionsByTemplateDonut({
  rows,
}: {
  rows: SubscriptionsReport["breakdowns"]["by_template"];
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const segments = rows
    .filter((r) => r.count > 0)
    .map((r, i) => ({
      name: r.name,
      value: r.count,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }));
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-5">
      <div className="text-sm font-extrabold text-white tracking-tight mb-3">
        Active Subscriptions by Template
      </div>
      {total === 0 ? (
        <p className="py-10 text-sm text-zinc-500 text-center">
          No active subscriptions yet.
        </p>
      ) : (
        <div className="space-y-4">
          <CountDonut segments={segments} total={total} centerLabel="Active" />
          <div className="space-y-2">
            {segments.map((s) => {
              const p = total > 0 ? (s.value / total) * 100 : 0;
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
                    <span className="text-zinc-300 font-bold">{s.value}</span>
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
            <div className="text-[22px] font-extrabold tracking-tight leading-none tabular-nums text-white">
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
  range_days?: number | null;
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

  const rangeDays = data.range_days && data.range_days > 0 ? data.range_days : null;

  function buildSeries(
    rows: { id: number; name: string; lifetime_revenue_cents: number }[],
    limit = 8,
  ) {
    const sorted = rows
      .filter((r) => r.lifetime_revenue_cents > 0)
      .sort((a, b) => b.lifetime_revenue_cents - a.lifetime_revenue_cents)
      .slice(0, limit);
    const total = sorted.map((r) => ({
      name: r.name,
      revenue_cents: r.lifetime_revenue_cents,
    }));
    const daily = rangeDays
      ? sorted.map((r) => ({
          name: r.name,
          revenue_cents: Math.round(r.lifetime_revenue_cents / rangeDays),
        }))
      : [];
    const teamTotalAvg =
      sorted.length > 0
        ? sorted.reduce((s, r) => s + r.lifetime_revenue_cents, 0) /
          sorted.length /
          100
        : 0;
    const teamDailyAvg = rangeDays && sorted.length > 0
      ? sorted.reduce((s, r) => s + r.lifetime_revenue_cents, 0) /
        sorted.length /
        rangeDays /
        100
      : 0;
    return { total, daily, teamTotalAvg, teamDailyAvg };
  }

  const salesSeries = buildSeries(data.sales);
  const techSeries = buildSeries(data.tech);

  return (
    <div className="space-y-6">
      <Section title="Sales reps">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Total revenue"
            sublabel="In selected range"
            empty={salesSeries.total.length === 0}
            emptyText="No sales revenue in this window."
          >
            <RevenueBarChart
              data={salesSeries.total}
              color="#3b82f6"
              averageDollars={salesSeries.teamTotalAvg}
              tooltipLabel="Total"
            />
          </ChartCard>
          <ChartCard
            title="Average revenue / day"
            sublabel={
              rangeDays
                ? `Total ÷ ${rangeDays.toFixed(0)} days in range`
                : "Pick a date range to see daily avg"
            }
            empty={!rangeDays || salesSeries.daily.length === 0}
            emptyText={
              rangeDays
                ? "No sales revenue in this window."
                : "Daily averages need a date range."
            }
          >
            <RevenueBarChart
              data={salesSeries.daily}
              color="#3b82f6"
              averageDollars={salesSeries.teamDailyAvg}
              tooltipLabel="Avg / day"
            />
          </ChartCard>
        </div>
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

      <Section title="Technicians">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Total revenue"
            sublabel="In selected range"
            empty={techSeries.total.length === 0}
            emptyText="No technician revenue in this window."
          >
            <RevenueBarChart
              data={techSeries.total}
              color="#10b981"
              averageDollars={techSeries.teamTotalAvg}
              tooltipLabel="Total"
            />
          </ChartCard>
          <ChartCard
            title="Average revenue / day"
            sublabel={
              rangeDays
                ? `Total ÷ ${rangeDays.toFixed(0)} days in range`
                : "Pick a date range to see daily avg"
            }
            empty={!rangeDays || techSeries.daily.length === 0}
            emptyText={
              rangeDays
                ? "No technician revenue in this window."
                : "Daily averages need a date range."
            }
          >
            <RevenueBarChart
              data={techSeries.daily}
              color="#10b981"
              averageDollars={techSeries.teamDailyAvg}
              tooltipLabel="Avg / day"
            />
          </ChartCard>
        </div>
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

function ChartCard({
  title,
  sublabel,
  empty,
  emptyText,
  children,
}: {
  title: string;
  sublabel?: string;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-white tracking-tight">
          {title}
        </div>
        {sublabel && (
          <div className="text-eyebrow uppercase text-zinc-500">{sublabel}</div>
        )}
      </div>
      {empty ? (
        <p className="py-10 text-sm text-zinc-500 text-center">
          {emptyText || "No data."}
        </p>
      ) : (
        children
      )}
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
        <JobsByLeadSourceDonut rows={sourceList} layout="horizontal" />
      </Section>
    </div>
  );
}

function JobsByLeadSourceDonut({
  rows,
  layout = "stacked",
}: {
  rows: { name: string; count: number }[];
  layout?: "horizontal" | "stacked";
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const segments = rows.map((r, i) => ({
    name: r.name,
    value: r.count,
    color: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }));
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-5">
      <div className="text-sm font-extrabold text-white tracking-tight mb-3">
        Jobs by Lead Source
      </div>
      {total === 0 ? (
        <p className="py-10 text-sm text-zinc-500 text-center">
          No jobs in this window.
        </p>
      ) : (
        <div
          className={
            layout === "horizontal"
              ? "grid gap-6 md:grid-cols-2 items-center"
              : "space-y-4"
          }
        >
          <CountDonut segments={segments} total={total} />
          <div className="space-y-2">
            {segments.map((s) => {
              const p = total > 0 ? (s.value / total) * 100 : 0;
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
                    <span className="text-zinc-300 font-bold">{s.value}</span>
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
