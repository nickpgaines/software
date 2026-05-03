"use client";

import { ACCENT, useTokens } from "../_theme";
import { Card, CardTitle, EmptyState, PageHeader } from "../_ui";
import type { RevenueSummary } from "../_data";

function formatCents(c: number) {
  if (c >= 100000) return `$${(c / 100000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

export default function ReportsView({ revenue }: { revenue: RevenueSummary }) {
  const t = useTokens();
  const monthLabel = new Date().toLocaleString(undefined, { month: "long", year: "numeric" });
  const points = revenue.daily.map((d) => d.cents / 100);
  const max = Math.max(1, ...points);
  const w = 800;
  const h = 200;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`)
    .join(" ");
  const fill = path + ` L ${w} ${h} L 0 ${h} Z`;
  const id = `rep-${t.isDark ? "d" : "l"}`;

  return (
    <>
      <PageHeader title="Reports" subtitle={`${monthLabel} overview`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard label="Revenue" value={formatCents(revenue.totalCents)} sub="this month" />
        <KpiCard label="Jobs completed" value={String(revenue.jobsCompleted)} sub="this month" />
        <KpiCard label="Customers" value={String(revenue.customersCount)} sub="all time" />
      </div>

      <Card>
        <CardTitle title={`${monthLabel} revenue`} subtitle="Daily" />
        <div className="px-5 pb-5">
          {revenue.totalCents === 0 ? (
            <EmptyState
              title="No data yet"
              subtitle="Charts will populate once jobs are scheduled with prices."
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M3 3v18h18" />
                  <path d="M7 14v4M12 9v9M17 5v13" />
                </svg>
              }
            />
          ) : (
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44" preserveAspectRatio="none">
              <defs>
                <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={fill} fill={`url(#${id})`} />
              <path d={path} stroke={ACCENT} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
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
