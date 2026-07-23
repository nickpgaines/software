"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Job = {
  id: number;
  scheduled_at: string;
  price_cents: number;
  status: string;
  customer_name: string;
  customer_address: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClasses(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "cancelled") return "bg-rose-100 text-rose-700";
  return "bg-sky-100 text-sky-700";
}

function statusLabel(status: string) {
  if (!status) return "Scheduled";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TodaySchedule({ initialJobs }: { initialJobs: Job[] }) {
  const [offset, setOffset] = useState(0);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  // First effect run renders the server-rendered seed, so its fetch (and all
  // focus refetches) run silently in the background — no loading flash.
  const seededRef = useRef(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  currentDate.setDate(currentDate.getDate() + offset);
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // Always fetch fresh jobs for the shown day — the server-rendered seed goes
  // stale as soon as a job is rescheduled or deleted elsewhere. Also refetch
  // whenever the app returns to the foreground.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      from: currentDate.toISOString(),
      to: nextDate.toISOString(),
    });

    async function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/jobs?${params}`);
        if (!res.ok) return;
        const j = (await res.json()) as Job[];
        if (!cancelled) setJobs(j);
      } catch {
        // Keep what's shown; the next focus refetch will retry.
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }

    const isSeedRun = seededRef.current;
    seededRef.current = false;
    load(!isSeedRun);

    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      load(false);
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
    // currentDate/nextDate derive from offset; offset is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  return (
    <div className="bg-card border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOffset(offset - 1)}
            className="w-8 h-8 rounded-full text-zinc-400 hover:bg-black hover:text-zinc-400"
            aria-label="Previous day"
          >
            ‹
          </Button>
          <h3
            className="font-extrabold text-white tracking-tight text-lg"
            suppressHydrationWarning
          >
            {mounted ? formatDay(currentDate) : ""}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOffset(offset + 1)}
            className="w-8 h-8 rounded-full text-zinc-400 hover:bg-black hover:text-zinc-400"
            aria-label="Next day"
          >
            ›
          </Button>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOffset(0)}
          className="w-8 h-8 rounded bg-transparent border-line text-zinc-400 hover:bg-black hover:text-zinc-400"
          title="Today"
          aria-label="Jump to today"
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
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </Button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            No jobs scheduled.
          </div>
        ) : (
          <ul className="space-y-5">
            {jobs.map((j) => (
              <li key={j.id}>
                <div
                  className="text-sm text-zinc-400 font-bold border-b border-line pb-2 mb-2"
                  suppressHydrationWarning
                >
                  {mounted ? formatTime(j.scheduled_at) : ""}
                </div>
                <div className="border border-line rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4 text-zinc-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white tracking-tight truncate">
                      Window Cleaning
                    </div>
                    <div className="text-sm text-zinc-400 font-bold truncate">
                      {j.customer_name}
                      {j.customer_address ? ` · ${j.customer_address}` : ""}
                    </div>
                  </div>
                  <span
                    className={
                      "text-xs px-2 py-1 rounded-md font-bold " +
                      statusClasses(j.status)
                    }
                  >
                    {statusLabel(j.status)}
                  </span>
                  <span className="font-extrabold text-white tracking-tight tabular-nums">
                    {money(j.price_cents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
