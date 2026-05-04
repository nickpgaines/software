"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import type { LiveJob, RevenueSummary, RevenuePoint } from "../concept-live/_data";

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
  return { time: `${h12}:${m}`, ampm };
}

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
  const todayCents = jobs.reduce((s, j) => s + (j.price_cents || 0), 0);
  const completedCount = revenue.jobsCompleted;

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="2" />
      <PulseSidebar
        homeSlug="concept-pulse-2"
        initials={initials}
        variantLabel="Owner"
        variantSlug="2"
        style="minimal"
      />

      <main className="ml-60">
        <div className="max-w-6xl mx-auto px-10 py-12">
          {/* Header */}
          <div className="flex items-end justify-between gap-4 mb-9 flex-wrap">
            <div>
              <h1 className="text-[44px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())},{" "}
                <span
                  style={{
                    background: `linear-gradient(135deg, ${PULSE.violet}, ${PULSE.pink})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {firstName}
                </span>
              </h1>
              <p className="text-[14px] mt-2 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} completed this month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{
                  background: PULSE.bgAlt,
                  color: PULSE.textMuted,
                  border: `1px solid ${PULSE.cardBorder}`,
                }}
              >
                <PulseIcon name="search" />
              </button>
              <button
                className="h-10 w-10 rounded-xl flex items-center justify-center relative"
                style={{
                  background: PULSE.bgAlt,
                  color: PULSE.textMuted,
                  border: `1px solid ${PULSE.cardBorder}`,
                }}
              >
                <PulseIcon name="bell" />
                <span
                  className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                  style={{ background: PULSE.pink, boxShadow: `0 0 8px ${PULSE.pink}` }}
                />
              </button>
              <button
                className="h-10 rounded-xl px-4 text-[12.5px] font-bold flex items-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${PULSE.violet}, ${PULSE.violetSoft})`,
                  color: "#fff",
                  boxShadow: `0 0 24px ${PULSE.violetGlow}`,
                }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          {/* KPI gradient bento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <NeonKpi
              label="Revenue"
              value={formatCents(revenue.totalCents)}
              sub="this month"
              accent={PULSE.violet}
              accentSoft={PULSE.violetSoft}
            />
            <NeonKpi
              label="Today"
              value={formatCents(todayCents)}
              sub={`${jobs.length} jobs`}
              accent={PULSE.green}
              accentSoft={PULSE.greenSoft}
            />
            <NeonKpi
              label="Jobs done"
              value={String(completedCount)}
              sub="this month"
              accent={PULSE.cyan}
              accentSoft="#67e8f9"
            />
            <NeonKpi
              label="Customers"
              value={String(revenue.customersCount)}
              sub="active"
              accent={PULSE.pink}
              accentSoft={PULSE.pinkSoft}
            />
          </div>

          {/* Big chart */}
          <section
            className="rounded-2xl p-7 mb-6"
            style={{
              background: `radial-gradient(ellipse at top left, rgba(139,92,246,0.15), transparent 60%), ${PULSE.card}`,
              border: `1px solid ${PULSE.cardBorder}`,
            }}
          >
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] font-bold mb-2"
                  style={{ color: PULSE.violetSoft }}
                >
                  Revenue · this month
                </div>
                <div className="text-[44px] font-bold tracking-tight tabular-nums leading-none">
                  {formatCents(revenue.totalCents)}
                </div>
              </div>
            </div>
            <NeonChart days={revenue.daily} />
          </section>

          {/* Bottom row: schedule + activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section
              className="lg:col-span-2 rounded-2xl p-6"
              style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
            >
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[16px] font-bold tracking-tight">Today's schedule</h2>
                <span className="text-[12px] font-semibold" style={{ color: PULSE.textSubtle }}>
                  {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                </span>
              </div>
              {jobs.length === 0 ? (
                <p className="py-12 text-center text-[13px] font-bold" style={{ color: PULSE.textSubtle }}>
                  Nothing on the calendar today.
                </p>
              ) : (
                <div className="space-y-2">
                  {jobs.slice(0, 5).map((j) => {
                    const { time, ampm } = formatTime(j.scheduled_at);
                    return (
                      <div
                        key={j.id}
                        className="flex items-center gap-4 px-3 py-3 rounded-xl"
                        style={{
                          background: PULSE.bgAlt,
                          border: `1px solid ${PULSE.cardBorder}`,
                        }}
                      >
                        <div className="text-center w-12">
                          <div className="text-[16px] font-bold tabular-nums leading-none">
                            {time}
                          </div>
                          <div
                            className="text-[9.5px] font-bold mt-1 tracking-[0.18em]"
                            style={{ color: PULSE.textDim }}
                          >
                            {ampm}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-bold truncate">{j.customer_name}</div>
                          {j.customer_address && (
                            <div className="text-[11.5px] truncate font-semibold" style={{ color: PULSE.textSubtle }}>
                              {j.customer_address}
                            </div>
                          )}
                        </div>
                        <NeonStatusChip status={j.status} />
                        <div
                          className="text-[13px] font-bold tabular-nums w-16 text-right"
                          style={{ color: PULSE.green }}
                        >
                          {formatCents(j.price_cents)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              className="rounded-2xl p-6"
              style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-bold tracking-tight">Activity</h2>
                <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: PULSE.green }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PULSE.green, boxShadow: `0 0 8px ${PULSE.green}` }} />
                  Live
                </span>
              </div>
              <ActivityFeed completedCount={completedCount} jobs={jobs} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function NeonKpi({
  label,
  value,
  sub,
  accent,
  accentSoft,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  accentSoft: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div
        className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accent}3F 0%, transparent 70%)`,
        }}
      />
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] font-bold mb-2 relative"
        style={{ color: accentSoft }}
      >
        {label}
      </div>
      <div className="text-[28px] font-bold tracking-tight tabular-nums leading-none relative">
        {value}
      </div>
      <div
        className="text-[11.5px] mt-2 font-semibold relative"
        style={{ color: PULSE.textSubtle }}
      >
        {sub}
      </div>
      <span
        className="absolute bottom-0 left-5 right-5 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
    </div>
  );
}

function NeonStatusChip({ status }: { status: string }) {
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
      className="text-[10.5px] px-2 py-1 rounded-full font-bold capitalize whitespace-nowrap"
      style={{
        background: `${color}1F`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
}

function NeonChart({ days }: { days: RevenuePoint[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-[13px] font-bold" style={{ color: PULSE.textDim }}>
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 260;
  const padL = 0;
  const padR = 0;
  const padT = 12;
  const padB = 12;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const x = (i: number) => (days.length <= 1 ? innerW / 2 : padL + (i / (days.length - 1)) * innerW);
  const y = (v: number) => baseY - (v / max) * innerH;
  let path = `M ${x(0)},${y(days[0].cents)}`;
  for (let i = 0; i < days.length - 1; i++) {
    const x0 = x(i);
    const y0 = y(days[i].cents);
    const x1 = x(i + 1);
    const y1 = y(days[i + 1].cents);
    const cx = (x0 + x1) / 2;
    path += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${path} L ${x(days.length - 1)},${baseY} L ${x(0)},${baseY} Z`;
  return (
    <div className="w-full h-[260px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="neon-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PULSE.violet} />
            <stop offset="100%" stopColor={PULSE.pink} />
          </linearGradient>
          <linearGradient id="neon-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PULSE.violet} stopOpacity="0.3" />
            <stop offset="100%" stopColor={PULSE.violet} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={area} fill="url(#neon-area)" />
        <path
          d={path}
          fill="none"
          stroke="url(#neon-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
      </svg>
    </div>
  );
}

function ActivityFeed({
  completedCount,
  jobs,
}: {
  completedCount: number;
  jobs: LiveJob[];
}) {
  const items: { color: string; text: React.ReactNode; time: string }[] = [];
  if (completedCount > 0) {
    items.push({
      color: PULSE.green,
      text: (
        <>
          <span className="font-bold">{completedCount} jobs</span> completed this month
        </>
      ),
      time: "this month",
    });
  }
  if (jobs.length > 0) {
    items.push({
      color: PULSE.violet,
      text: (
        <>
          <span className="font-bold">{jobs[0].customer_name}</span> scheduled today
        </>
      ),
      time: formatTime(jobs[0].scheduled_at).time,
    });
  }
  if (jobs.length > 1) {
    items.push({
      color: PULSE.cyan,
      text: (
        <>
          <span className="font-bold">{jobs.length - 1} more jobs</span> on the way
        </>
      ),
      time: "today",
    });
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[12.5px] font-bold" style={{ color: PULSE.textSubtle }}>
        No recent activity.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold leading-snug" style={{ color: PULSE.textMuted }}>
              {it.text}
            </div>
            <div className="text-[10.5px] mt-0.5 font-bold uppercase tracking-[0.16em]" style={{ color: PULSE.textDim }}>
              {it.time}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
