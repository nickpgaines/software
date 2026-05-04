"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type Day = { date: string; cents: number };
export type RevenueData = {
  range: "1w" | "1m" | "3m" | "1y";
  label: string;
  start: string;
  end: string;
  days: Day[];
  total_cents: number;
  avg_cents: number;
};

export const ACCENT = "#379CFB";

export function money(cents: number, decimals = 2) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function moneyShort(cents: number) {
  if (cents >= 1_000_000_00) return `$${(cents / 100_000_000).toFixed(1)}M`;
  if (cents >= 100_000) return `$${(cents / 100_000).toFixed(1)}K`;
  return `$${(cents / 100).toFixed(0)}`;
}

export function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function useDailyRevenue(range: "1w" | "1m" | "3m" | "1y" = "1m") {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/revenue?range=${range}`)
      .then((r) => r.json())
      .then((d: RevenueData) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);
  return { data, loading };
}

export function PreviewBar({
  letter,
  name,
  letters,
}: {
  letter: string;
  name: string;
  letters: { key: string; label: string }[];
}) {
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-50">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-950 font-bold">
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight text-zinc-950">
        Reports {letter} · <span style={{ color: ACCENT }}>{name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
        {letters.map((l, i) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <Link href={`/design/reports/${l.key}`} className="hover:text-zinc-950">
              {l.label}
            </Link>
            {i < letters.length - 1 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export const VARIANT_LIST: { key: string; label: string }[] = [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C" },
  { key: "d", label: "D" },
];
