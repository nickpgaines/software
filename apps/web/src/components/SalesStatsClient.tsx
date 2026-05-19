"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeroChart } from "@/components/pulse/widgets";
import { PULSE } from "@/components/pulse/theme";
import { formatCents, formatCentsShort } from "@/components/pulse/format";

type Range = "today" | "week" | "month" | "year" | "custom";
type View = "sales" | "tech";

type Series = { date: string; cents: number };

type Scorecard = {
  staff: {
    id: number;
    name: string;
    role: string | null;
    photo_url: string | null;
  };
  range: Range;
  view: View;
  start: string;
  end: string;
  subscriptions: {
    arr_cents: number;
    count: number;
    avg_value_cents: number;
    series: Series[];
  };
  one_time: {
    revenue_cents: number;
    count: number;
    avg_value_cents: number;
    series: Series[];
  };
  pins: {
    total: number;
    qualified: number;
    counts: Record<string, number>;
    conversion_rate: number;
  };
};

const PRESETS: { key: Exclude<Range, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

const PIN_DEFS: { key: string; label: string; color: string }[] = [
  { key: "sale", label: "Sale", color: PULSE.green },
  { key: "not_home", label: "Not Home", color: "#f59e0b" },
  { key: "not_interested", label: "Not Interested", color: PULSE.red },
  { key: "not_qualified", label: "Not Qualified", color: PULSE.violet },
  { key: "do_not_contact", label: "Do Not Contact", color: PULSE.textDim },
  { key: "revisit", label: "Revisit", color: PULSE.cyan },
  { key: "referral", label: "Referral", color: "#ec4899" },
  { key: "quote", label: "Quote", color: "#3b82f6" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avg(series: Series[]) {
  if (series.length === 0) return 0;
  const total = series.reduce((s, p) => s + p.cents, 0);
  return Math.round(total / series.length);
}

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  e.setSeconds(e.getSeconds() - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export default function SalesStatsClient({
  staffId,
  defaultView,
}: {
  staffId: number;
  defaultView: View;
}) {
  const router = useRouter();
  const view: View = defaultView;
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ view, range });
    fetch(`/api/staff/${staffId}/scorecard?${params}`)
      .then((r) => r.json())
      .then((d: Scorecard) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId, view, range]);

  const staff = data?.staff;
  const subs = data?.subscriptions;
  const ot = data?.one_time;
  const pins = data?.pins;

  const totalSold = (subs?.arr_cents || 0) + (ot?.revenue_cents || 0);

  const subSeries = subs?.series ?? [];
  const otSeries = ot?.series ?? [];
  const subTotal = subSeries.reduce((s, p) => s + p.cents, 0);
  const otTotal = otSeries.reduce((s, p) => s + p.cents, 0);
  const subAvg = avg(subSeries);
  const otAvg = avg(otSeries);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-xs font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Leaderboard
        </Link>
        <div
          className="flex items-center gap-1 p-1 rounded-full"
          style={{ background: PULSE.bgAlt }}
        >
          <button
            className="h-auto px-3.5 py-1 rounded-full text-[11.5px] font-extrabold"
            style={{ background: PULSE.text, color: PULSE.bg }}
          >
            Sales
          </button>
          <button
            onClick={() => router.push(`/tech-stats/${staffId}`)}
            className="h-auto px-3.5 py-1 rounded-full text-[11.5px] font-extrabold transition-colors"
            style={{ background: "transparent", color: PULSE.textMuted }}
          >
            Tech
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
        <div className="flex items-center gap-5 min-w-0">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-[22px] font-extrabold flex-shrink-0"
            style={{
              background: PULSE.bgAlt,
              border: `1px solid ${PULSE.cardBorder}`,
              color: PULSE.textMuted,
            }}
          >
            {staff?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={staff.photo_url}
                alt={staff.name}
                className="w-full h-full object-cover"
              />
            ) : (
              initials(staff?.name || "—")
            )}
          </div>
          <div className="min-w-0">
            <div
              className="text-sm font-bold mb-3"
              style={{ color: PULSE.textDim }}
            >
              Sales Stats
            </div>
            <h1 className="text-[48px] font-extrabold tracking-tight leading-none tabular-nums">
              {staff?.name || (loading ? "Loading…" : "—")}
              {data && (
                <>
                  {" "}
                  <span style={{ color: PULSE.violetVar }}>
                    {formatCentsShort(totalSold)}
                  </span>
                </>
              )}
            </h1>
            {data && (
              <p
                className="text-sm mt-3 font-bold flex items-center gap-2 flex-wrap"
                style={{ color: PULSE.textMuted }}
              >
                {staff?.role && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: `${PULSE.violet}1F`,
                      color: PULSE.violetSoft,
                      border: `1px solid ${PULSE.violet}33`,
                    }}
                  >
                    {staff.role}
                  </span>
                )}
                <span>sold in this range · {formatRange(data.start, data.end)}</span>
              </p>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-1 p-1 rounded-full flex-shrink-0"
          style={{ background: PULSE.bgAlt }}
        >
          {PRESETS.map((p) => {
            const active = range === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setRange(p.key)}
                className="px-3.5 py-1 rounded-full text-[11.5px] font-extrabold transition-colors whitespace-nowrap"
                style={{
                  background: active ? PULSE.text : "transparent",
                  color: active ? PULSE.bg : PULSE.textMuted,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <Section title="Subscriptions">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Kpi
            label="ARR Sold"
            value={data ? formatCents(subs?.arr_cents || 0) : "—"}
            help="New ARR booked in this period"
          />
          <Kpi
            label="Subscriptions Sold"
            value={data ? String(subs?.count || 0) : "—"}
            help="Recurring services booked"
          />
          <Kpi
            label="Avg Sub Value"
            value={data ? formatCents(subs?.avg_value_cents || 0) : "—"}
            help="Annualized per subscription"
          />
        </div>
        <ChartCard
          title="ARR Sold"
          headline={data ? formatCentsShort(subTotal) : "—"}
          footerLeft={
            data ? `Total: ${formatCents(subTotal)}` : ""
          }
          footerRight={
            data ? `Avg: ${formatCents(subAvg)}` : ""
          }
          loading={loading && !data}
          series={subSeries}
        />
      </Section>

      <Section title="One-Time Cleans">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Kpi
            label="Total Revenue"
            value={data ? formatCents(ot?.revenue_cents || 0) : "—"}
            help="From jobs sold in period"
          />
          <Kpi
            label="Jobs Sold"
            value={data ? String(ot?.count || 0) : "—"}
            help={`${ot?.count || 0} total`}
          />
          <Kpi
            label="Avg Job Value"
            value={data ? formatCents(ot?.avg_value_cents || 0) : "—"}
            help="Average per job"
          />
        </div>
        <ChartCard
          title="One-Time Cleans Sold"
          headline={data ? formatCentsShort(otTotal) : "—"}
          footerLeft={data ? `Total: ${formatCents(otTotal)}` : ""}
          footerRight={data ? `Avg: ${formatCents(otAvg)}` : ""}
          loading={loading && !data}
          series={otSeries}
        />
      </Section>

      <Section title="Knocking Stats">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Kpi
            label="Conversion Rate"
            value={
              data ? `${((pins?.conversion_rate || 0) * 100).toFixed(1)}%` : "—"
            }
            help={
              data
                ? `${pins?.counts.sale || 0} sales from ${
                    pins?.qualified || 0
                  } qualified pins`
                : ""
            }
          />
          <Kpi
            label="Total Pins"
            value={data ? String(pins?.total || 0) : "—"}
            help="All pins dropped in this range"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PIN_DEFS.map((p) => {
            const count = pins?.counts[p.key] || 0;
            const total = pins?.total || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <PinTile
                key={p.key}
                color={p.color}
                label={p.label}
                count={count}
                pct={pct}
              />
            );
          })}
        </div>
      </Section>
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
    <section className="space-y-4">
      <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="text-[14px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2.5 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      {help ? (
        <div className="mt-2.5 text-[14px] font-semibold text-zinc-400">
          {help}
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  headline,
  footerLeft,
  footerRight,
  loading,
  series,
}: {
  title: string;
  headline: string;
  footerLeft: string;
  footerRight: string;
  loading: boolean;
  series: Series[];
}) {
  return (
    <section
      className="rounded-2xl p-7"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <h3 className="text-[15px] font-extrabold tracking-tight">{title}</h3>
        <span className="text-[26px] font-black tracking-tight leading-none tabular-nums">
          {headline}
        </span>
      </div>
      {loading ? (
        <div
          className="rounded-xl animate-pulse"
          style={{ height: 260, background: PULSE.bgAlt }}
        />
      ) : (
        <HeroChart days={series} height={260} />
      )}
      <div
        className="mt-4 flex items-center justify-between text-[11.5px] font-extrabold"
        style={{ color: PULSE.textSubtle }}
      >
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </section>
  );
}

function PinTile({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: `${color}1F`,
            border: `1px solid ${color}33`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: color }}
          />
        </span>
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: PULSE.textSubtle }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="text-[28px] font-extrabold tracking-tight leading-none tabular-nums">
        {count}
      </div>
      <div className="text-[14px] font-semibold mt-1.5 text-zinc-400">
        {label}
      </div>
      <div
        className="mt-3 h-1 rounded-full overflow-hidden"
        style={{ background: PULSE.bgAlt }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
