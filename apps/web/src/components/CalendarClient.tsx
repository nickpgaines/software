"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmployeeSchedulingModal from "./EmployeeSchedulingModal";

type Job = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  scheduled_at: string;
  end_time: string | null;
  duration_minutes: number;
  price_cents: number;
  status: string;
  anytime: number;
  job_status?:
    | "scheduled"
    | "in_progress"
    | "completed_unpaid"
    | "completed_partial"
    | "completed_paid";
};

type View = "day" | "week" | "month";

const DAY_MS = 86_400_000;
const HOUR_PX = 56;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 21;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i
);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}

function formatRange(start: Date, end: Date) {
  const sM = start.toLocaleString(undefined, { month: "short" });
  const eM = end.toLocaleString(undefined, { month: "short" });
  if (sM === eM) {
    return `${sM} ${start.getDate()} – ${end.getDate()}`;
  }
  return `${sM} ${start.getDate()} – ${eM} ${end.getDate()}`;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function blockTop(d: Date) {
  const minutes = d.getHours() * 60 + d.getMinutes() - DAY_START_HOUR * 60;
  return (minutes / 60) * HOUR_PX;
}

function blockHeight(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(28, (ms / 3_600_000) * HOUR_PX);
}

export default function CalendarClient() {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState<Date>(new Date());
  const [schedulingOpen, setSchedulingOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const range = useMemo(() => {
    if (view === "day") {
      return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
    }
    if (view === "month") {
      const start = startOfMonth(cursor);
      const end = addDays(endOfMonth(cursor), 1);
      const gridStart = startOfWeek(start);
      const gridEnd = addDays(startOfWeek(end), 7);
      return { start: gridStart, end: gridEnd };
    }
    const start = startOfWeek(cursor);
    return { start, end: addDays(start, 7) };
  }, [view, cursor]);

  useEffect(() => {
    const params = new URLSearchParams({
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    });
    fetch(`/api/jobs?${params}`)
      .then((r) => r.json())
      .then((js: Job[]) => setJobs(js));
  }, [range.start.getTime(), range.end.getTime()]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.customer_name.toLowerCase().includes(q) ||
        (j.customer_address || "").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  function navigate(delta: number) {
    if (view === "day") setCursor(addDays(cursor, delta));
    else if (view === "month") {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + delta);
      setCursor(startOfMonth(next));
    } else setCursor(addDays(cursor, delta * 7));
  }

  const navLabel = useMemo(() => {
    if (view === "day") {
      return cursor.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
    if (view === "month") {
      return cursor.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }
    const start = startOfWeek(cursor);
    return formatRange(start, addDays(start, 6));
  }, [view, cursor]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[40px] font-extrabold tracking-tight leading-none text-white">Schedule</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Drag, plan, and dispatch your jobs.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-black rounded-full p-1 text-sm">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                "px-4 py-1.5 rounded-full transition capitalize " +
                (view === v
                  ? "bg-[#0f0f12] text-white shadow-sm"
                  : "text-zinc-400 hover:text-white")
              }
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full sm:w-72">
          <input
            type="search"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0f0f12] border border-[#1f1f24] rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSchedulingOpen(true)}
            className="inline-flex items-center gap-2 border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-sm text-zinc-300 font-bold"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Employee Scheduling
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-sm text-zinc-300 font-bold"
            title="Coming soon"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Route Optimization
          </button>
          <Link
            href="/schedule/new"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-2 text-sm font-medium shadow-sm"
          >
            <span className="text-base leading-none">+</span> New Job
          </Link>
        </div>
      </div>

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl overflow-hidden">
        {view === "week" && (
          <WeekView
            start={startOfWeek(cursor)}
            jobs={filtered}
            now={now}
          />
        )}
        {view === "day" && (
          <DayView day={startOfDay(cursor)} jobs={filtered} now={now} />
        )}
        {view === "month" && (
          <MonthView
            cursor={cursor}
            jobs={filtered}
            onPickDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 bg-[#0f0f12] border border-[#1f1f24] rounded-full px-2 py-1 text-sm text-zinc-300 font-bold">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full hover:bg-black flex items-center justify-center"
            aria-label="Previous"
          >
            ‹
          </button>
          <span className="px-3 font-medium">{navLabel}</span>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-full hover:bg-black flex items-center justify-center"
            aria-label="Next"
          >
            ›
          </button>
          <button
            onClick={() => setCursor(startOfDay(new Date()))}
            className="ml-1 px-3 py-1 rounded-full text-xs text-zinc-400 hover:text-white hover:bg-black"
          >
            Today
          </button>
        </div>
      </div>

      <EmployeeSchedulingModal
        open={schedulingOpen}
        onClose={() => setSchedulingOpen(false)}
        initialDate={cursor}
      />
    </div>
  );
}

function NowLine({ now }: { now: Date }) {
  const top =
    ((now.getHours() * 60 + now.getMinutes() - DAY_START_HOUR * 60) / 60) *
    HOUR_PX;
  if (
    now.getHours() < DAY_START_HOUR ||
    now.getHours() >= DAY_END_HOUR
  )
    return null;
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <span className="-ml-12 w-12 text-right pr-2 text-[10px] font-medium text-zinc-400">
          {now.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <div className="flex-1 flex items-center">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <div className="flex-1 h-px bg-slate-400" />
        </div>
      </div>
    </div>
  );
}

function jobsByDay(jobs: Job[], days: Date[]) {
  return days.map((d) =>
    jobs.filter((j) => sameDay(new Date(j.scheduled_at), d))
  );
}

// Map the unified job_status (server-computed) to colors. Cancelled
// is handled separately because it's not a unified-status state.
function jobStatusColors(job: Job) {
  if (job.status === "cancelled") {
    return "bg-black border-[#1f1f24] text-zinc-400 line-through border-l-4 border-l-slate-400";
  }
  switch (job.job_status) {
    case "completed_paid":
      return "bg-emerald-50 border-emerald-200 text-emerald-900 border-l-4 border-l-emerald-500";
    case "completed_partial":
      return "bg-amber-50 border-amber-200 text-amber-900 border-l-4 border-l-amber-500";
    case "completed_unpaid":
      return "bg-rose-50 border-rose-200 text-rose-900 border-l-4 border-l-rose-500";
    case "in_progress":
      return "bg-amber-50 border-amber-200 text-amber-900 border-l-4 border-l-amber-500";
    case "scheduled":
    default:
      return "bg-black border-[#1f1f24] text-zinc-300 border-l-4 border-l-slate-300";
  }
}

function jobInterval(j: Job): { startMs: number; endMs: number } {
  const startMs = new Date(j.scheduled_at).getTime();
  const endMs = j.end_time
    ? new Date(j.end_time).getTime()
    : startMs + (j.duration_minutes || 60) * 60_000;
  return { startMs, endMs: Math.max(endMs, startMs + 1) };
}

// Leftmost-free-lane packing. For each event (sorted by start, then id),
// pick the smallest lane index whose currently-active event has already
// ended. Returns a per-job { lane, lanes } map where `lanes` is the max
// concurrent overlap that includes this job — so two events that don't
// overlap each other but each overlap a third are all rendered at 1/3.
type LaneInfo = { lane: number; lanes: number };
function assignLanes(jobs: Job[]): Map<number, LaneInfo> {
  const sorted = [...jobs].sort((a, b) => {
    const aStart = new Date(a.scheduled_at).getTime();
    const bStart = new Date(b.scheduled_at).getTime();
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });
  const intervals = sorted.map((j) => ({ id: j.id, ...jobInterval(j) }));
  const laneEnds: number[] = []; // laneEnds[i] = endMs of last job placed in lane i
  const laneOf = new Map<number, number>();
  for (const it of intervals) {
    let lane = laneEnds.findIndex((end) => end <= it.startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMs);
    } else {
      laneEnds[lane] = it.endMs;
    }
    laneOf.set(it.id, lane);
  }
  // Compute the cluster size (max concurrent count) covering each event.
  const result = new Map<number, LaneInfo>();
  for (const a of intervals) {
    let maxConcurrent = 1;
    for (const b of intervals) {
      if (a.id === b.id) continue;
      // Two intervals overlap if neither ends before the other starts.
      if (a.startMs < b.endMs && b.startMs < a.endMs) {
        // Reachable cluster: count via simple BFS through transitively-
        // overlapping events that share a time window with `a`.
        // For typical day-views this set is tiny; a quadratic walk is fine.
        // (We approximate by counting all overlappers of `a` plus 1.)
        maxConcurrent = Math.max(maxConcurrent, 2);
      }
    }
    // More accurate: max simultaneous events at any instant within `a`'s
    // span. Sweep the boundary points of overlappers.
    const boundaries = new Set<number>([a.startMs, a.endMs]);
    for (const b of intervals) {
      if (a.id === b.id) continue;
      if (a.startMs < b.endMs && b.startMs < a.endMs) {
        boundaries.add(Math.max(b.startMs, a.startMs));
        boundaries.add(Math.min(b.endMs, a.endMs));
      }
    }
    for (const t of boundaries) {
      let count = 0;
      for (const b of intervals) {
        if (b.startMs <= t && t < b.endMs) count++;
      }
      if (count > maxConcurrent) maxConcurrent = count;
    }
    result.set(a.id, { lane: laneOf.get(a.id) ?? 0, lanes: maxConcurrent });
  }
  return result;
}

function JobBlock({
  job,
  laneInfo,
}: {
  job: Job;
  laneInfo?: LaneInfo;
}) {
  const start = new Date(job.scheduled_at);
  const end = job.end_time
    ? new Date(job.end_time)
    : new Date(start.getTime() + (job.duration_minutes || 60) * 60_000);
  const top = blockTop(start);
  const height = blockHeight(start, end);
  const titleTime = `${timeLabel(start.toISOString())} – ${timeLabel(
    end.toISOString()
  )}`;
  const colors = jobStatusColors(job);

  const lanes = laneInfo?.lanes ?? 1;
  const lane = laneInfo?.lane ?? 0;
  const stacked = lanes > 1;
  // Reserve a small gap between adjacent cards in the same time slot
  // (4px, expressed as percentage of the column).
  const gapPct = stacked ? 1 : 0;
  const widthPct = 100 / lanes - gapPct * 2;
  const leftPct = lane * (100 / lanes) + gapPct;

  return (
    <Link
      href={`/schedule/${job.id}`}
      className={
        "absolute rounded-lg border px-2 py-1.5 text-xs shadow-sm hover:shadow transition overflow-hidden " +
        colors
      }
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: stacked ? `${leftPct}%` : "4px",
        right: stacked ? undefined : "4px",
        width: stacked ? `${widthPct}%` : undefined,
      }}
    >
      <div className="font-semibold truncate">{job.customer_name}</div>
      <div className="opacity-75 truncate">Window Cleaning</div>
      {!stacked && <div className="opacity-75 truncate">{titleTime}</div>}
      <div className="opacity-90 font-semibold">{money(job.price_cents)}</div>
    </Link>
  );
}

function AnytimeBlock({ job }: { job: Job }) {
  return (
    <Link
      href={`/schedule/${job.id}`}
      className="block rounded-lg border border-dashed border-cyan-300 bg-cyan-50/40 px-2 py-1 text-xs text-cyan-900 mb-1"
    >
      <span className="font-semibold">{job.customer_name}</span>
      <span className="opacity-75"> · Anytime · {money(job.price_cents)}</span>
    </Link>
  );
}

function WeekView({
  start,
  jobs,
  now,
}: {
  start: Date;
  jobs: Job[];
  now: Date;
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start.getTime()]
  );
  const today = startOfDay(now);
  const buckets = jobsByDay(jobs, days);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-[#1f1f24]">
          <div />
          {days.map((d) => {
            const isToday = sameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className={
                  "px-3 py-2 text-center text-xs " +
                  (isToday ? "text-white bg-black" : "text-zinc-400")
                }
              >
                <div className="uppercase tracking-wide">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div
                  className={
                    "text-[15px] font-extrabold tracking-tight mt-0.5 " +
                    (isToday ? "text-white" : "text-white")
                  }
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[64px_repeat(7,1fr)] grid-rows-1">
          <div className="border-r border-[#1f1f24]">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: `${HOUR_PX}px` }}
                className="text-[10px] text-zinc-500 pr-2 text-right -translate-y-1.5"
              >
                {formatHour(h)}
              </div>
            ))}
          </div>
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            const dayJobs = buckets[i];
            const timed = dayJobs.filter((j) => !j.anytime);
            const anytime = dayJobs.filter((j) => j.anytime);
            const lanes = assignLanes(timed);
            return (
              <div
                key={d.toISOString()}
                className={
                  "relative border-r border-[#1f1f24] last:border-r-0 " +
                  (isToday ? "bg-black" : "")
                }
                style={{ height: `${HOURS.length * HOUR_PX}px` }}
              >
                {HOURS.map((h, hi) => (
                  <div
                    key={h}
                    className="border-b border-[#1f1f24]"
                    style={{ height: `${HOUR_PX}px` }}
                  />
                ))}
                {anytime.length > 0 && (
                  <div className="absolute top-1 left-1 right-1 z-10">
                    {anytime.map((j) => (
                      <AnytimeBlock key={j.id} job={j} />
                    ))}
                  </div>
                )}
                {timed.map((j) => (
                  <JobBlock
                    key={j.id}
                    job={j}
                    laneInfo={lanes.get(j.id)}
                  />
                ))}
                {isToday && <NowLine now={now} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayView({
  day,
  jobs,
  now,
}: {
  day: Date;
  jobs: Job[];
  now: Date;
}) {
  const dayJobs = jobs.filter((j) => sameDay(new Date(j.scheduled_at), day));
  const timed = dayJobs.filter((j) => !j.anytime);
  const anytime = dayJobs.filter((j) => j.anytime);
  const lanes = assignLanes(timed);
  const isToday = sameDay(day, startOfDay(now));
  return (
    <div className="grid grid-cols-[80px_1fr]">
      <div className="border-r border-[#1f1f24] pt-3">
        {HOURS.map((h) => (
          <div
            key={h}
            style={{ height: `${HOUR_PX}px` }}
            className="text-xs text-zinc-500 pr-3 text-right -translate-y-1.5"
          >
            {formatHour(h)}
          </div>
        ))}
      </div>
      <div
        className={"relative " + (isToday ? "bg-black" : "")}
        style={{ height: `${HOURS.length * HOUR_PX}px` }}
      >
        {HOURS.map((h) => (
          <div
            key={h}
            className="border-b border-[#1f1f24]"
            style={{ height: `${HOUR_PX}px` }}
          />
        ))}
        {anytime.length > 0 && (
          <div className="absolute top-1 left-2 right-2 z-10">
            {anytime.map((j) => (
              <AnytimeBlock key={j.id} job={j} />
            ))}
          </div>
        )}
        {timed.map((j) => (
          <JobBlock key={j.id} job={j} laneInfo={lanes.get(j.id)} />
        ))}
        {isToday && <NowLine now={now} />}
      </div>
    </div>
  );
}

function MonthView({
  cursor,
  jobs,
  onPickDay,
}: {
  cursor: Date;
  jobs: Job[];
  onPickDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = startOfDay(new Date());
  const buckets = jobsByDay(jobs, days);
  const weekDayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[#1f1f24] bg-black">
        {weekDayHeaders.map((d) => (
          <div
            key={d}
            className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 uppercase tracking-wide text-center py-2"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const items = buckets[i];
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={
                "border-b border-r border-[#1f1f24] last:border-r-0 text-left p-2 min-h-[110px] hover:bg-black transition " +
                (inMonth ? "" : "bg-black/40 text-zinc-500 ") +
                (isToday ? "bg-black" : "")
              }
            >
              <div
                className={
                  "text-sm font-semibold mb-1 " +
                  (isToday ? "text-white" : "")
                }
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((j) => (
                  <div
                    key={j.id}
                    className="text-[11px] truncate rounded px-1.5 py-0.5 bg-cyan-100 text-cyan-900"
                  >
                    {timeLabel(j.scheduled_at)} {j.customer_name}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[11px] text-zinc-500">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
