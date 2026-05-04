"use client";

import {
  ACCENT,
  ACCENT_SOFT,
  Donut,
  LegendDot,
  PreviewBar,
  SplitDonut,
  TRACK,
  VARIANT_LIST,
  money,
  pct,
} from "../_shared";
import type { ReportsOverview } from "../../concept-live/_data";

export default function DonutSuiteView({
  overview,
}: {
  overview: ReportsOverview;
}) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const completed = overview.jobs.completed;
  const scheduled = overview.jobs.scheduled;
  const canceled = overview.jobs.cancelled;
  const totalJobs = overview.jobs.total;

  const newCustomers = overview.customers.new;
  const repeatCustomers = overview.customers.repeat;
  const totalCustomers = overview.customers.total;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <PreviewBar letter="A" name="Donut suite" letters={VARIANT_LIST} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-sm text-zinc-500 mt-1.5 font-bold">
            {monthLabel} overview
          </p>
        </header>

        {/* Donut hero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <DonutCard title="Collection Rate">
            <Donut
              value={overview.revenue.collection_rate}
              label={pct(overview.revenue.collection_rate)}
              size={180}
              stroke={20}
            />
            <div className="mt-5 text-sm text-zinc-500 font-bold text-center">
              {money(overview.revenue.collected_cents)} collected of{" "}
              {money(overview.revenue.total_cents)}
            </div>
          </DonutCard>

          <DonutCard title={`Jobs · ${totalJobs} total`}>
            <SplitDonut
              segments={[
                { value: completed, color: ACCENT },
                { value: scheduled, color: ACCENT_SOFT },
                { value: canceled, color: TRACK },
              ]}
              size={180}
              stroke={20}
              centerLabel={String(totalJobs)}
              centerSub="JOBS"
            />
            <div className="mt-5 grid grid-cols-3 gap-3 w-full">
              <LegendDot color={ACCENT} label="Completed" value={completed} />
              <LegendDot color={ACCENT_SOFT} label="Scheduled" value={scheduled} />
              <LegendDot color={TRACK} label="Canceled" value={canceled} />
            </div>
          </DonutCard>

          <DonutCard title={`Customers · ${totalCustomers} total`}>
            <SplitDonut
              segments={[
                { value: newCustomers, color: ACCENT },
                { value: repeatCustomers, color: ACCENT_SOFT },
              ]}
              size={180}
              stroke={20}
              centerLabel={String(totalCustomers)}
              centerSub="CUSTOMERS"
            />
            <div className="mt-5 grid grid-cols-2 gap-3 w-full">
              <LegendDot color={ACCENT} label="New" value={newCustomers} />
              <LegendDot color={ACCENT_SOFT} label="Repeat" value={repeatCustomers} />
            </div>
          </DonutCard>
        </div>

        <Section title="Revenue">
          <KpiGrid
            items={[
              { label: "Total Revenue", value: money(overview.revenue.total_cents) },
              { label: "Collected", value: money(overview.revenue.collected_cents) },
              { label: "Unpaid", value: money(overview.revenue.unpaid_cents) },
              { label: "Collection Rate", value: pct(overview.revenue.collection_rate) },
            ]}
          />
        </Section>

        <Section title="Jobs">
          <KpiGrid
            items={[
              { label: "Total Jobs", value: String(overview.jobs.total) },
              { label: "Completed", value: String(overview.jobs.completed) },
              { label: "Scheduled", value: String(overview.jobs.scheduled) },
              { label: "Canceled", value: String(overview.jobs.cancelled) },
              { label: "Avg Job Value", value: money(overview.jobs.avg_value_cents) },
            ]}
          />
        </Section>

        <Section title="Customers" last>
          <KpiGrid
            items={[
              { label: "Total Customers", value: String(overview.customers.total) },
              { label: "New Customers", value: String(overview.customers.new) },
              { label: "Repeat Customers", value: String(overview.customers.repeat) },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

function DonutCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col items-center text-center">
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-5 self-stretch text-left">
        {title}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {children}
      </div>
    </section>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "mb-8"}>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
          {title}
        </h3>
        <span className="h-px flex-1 bg-zinc-300" />
      </div>
      {children}
    </section>
  );
}

function KpiGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-white border border-zinc-200 rounded-2xl p-5"
        >
          <div className="text-[12.5px] font-bold text-zinc-500">{it.label}</div>
          <div className="text-[28px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
            {it.value}
          </div>
          <span
            className="inline-block mt-3 h-0.5 w-8 rounded-full"
            style={{ background: ACCENT }}
          />
        </div>
      ))}
    </div>
  );
}
