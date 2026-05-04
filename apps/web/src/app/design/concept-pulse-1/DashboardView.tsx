"use client";

import { useState } from "react";
import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

type Period = "today" | "week" | "month";

function formatCents(c: number, decimals = 0) {
  return `$${(c / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h12}:${m} ${ampm}`;
}

export default function DashboardView({
  firstName,
  initials,
  jobs,
  revenue,
}: {
  firstName: string;
  initials: string;
  jobs: LiveJob[];
  revenue: RevenueSummary;
}) {
  const [period, setPeriod] = useState<Period>("month");
  void firstName;

  const todayCents = jobs.reduce((s, j) => s + (j.price_cents || 0), 0);
  const completedCount = revenue.jobsCompleted;
  const target = Math.max(revenue.totalCents, 5_000_000);
  const progress = target > 0 ? Math.min(1, revenue.totalCents / target) : 0;
  const remaining = Math.max(0, target - revenue.totalCents);

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="1" />
      <PulseSidebar
        homeSlug="concept-pulse-1"
        initials={initials}
        variantLabel="Owner"
        variantSlug="1"
        style="minimal"
      />

      <main className="ml-60">
        <div className="max-w-5xl mx-auto px-10 py-12">
          {/* Header row */}
          <div className="flex items-start justify-between gap-6 mb-9">
            <div>
              <h1 className="text-[42px] font-bold tracking-tight leading-tight">
                Dashboard
              </h1>
              <p className="text-[14px] mt-1 font-semibold" style={{ color: PULSE.textMuted }}>
                Live operations overview
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-lg px-3.5 text-[12.5px] font-bold flex items-center gap-2"
                style={{
                  background: PULSE.bgAlt,
                  color: PULSE.textMuted,
                  border: `1px solid ${PULSE.cardBorder}`,
                }}
              >
                <PulseIcon name="search" className="w-3.5 h-3.5" />
                Search
              </button>
              <button
                className="h-9 rounded-lg px-3.5 text-[12.5px] font-bold flex items-center gap-2"
                style={{ background: PULSE.text, color: PULSE.bg }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          {/* Period selector */}
          <div
            className="inline-flex items-center gap-0 p-1 rounded-xl mb-3"
            style={{ background: PULSE.bgAlt, border: `1px solid ${PULSE.cardBorder}` }}
          >
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="h-7 px-4 rounded-lg text-[12px] font-bold capitalize transition-colors"
                style={{
                  background: period === p ? PULSE.text : "transparent",
                  color: period === p ? PULSE.bg : PULSE.textMuted,
                }}
              >
                {p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
              </button>
            ))}
          </div>
          <div className="text-[12.5px] font-semibold mb-8" style={{ color: PULSE.textSubtle }}>
            {periodLabel(period)}
          </div>

          {/* Hero metric */}
          <div className="mb-12">
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-bold mb-3"
              style={{ color: PULSE.textSubtle }}
            >
              Revenue
            </div>
            <div className="text-[64px] font-bold tracking-tight tabular-nums leading-none">
              {formatCents(period === "today" ? todayCents : revenue.totalCents, 2)}
            </div>
            <div
              className="mt-4 flex items-center gap-x-5 gap-y-2 flex-wrap text-[13.5px] font-semibold"
              style={{ color: PULSE.textMuted }}
            >
              <span>{jobs.length} jobs today</span>
              <span style={{ color: PULSE.textDim }}>·</span>
              <span>{completedCount} completed this month</span>
              <span style={{ color: PULSE.textDim }}>·</span>
              <span>{revenue.customersCount} active customers</span>
            </div>
          </div>

          {/* Progress card with donut */}
          <ProgressCard
            label="Monthly target"
            value={formatCents(revenue.totalCents)}
            sub={`${(progress * 100).toFixed(1)}% of ${formatCents(target)} target · ${formatCents(remaining)} remaining`}
            progress={progress}
          />

          <div className="my-10 h-px" style={{ background: PULSE.divider }} />

          {/* Today's schedule — dense list */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[20px] font-bold tracking-tight">Today's schedule</h2>
              <span className="text-[12.5px] font-semibold" style={{ color: PULSE.textSubtle }}>
                {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
              </span>
            </div>
            {jobs.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <p className="text-[14px] font-bold">Nothing on the calendar</p>
                <p className="text-[12.5px] mt-1 font-semibold" style={{ color: PULSE.textSubtle }}>
                  Today's jobs will appear here once scheduled.
                </p>
              </div>
            ) : (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                {jobs.map((j, i) => (
                  <div
                    key={j.id}
                    className="flex items-center gap-5 px-5 py-4"
                    style={{
                      borderTop: i === 0 ? "none" : `1px solid ${PULSE.divider}`,
                    }}
                  >
                    <div className="w-20 text-[13px] font-bold tabular-nums" style={{ color: PULSE.text }}>
                      {formatTime(j.scheduled_at)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold truncate">{j.customer_name}</div>
                      {j.customer_address && (
                        <div className="text-[12px] truncate font-semibold mt-0.5" style={{ color: PULSE.textSubtle }}>
                          {j.customer_address}
                        </div>
                      )}
                    </div>
                    <StatusChip status={j.status} />
                    {j.technician_name && (
                      <div className="text-[12px] font-semibold w-28 truncate text-right" style={{ color: PULSE.textMuted }}>
                        {j.technician_name}
                      </div>
                    )}
                    <div className="text-[14px] font-bold tabular-nums w-20 text-right" style={{ color: PULSE.green }}>
                      {formatCents(j.price_cents, 2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Executive summary */}
          <section>
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-bold mb-3"
              style={{ color: PULSE.textSubtle }}
            >
              Executive summary
            </div>
            <p className="text-[14.5px] leading-[1.7] font-medium" style={{ color: PULSE.textMuted }}>
              This {period === "today" ? "day" : period === "week" ? "week" : "month"},{" "}
              <span className="font-bold" style={{ color: PULSE.text }}>
                Forge CRM
              </span>{" "}
              generated{" "}
              <span className="font-bold" style={{ color: PULSE.green }}>
                {formatCents(period === "today" ? todayCents : revenue.totalCents, 2)}
              </span>{" "}
              in revenue across{" "}
              <span className="font-bold" style={{ color: PULSE.text }}>
                {jobs.length} jobs scheduled today
              </span>{" "}
              and{" "}
              <span className="font-bold" style={{ color: PULSE.text }}>
                {completedCount} completed this month
              </span>
              .{" "}
              <span className="font-bold" style={{ color: PULSE.violet }}>
                {(progress * 100).toFixed(1)}%
              </span>{" "}
              of the monthly target is achieved, with{" "}
              <span className="font-bold" style={{ color: PULSE.text }}>
                {formatCents(remaining)}
              </span>{" "}
              remaining.{" "}
              <span className="font-bold" style={{ color: PULSE.text }}>
                {revenue.customersCount}
              </span>{" "}
              active customers are tracked across the operation.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function periodLabel(p: Period) {
  const today = new Date();
  if (p === "today") {
    return today.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (p === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(today)}, ${today.getFullYear()}`;
  }
  return today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function StatusChip({ status }: { status: string }) {
  const onTheWay = status === "in_progress" || status === "on_the_way";
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const color = onTheWay
    ? PULSE.violet
    : isCompleted
    ? PULSE.green
    : isCancelled
    ? PULSE.red
    : PULSE.cyan;
  const label = status.replace(/_/g, " ");
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap"
      style={{
        background: `${color}1F`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {label}
    </span>
  );
}

function ProgressCard({
  label,
  value,
  sub,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  progress: number;
}) {
  return (
    <div
      className="rounded-2xl p-7 flex items-center gap-6"
      style={{
        background: `linear-gradient(135deg, ${PULSE.card} 0%, #15101e 100%)`,
        border: `1px solid ${PULSE.cardBorder}`,
        boxShadow: `inset 0 0 0 1px rgba(139,92,246,0.06), 0 20px 60px -30px ${PULSE.violetGlow}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] font-bold mb-3"
          style={{ color: PULSE.violetSoft }}
        >
          {label}
        </div>
        <div className="text-[36px] font-bold tracking-tight tabular-nums leading-none">
          {value}
        </div>
        <div className="text-[12.5px] mt-3 font-semibold" style={{ color: PULSE.textMuted }}>
          {sub}
        </div>
      </div>
      <ProgressDonut value={progress} />
    </div>
  );
}

function ProgressDonut({ value }: { value: number }) {
  const size = 90;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const dash = c * clamped;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <defs>
        <linearGradient id="pulse1-donut" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PULSE.violet} />
          <stop offset="100%" stopColor={PULSE.violetSoft} />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={PULSE.cardBorderHi}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#pulse1-donut)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
