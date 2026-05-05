"use client";

import { ACCENT, useTokens } from "../_theme";
import { Card, CardTitle, EmptyState, PageHeader } from "../_ui";
import type { LeaderRow } from "../_data";

function formatCents(c: number) {
  if (c >= 100000) return `$${(c / 100000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function LeaderboardView({ rows }: { rows: LeaderRow[] }) {
  const t = useTokens();
  const max = Math.max(1, ...rows.map((r) => r.revenueCents));
  const hasAny = rows.some((r) => r.revenueCents > 0 || r.jobs > 0);

  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Last 30 days · ranked by revenue" />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No staff yet"
            subtitle="Add staff to start tracking revenue and jobs by team member."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <circle cx="9" cy="8" r="4" />
                <path d="M2 21a7 7 0 0 1 14 0" />
                <path d="M16 3.5a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" />
              </svg>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardTitle title="Team" subtitle={`${rows.length} member${rows.length === 1 ? "" : "s"}`} />
          {!hasAny ? (
            <EmptyState
              title="No activity in the last 30 days"
              subtitle="Once jobs are scheduled or completed, ranking by revenue will appear here."
            />
          ) : (
            <div className="px-3 pb-3">
              {rows.map((r, i) => {
                const pct = (r.revenueCents / max) * 100;
                return (
                  <div key={r.id} className={`flex items-center gap-4 p-3 rounded-xl ${t.hoverBg}`}>
                    <div className={`text-[13px] font-bold tabular-nums w-6 ${t.muted}`}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className={`w-9 h-9 rounded-full ${t.iconChip} text-[12px] font-bold flex items-center justify-center`}>
                      {initials(r.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[14px] font-bold truncate ${t.text}`}>{r.name}</div>
                      <div className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${t.isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: ACCENT }}
                        />
                      </div>
                    </div>
                    <div className={`text-[12px] tabular-nums font-bold w-20 text-right ${t.muted}`}>
                      {r.jobs} job{r.jobs === 1 ? "" : "s"}
                    </div>
                    <div className={`text-[14px] font-bold tabular-nums w-20 text-right ${t.text}`}>
                      {formatCents(r.revenueCents)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
