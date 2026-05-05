"use client";

import { ACCENT, useTokens } from "./_theme";
import { Card, CardTitle, EmptyState, PageHeader } from "./_ui";
import { SmoothRevenueChart } from "./_chart";
import type { LiveJob, RevenueSummary } from "./_data";

function formatTime(iso: string) {
  const d = new Date(iso);
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const m = d.getMinutes().toString().padStart(2, "0");
  return { time: `${h12}:${m}`, ampm };
}

function formatCents(c: number) {
  if (c >= 100000) return `$${(c / 100000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

export default function DashboardView({
  greeting,
  firstName,
  jobs,
  revenue,
}: {
  greeting: string;
  firstName: string;
  jobs: LiveJob[];
  revenue: RevenueSummary;
}) {
  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Welcome to your dashboard"
      />
      <div className="space-y-6">
        <RevenueCard revenue={revenue} />
        <ScheduleCard jobs={jobs} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InboxCard />
          <TasksCard />
        </div>
      </div>
    </>
  );
}

function RevenueCard({ revenue: _revenue }: { revenue: RevenueSummary }) {
  return (
    <Card>
      <div className="p-6 sm:p-8">
        <SmoothRevenueChart initialRange="1m" />
      </div>
    </Card>
  );
}

function ScheduleCard({ jobs }: { jobs: LiveJob[] }) {
  const t = useTokens();
  return (
    <Card>
      <CardTitle
        title="Today's schedule"
        subtitle={
          jobs.length === 0 ? "No jobs scheduled for today" : `${jobs.length} job${jobs.length === 1 ? "" : "s"} today`
        }
      />
      {jobs.length === 0 ? (
        <EmptyState
          title="Nothing on the calendar"
          subtitle="Today's jobs will appear here once scheduled."
        />
      ) : (
        <div className="px-3 pb-3">
          {jobs.map((j) => {
            const { time, ampm } = formatTime(j.scheduled_at);
            const isOnTheWay = j.status === "in_progress" || j.status === "on_the_way";
            return (
              <div
                key={j.id}
                className={`flex items-center gap-4 p-3 rounded-xl ${t.hoverBg} cursor-pointer`}
              >
                <div className="text-center w-14">
                  <div className={`text-[19px] font-bold tabular-nums leading-none ${t.text}`}>{time}</div>
                  <div className={`text-[10px] ${t.muted} font-bold mt-1 tracking-wider`}>{ampm}</div>
                </div>
                <div className={`w-px h-9 ${t.isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] font-bold truncate ${t.text}`}>{j.customer_name}</div>
                  {j.customer_address && (
                    <div className={`text-[12px] ${t.muted} truncate font-semibold`}>{j.customer_address}</div>
                  )}
                </div>
                {isOnTheWay ? (
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-bold text-white"
                    style={{ background: ACCENT }}
                  >
                    On the way
                  </span>
                ) : (
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize"
                    style={{ background: `${ACCENT}1A`, color: ACCENT }}
                  >
                    {j.status.replace(/_/g, " ")}
                  </span>
                )}
                {j.technician_name && (
                  <div className={`text-[12px] ${t.muted} font-semibold w-24 truncate text-right`}>
                    {j.technician_name}
                  </div>
                )}
                <div className={`text-[14px] font-bold tabular-nums w-16 text-right ${t.text}`}>
                  {formatCents(j.price_cents)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function InboxCard() {
  return (
    <Card>
      <CardTitle title="Inbox" />
      <EmptyState
        title="No recent conversations"
        subtitle="New conversations will appear here."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
      />
    </Card>
  );
}

function TasksCard() {
  const t = useTokens();
  const tabs = ["Upcoming", "Team", "Completed"];
  return (
    <Card>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className={`font-bold tracking-tight text-[15px] ${t.text}`}>Tasks</h3>
          <span className="inline-block mt-1.5 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm">
            {tabs.map((tb, i) => (
              <span key={tb} className={"px-2 py-1 font-semibold text-[12px] " + (i === 0 ? t.text : t.subtle)}>
                {tb}
              </span>
            ))}
          </div>
          <button
            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-lg leading-none"
            style={{ background: ACCENT }}
          >
            +
          </button>
        </div>
      </div>
      <EmptyState
        title="No tasks found"
        subtitle="Tasks help your team stay organized. Create one to get started."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        }
      />
    </Card>
  );
}
