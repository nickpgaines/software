"use client";

import { useEffect, useState } from "react";

type Tab = "overview" | "sales" | "subscriptions";
type Range = "1w" | "1m" | "3m" | "1y";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "subscriptions", label: "Subscriptions" },
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
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  "whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition " +
                  (active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
        {tab !== "subscriptions" && (
          <RangePills range={range} setRange={setRange} />
        )}
      </div>

      {tab === "overview" && <OverviewPanel range={range} />}
      {tab === "sales" && <SalesPanel range={range} />}
      {tab === "subscriptions" && <SubscriptionsPanel />}
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
    <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-sm mb-3">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={
            "px-3 py-1 rounded-full transition whitespace-nowrap " +
            (range === r.key
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

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
  };
  customers: { total: number; new: number; repeat: number };
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
      <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>
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
            { label: "Completed", value: String(data.jobs.completed) },
            { label: "Scheduled", value: String(data.jobs.scheduled) },
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
      <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {data.reps.length === 0 ? (
            <p className="p-8 text-sm text-slate-400 text-center">
              No rep activity in this window.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Rep</th>
                  <th className="text-right px-5 py-3 font-medium">Doors</th>
                  <th className="text-right px-5 py-3 font-medium">Sales</th>
                  <th className="text-right px-5 py-3 font-medium">Conv.</th>
                  <th className="text-right px-5 py-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.reps.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {r.name}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                      {r.doors_knocked}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                      {r.sales}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                      {pct(r.conversion_rate)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                      {money(r.revenue_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}

function SubscriptionsPanel() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm py-20 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.4 2.6" />
          <polyline points="21 4 21 10 15 10" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        Subscriptions coming soon
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Recurring revenue tracking will live here.
      </p>
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
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
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
        >
          <div className="text-xs text-slate-400">{it.label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
