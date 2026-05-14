"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeroChart } from "@/components/pulse/widgets";
import { PULSE } from "@/components/pulse/theme";
import { formatCents, formatCentsShort } from "@/components/pulse/format";

type Range = "today" | "week" | "month" | "year" | "custom";

type Series = { date: string; cents: number };

type TechStats = {
  staff: {
    id: number;
    name: string;
    role: string | null;
    photo_url: string | null;
  };
  range: Range;
  start: string;
  end: string;
  cleans: {
    revenue_cents: number;
    jobs_count: number;
    avg_revenue_cents: number;
    series: Series[];
  };
  upsells: {
    revenue_cents: number;
    avg_cents: number;
    plans_signed: number;
    visits_upsold: number;
    line_count: number;
    series: Series[];
  };
  reviews: {
    count: number;
    avg_rating: number;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
    avg_series: Series[];
    count_series: Series[];
  };
};

const PRESETS: { key: Exclude<Range, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avgCents(series: Series[]) {
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

export default function TechStatsClient({ staffId }: { staffId: number }) {
  const router = useRouter();
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<TechStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ range });
    fetch(`/api/staff/${staffId}/tech-stats?${params}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404
              ? "Technician not found."
              : `Server error (${r.status}).`
          );
        }
        return (await r.json()) as TechStats;
      })
      .then((d) => {
        if (cancelled) return;
        if (!d || !d.staff) {
          setError("Stats unavailable.");
          return;
        }
        setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load stats.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId, range]);

  const staff = data?.staff;
  const cleans = data?.cleans;
  const upsells = data?.upsells;
  const reviews = data?.reviews;

  const headlineCents =
    (cleans?.revenue_cents || 0) + (upsells?.revenue_cents || 0);

  const cleansSeries = cleans?.series ?? [];
  const upsellSeries = upsells?.series ?? [];
  const reviewSeries = reviews?.avg_series ?? [];
  const reviewMaxCents = reviews && reviews.count > 0 ? 500 : 0;

  if (error) {
    return (
      <div className="space-y-6">
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
          className="rounded-2xl px-6 py-10 text-center"
          style={{
            background: PULSE.card,
            border: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <p
            className="text-[15px] font-extrabold tracking-tight"
            style={{ color: PULSE.text }}
          >
            {error}
          </p>
          <p
            className="text-[12px] font-bold mt-2"
            style={{ color: PULSE.textMuted }}
          >
            Try refreshing the page or pick another range.
          </p>
        </div>
      </div>
    );
  }

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
            onClick={() => router.push(`/sales-stats/${staffId}?view=sales`)}
            className="h-auto px-3.5 py-1 rounded-full text-[11.5px] font-extrabold transition-colors"
            style={{
              background: "transparent",
              color: PULSE.textMuted,
            }}
          >
            Sales
          </button>
          <button
            className="h-auto px-3.5 py-1 rounded-full text-[11.5px] font-extrabold"
            style={{ background: PULSE.text, color: PULSE.bg }}
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
              Tech Stats
            </div>
            <h1 className="text-[48px] font-extrabold tracking-tight leading-none tabular-nums">
              {staff?.name || (loading ? "Loading…" : "—")}
              {data && (
                <>
                  {" "}
                  <span style={{ color: PULSE.violetVar }}>
                    {formatCentsShort(headlineCents)}
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
                <span>cleaned + upsold · {formatRange(data.start, data.end)}</span>
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

      <Section title="Cleans">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Kpi
            label="Revenue Cleaned"
            value={data ? formatCents(cleans?.revenue_cents || 0) : "—"}
            help="From jobs cleaned in this period"
          />
          <Kpi
            label="Jobs Cleaned"
            value={data ? String(cleans?.jobs_count || 0) : "—"}
            help={`${cleans?.jobs_count || 0} total`}
          />
          <Kpi
            label="Avg Revenue"
            value={data ? formatCents(cleans?.avg_revenue_cents || 0) : "—"}
            help="Average per job"
          />
        </div>
        <ChartCard
          title="Revenue Cleaned"
          headline={
            data ? formatCentsShort(cleans?.revenue_cents || 0) : "—"
          }
          footerLeft={
            data ? `Total: ${formatCents(cleans?.revenue_cents || 0)}` : ""
          }
          footerRight={data ? `Avg/day: ${formatCents(avgCents(cleansSeries))}` : ""}
          loading={loading && !data}
          series={cleansSeries}
        />
      </Section>

      <Section title="Upsells">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="Upsold Revenue"
            value={data ? formatCents(upsells?.revenue_cents || 0) : "—"}
            help="Revenue from upsell line items"
          />
          <Kpi
            label="Avg Upsell"
            value={data ? formatCents(upsells?.avg_cents || 0) : "—"}
            help="Average per upsell line"
          />
          <Kpi
            label="Plans Signed"
            value={data ? String(upsells?.plans_signed || 0) : "—"}
            help="Subscriptions sold by this tech"
          />
          <Kpi
            label="Visits Upsold"
            value={data ? String(upsells?.visits_upsold || 0) : "—"}
            help={`${upsells?.line_count || 0} upsell lines`}
          />
        </div>
        <ChartCard
          title="Upsold Revenue"
          headline={
            data ? formatCentsShort(upsells?.revenue_cents || 0) : "—"
          }
          footerLeft={
            data
              ? `Total: ${formatCents(upsells?.revenue_cents || 0)}`
              : ""
          }
          footerRight={
            data ? `Avg/day: ${formatCents(avgCents(upsellSeries))}` : ""
          }
          loading={loading && !data}
          series={upsellSeries}
        />
      </Section>

      <Section title="Reviews">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Kpi
            label="Reviews Gotten"
            value={data ? String(reviews?.count || 0) : "—"}
            help="Customer reviews left in this range"
          />
          <Kpi
            label="Avg Rating"
            value={
              data
                ? reviews && reviews.count > 0
                  ? `${reviews.avg_rating.toFixed(1)} ★`
                  : "—"
                : "—"
            }
            help={
              data && reviews && reviews.count > 0
                ? `Across ${reviews.count} review${
                    reviews.count === 1 ? "" : "s"
                  }`
                : "No reviews yet"
            }
          />
        </div>
        <div className="grid grid-cols-5 gap-3">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = reviews?.distribution?.[String(star) as "1"] || 0;
            const total = reviews?.count || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <RatingTile
                key={star}
                star={star}
                count={count}
                pct={pct}
              />
            );
          })}
        </div>
        <ChartCard
          title="Avg Rating Over Time"
          headline={
            data && reviews && reviews.count > 0
              ? `${reviews.avg_rating.toFixed(1)} ★`
              : "—"
          }
          footerLeft={
            data
              ? `${reviews?.count || 0} review${
                  (reviews?.count || 0) === 1 ? "" : "s"
                }`
              : ""
          }
          footerRight=""
          loading={loading && !data}
          series={reviewSeries}
          maxCentsHint={reviewMaxCents}
          formatHeadlineCents={(c) => `${(c / 100).toFixed(1)} ★`}
          emptyLabel={
            data && (!reviews || reviews.count === 0)
              ? "No reviews in this range"
              : undefined
          }
        />
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
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div
        className="text-[13px] font-bold mb-2 text-zinc-500"
        style={{ color: PULSE.textSubtle }}
      >
        {label}
      </div>
      <div className="text-[28px] font-black tracking-tight leading-none tabular-nums">
        {value}
      </div>
      {help ? (
        <div
          className="text-[13px] font-bold mt-2"
          style={{ color: PULSE.textMuted }}
        >
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
  emptyLabel,
}: {
  title: string;
  headline: string;
  footerLeft: string;
  footerRight: string;
  loading: boolean;
  series: Series[];
  maxCentsHint?: number;
  formatHeadlineCents?: (c: number) => string;
  emptyLabel?: string;
}) {
  const isEmpty = series.length === 0 || series.every((p) => p.cents === 0);
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
      ) : emptyLabel && isEmpty ? (
        <div
          className="flex items-center justify-center rounded-xl text-[13px] font-extrabold"
          style={{ height: 260, color: PULSE.textDim, background: PULSE.bgAlt }}
        >
          {emptyLabel}
        </div>
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

function RatingTile({
  star,
  count,
  pct,
}: {
  star: 1 | 2 | 3 | 4 | 5;
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
          className="text-[12px] font-extrabold tabular-nums"
          style={{ color: PULSE.textMuted }}
        >
          {star} ★
        </span>
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: PULSE.textSubtle }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="text-[28px] font-black tracking-tight leading-none tabular-nums">
        {count}
      </div>
      <div
        className="mt-3 h-1 rounded-full overflow-hidden"
        style={{ background: PULSE.bgAlt }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: PULSE.violet,
          }}
        />
      </div>
    </div>
  );
}
