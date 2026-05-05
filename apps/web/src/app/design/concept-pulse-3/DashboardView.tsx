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

function formatCentsShort(c: number) {
  if (c >= 100_000_000) return `$${(c / 100_000_000).toFixed(1)}M`;
  if (c >= 100_000) return `$${(c / 100_000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(0)}`;
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

function dateLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
  const closeRate = jobs.length > 0 ? completedCount / Math.max(1, completedCount + jobs.length) : 0.34;

  const pipeline = [
    { label: "New leads", count: 12, value: 540_000, pct: 0.4 },
    { label: "Contacted", count: 8, value: 410_000, pct: 0.3 },
    { label: "Estimating", count: 9, value: 890_000, pct: 0.66 },
    { label: "Won", count: 6, value: 630_000, pct: 0.47 },
  ];

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="3" />
      <PulseSidebar
        homeSlug="concept-pulse-3"
        initials={initials}
        variantLabel="Owner"
        variantSlug="3"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="px-10 py-10">
          {/* Header */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] font-bold mb-2"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel()}
              </div>
              <h1 className="text-[44px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[14px] mt-2 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} completed this month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-10 rounded-xl px-4 text-[12.5px] font-bold flex items-center gap-2 w-72"
                style={{
                  background: PULSE.bgAlt,
                  color: PULSE.textSubtle,
                  border: `1px solid ${PULSE.cardBorder}`,
                }}
              >
                <PulseIcon name="search" className="w-3.5 h-3.5" />
                Search anything
              </button>
              <button
                className="h-10 rounded-xl px-4 text-[12.5px] font-bold flex items-center gap-2"
                style={{ background: PULSE.text, color: PULSE.bg }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          {/* Layout: main column + side column */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            {/* Main */}
            <div className="space-y-5 min-w-0">
              {/* KPI strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BoldKpi
                  label="Revenue"
                  value={formatCentsShort(revenue.totalCents)}
                  delta="+12.4%"
                  deltaPositive
                />
                <BoldKpi
                  label="Jobs done"
                  value={String(completedCount)}
                  delta={`+${Math.max(1, Math.round(completedCount * 0.1))}`}
                  deltaPositive
                />
                <BoldKpi
                  label="Close rate"
                  value={`${(closeRate * 100).toFixed(0)}%`}
                  delta="−1.1%"
                  deltaPositive={false}
                />
              </div>

              {/* Chart */}
              <section
                className="rounded-2xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight">Revenue</h2>
                    <p className="text-[11.5px] mt-0.5 font-semibold" style={{ color: PULSE.textSubtle }}>
                      Last 12 weeks
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: PULSE.bgAlt }}>
                    {["12W", "26W", "YTD"].map((r, i) => (
                      <button
                        key={r}
                        className="px-3 py-1 rounded-full text-[11px] font-bold"
                        style={{
                          background: i === 0 ? PULSE.text : "transparent",
                          color: i === 0 ? PULSE.bg : PULSE.textMuted,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <BoldChart days={revenue.daily} />
              </section>

              {/* Today's schedule */}
              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight">Today's schedule</h2>
                    <p className="text-[11.5px] mt-0.5 font-semibold" style={{ color: PULSE.textSubtle }}>
                      {jobs.length} of {Math.max(jobs.length, 12)} visible
                    </p>
                  </div>
                  <button className="text-[11.5px] font-bold" style={{ color: PULSE.violetSoft }}>
                    View all →
                  </button>
                </div>
                {jobs.length === 0 ? (
                  <p className="py-12 text-center text-[13px] font-bold" style={{ color: PULSE.textSubtle }}>
                    Nothing on the calendar today.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {jobs.slice(0, 4).map((j) => {
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
                            <div className="text-[18px] font-bold tabular-nums leading-none">
                              {time}
                            </div>
                            <div
                              className="text-[10px] font-bold mt-1 tracking-[0.18em]"
                              style={{ color: PULSE.textDim }}
                            >
                              {ampm}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold truncate">{j.customer_name}</div>
                            {j.customer_address && (
                              <div className="text-[12px] truncate font-semibold" style={{ color: PULSE.textSubtle }}>
                                {j.customer_address}
                              </div>
                            )}
                          </div>
                          <BoldStatusChip status={j.status} />
                          <div
                            className="text-[14px] font-bold tabular-nums w-20 text-right"
                            style={{ color: PULSE.text }}
                          >
                            {formatCents(j.price_cents)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Side column */}
            <div className="space-y-5">
              {/* Pipeline */}
              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="mb-4">
                  <h2 className="text-[15px] font-bold tracking-tight">Pipeline</h2>
                  <p className="text-[11.5px] mt-0.5 font-semibold" style={{ color: PULSE.textSubtle }}>
                    35 active
                  </p>
                </div>
                <div className="space-y-4">
                  {pipeline.map((p) => (
                    <div key={p.label}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-[12.5px] font-bold">{p.label}</span>
                        <span
                          className="text-[11px] font-bold tabular-nums"
                          style={{ color: PULSE.textSubtle }}
                        >
                          {p.count} · {formatCentsShort(p.value)}
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: PULSE.cardBorder }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${p.pct * 100}%`,
                            background: `linear-gradient(90deg, ${PULSE.violet}, ${PULSE.violetSoft})`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Activity */}
              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-bold tracking-tight">Activity</h2>
                  <span
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: PULSE.green }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: PULSE.green, boxShadow: `0 0 8px ${PULSE.green}` }}
                    />
                    Live
                  </span>
                </div>
                <ActivityList jobs={jobs} todayCents={todayCents} />
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function BoldKpi({
  label,
  value,
  delta,
  deltaPositive,
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11.5px] font-bold" style={{ color: PULSE.textSubtle }}>
          {label}
        </div>
        <span
          className="text-[10.5px] px-2 py-0.5 rounded-md font-bold tabular-nums"
          style={{
            background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
            color: deltaPositive ? PULSE.green : PULSE.red,
          }}
        >
          {delta}
        </span>
      </div>
      <div className="text-[34px] font-bold tracking-tight tabular-nums leading-none mt-1">
        {value}
      </div>
      <div className="text-[11px] mt-2 font-semibold" style={{ color: PULSE.textDim }}>
        vs last week
      </div>
    </div>
  );
}

function BoldStatusChip({ status }: { status: string }) {
  const onTheWay = status === "in_progress" || status === "on_the_way";
  if (onTheWay) {
    return (
      <span
        className="text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
        style={{ background: PULSE.text, color: PULSE.bg }}
      >
        On the way
      </span>
    );
  }
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap"
      style={{
        background: PULSE.bgAlt,
        color: PULSE.textMuted,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function BoldChart({ days }: { days: RevenuePoint[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-[13px] font-bold" style={{ color: PULSE.textDim }}>
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 260;
  const padT = 8;
  const padB = 8;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const x = (i: number) => (days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w);
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
          <linearGradient id="bold-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bold-area)" />
        <path
          d={path}
          fill="none"
          stroke={PULSE.text}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ActivityList({ jobs, todayCents }: { jobs: LiveJob[]; todayCents: number }) {
  void todayCents;
  const items: { color: string; who: string; what: string; when: string }[] = [];
  if (jobs.length > 0) {
    items.push({
      color: PULSE.green,
      who: "System",
      what: `scheduled ${jobs[0].customer_name}`,
      when: formatTime(jobs[0].scheduled_at).time,
    });
  }
  if (jobs.length > 1) {
    items.push({
      color: PULSE.violet,
      who: "System",
      what: `noted ${jobs[1].customer_name}`,
      when: formatTime(jobs[1].scheduled_at).time,
    });
  }
  if (jobs.length > 2) {
    items.push({
      color: PULSE.cyan,
      who: "System",
      what: `assigned ${jobs[2].customer_name}`,
      when: formatTime(jobs[2].scheduled_at).time,
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
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-1 w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
            style={{
              background: `${it.color}1F`,
              color: it.color,
              border: `1px solid ${it.color}33`,
            }}
          >
            {it.who[0]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold leading-snug" style={{ color: PULSE.textMuted }}>
              <span className="font-bold" style={{ color: PULSE.text }}>
                {it.who}
              </span>{" "}
              {it.what}
            </div>
            <div
              className="text-[10.5px] mt-0.5 font-bold uppercase tracking-[0.16em]"
              style={{ color: PULSE.textDim }}
            >
              {it.when}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
