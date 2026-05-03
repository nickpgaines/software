"use client";

import { ACCENT, useTokens } from "../_theme";
import { Card, CardTitle, EmptyState, PageHeader } from "../_ui";
import { SmoothRevenueChart } from "../_chart";
import type { RevenueSummary } from "../_data";

function formatCents(c: number) {
  if (c >= 100000) return `$${(c / 100000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

export default function ReportsView({ revenue }: { revenue: RevenueSummary }) {
  const monthLabel = new Date().toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Reports" subtitle={`${monthLabel} overview`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard label="Revenue" value={formatCents(revenue.totalCents)} sub="this month" />
        <KpiCard label="Jobs completed" value={String(revenue.jobsCompleted)} sub="this month" />
        <KpiCard label="Customers" value={String(revenue.customersCount)} sub="all time" />
      </div>

      <Card>
        <div className="p-6 sm:p-8">
          <SmoothRevenueChart initialRange="3m" />
        </div>
      </Card>
    </>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  const t = useTokens();
  return (
    <Card>
      <div className="p-5">
        <div className={`text-[12.5px] font-semibold ${t.muted}`}>{label}</div>
        <div className={`text-[32px] font-bold tracking-tight tabular-nums leading-none mt-2 ${t.text}`}>
          {value}
        </div>
        <span className="inline-block mt-2 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
        <div className={`text-[11.5px] mt-2 font-semibold ${t.subtle}`}>{sub}</div>
      </div>
    </Card>
  );
}
