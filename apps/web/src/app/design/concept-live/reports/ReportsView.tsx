"use client";

import { ACCENT, useTokens } from "../_theme";
import { Card, PageHeader } from "../_ui";
import { SmoothRevenueChart } from "../_chart";
import type { ReportsOverview } from "../_data";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function ReportsView({ overview }: { overview: ReportsOverview }) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader title="Reports" subtitle={`${monthLabel} overview`} />

      <div className="space-y-8">
        <Section title="Revenue">
          <Stats
            items={[
              { label: "Total Revenue", value: money(overview.revenue.total_cents) },
              { label: "Collected", value: money(overview.revenue.collected_cents) },
              { label: "Unpaid", value: money(overview.revenue.unpaid_cents) },
              { label: "Collection Rate", value: pct(overview.revenue.collection_rate) },
            ]}
          />
        </Section>

        <Section title="Jobs">
          <Stats
            items={[
              { label: "Total Jobs", value: String(overview.jobs.total) },
              { label: "Completed", value: String(overview.jobs.completed) },
              { label: "Scheduled", value: String(overview.jobs.scheduled) },
              { label: "Canceled", value: String(overview.jobs.cancelled) },
              { label: "Avg Job Value", value: money(overview.jobs.avg_value_cents) },
            ]}
          />
        </Section>

        <Section title="Customers">
          <Stats
            items={[
              { label: "Total Customers", value: String(overview.customers.total) },
              { label: "New Customers", value: String(overview.customers.new) },
              { label: "Repeat Customers", value: String(overview.customers.repeat) },
            ]}
          />
        </Section>

        <Card>
          <div className="p-6 sm:p-8">
            <SmoothRevenueChart initialRange="3m" />
          </div>
        </Card>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className={`text-[11px] uppercase tracking-[0.16em] font-bold ${t.muted}`}>
          {title}
        </h2>
        <span className="h-px flex-1" style={{ background: `${ACCENT}33` }} />
      </div>
      {children}
    </section>
  );
}

function Stats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      {items.map((it) => (
        <KpiCard key={it.label} label={it.label} value={it.value} />
      ))}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  const t = useTokens();
  return (
    <Card>
      <div className="p-5">
        <div className={`text-[12.5px] font-semibold ${t.muted}`}>{label}</div>
        <div
          className={`text-[28px] font-bold tracking-tight tabular-nums leading-none mt-2 ${t.text}`}
        >
          {value}
        </div>
        <span
          className="inline-block mt-3 h-0.5 w-8 rounded-full"
          style={{ background: ACCENT }}
        />
      </div>
    </Card>
  );
}

