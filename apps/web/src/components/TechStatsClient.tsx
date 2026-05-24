"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PULSE } from "@/components/pulse/theme";
import {
  ScorecardView,
  type Range,
  type TechStats,
} from "@/components/tech-stats/ScorecardView";

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

  const staff = data?.staff ?? null;

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
    <ScorecardView
      staff={staff}
      data={data}
      range={range}
      loading={loading}
      onRangeChange={setRange}
      onSalesClick={() => router.push(`/sales-stats/${staffId}?view=sales`)}
    />
  );
}
