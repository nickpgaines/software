"use client";

import { ACCENT, useTokens } from "../_theme";
import { Card, CardTitle, EmptyState, PageHeader } from "../_ui";
import type { LiveJob } from "../_data";

function dayKey(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  const d = new Date(key + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h12}:${m} ${ampm}`;
}

function formatCents(c: number) {
  if (c >= 100000) return `$${(c / 100000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

export default function ScheduleView({ jobs }: { jobs: LiveJob[] }) {
  const t = useTokens();
  const groups = new Map<string, LiveJob[]>();
  for (const j of jobs) {
    const k = dayKey(j.scheduled_at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(j);
  }
  const dayKeys = Array.from(groups.keys()).sort();

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={
          jobs.length === 0
            ? "Nothing scheduled in the next 14 days"
            : `${jobs.length} upcoming job${jobs.length === 1 ? "" : "s"}`
        }
      />

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            title="No upcoming jobs"
            subtitle="Once jobs are scheduled they'll show up here grouped by day."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {dayKeys.map((k) => (
            <Card key={k}>
              <CardTitle title={dayLabel(k)} subtitle={`${groups.get(k)!.length} job${groups.get(k)!.length === 1 ? "" : "s"}`} />
              <div className="px-3 pb-3">
                {groups.get(k)!.map((j) => (
                  <div key={j.id} className={`flex items-center gap-4 p-3 rounded-xl ${t.hoverBg} cursor-pointer`}>
                    <div className={`w-20 text-[13px] tabular-nums font-bold ${t.text}`}>{formatTime(j.scheduled_at)}</div>
                    <div className={`w-px h-9 ${t.isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[14px] font-bold truncate ${t.text}`}>{j.customer_name}</div>
                      {j.customer_address && (
                        <div className={`text-[12px] ${t.muted} truncate font-semibold`}>{j.customer_address}</div>
                      )}
                    </div>
                    <span
                      className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize"
                      style={{ background: `${ACCENT}1A`, color: ACCENT }}
                    >
                      {j.status.replace(/_/g, " ")}
                    </span>
                    {j.technician_name && (
                      <div className={`text-[12px] ${t.muted} font-semibold w-24 truncate text-right`}>
                        {j.technician_name}
                      </div>
                    )}
                    <div className={`text-[14px] font-bold tabular-nums w-16 text-right ${t.text}`}>
                      {formatCents(j.price_cents)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
