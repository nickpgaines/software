"use client";

import { useEffect, useState } from "react";

type View = "sales" | "tech";

type Standing = {
  staff_id: number;
  name: string;
  photo_url: string | null;
  revenue_cents: number;
  job_count: number;
};

type Prize = {
  id: number;
  sprint_id: number;
  place: number;
  title: string;
};

export type Sprint = {
  id: number;
  name: string;
  description: string | null;
  view: View;
  start_at: string;
  end_at: string;
  prizes: Prize[];
  standings: Standing[];
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function useCountdown(endIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, Date.parse(endIso) - now);
  const days = Math.floor(diff / (24 * 3600 * 1000));
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);
  return { days, hours, minutes, seconds, finished: diff <= 0 };
}

function placeColor(place: number) {
  if (place === 1) return "bg-gradient-to-br from-amber-300 to-amber-500 ring-amber-200";
  if (place === 2) return "bg-gradient-to-br from-slate-300 to-slate-500 ring-line";
  if (place === 3) return "bg-gradient-to-br from-orange-300 to-orange-500 ring-orange-200";
  return "bg-gradient-to-br from-slate-200 to-slate-400 ring-slate-100";
}

export default function SprintWidget({
  sprint,
  isAdmin,
  onDeleted,
}: {
  sprint: Sprint;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const { days, hours, minutes, seconds, finished } = useCountdown(sprint.end_at);
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm(`Delete sprint "${sprint.name}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/sprints/${sprint.id}`, { method: "DELETE" });
      if (r.ok) onDeleted();
    } finally {
      setBusy(false);
    }
  }

  const top = sprint.standings.slice(0, 5);
  const prizesByPlace = new Map<number, string>();
  for (const p of sprint.prizes) prizesByPlace.set(p.place, p.title);

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-xl font-bold text-white">{sprint.name}</h3>
          {sprint.description && (
            <p className="text-sm text-zinc-400 mt-2 font-bold">{sprint.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="inline-flex items-center gap-1 text-sky-600">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="font-semibold">
                {finished ? "Ended" : "Ends in:"}
              </span>
            </span>
            {!finished && (
              <div className="flex items-center gap-1">
                <TimeChip value={days} unit="d" />
                <TimeChip value={hours} unit="h" />
                <TimeChip value={minutes} unit="m" />
                <TimeChip value={seconds} unit="s" />
              </div>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={del}
            disabled={busy}
            className="w-8 h-8 rounded-full border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center"
            aria-label="Delete sprint"
            title="Delete sprint"
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex justify-center mb-4">
        <span className="inline-flex items-center gap-2 bg-sky-50 border border-sky-100 text-sky-700 text-sm font-semibold px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Current Standings
        </span>
      </div>

      {top.length === 0 ? (
        <div className="text-center text-sm text-zinc-500 py-6">
          No standings yet — sales in this window will show up here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {top.map((s, i) => {
            const place = i + 1;
            const prize = prizesByPlace.get(place);
            return (
              <div
                key={s.staff_id}
                className={
                  "rounded-2xl text-white p-4 shadow-md ring-2 " + placeColor(place)
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-full bg-card/30 flex items-center justify-center font-bold">
                    {place}
                  </span>
                  {prize && (
                    <span className="text-xs bg-card/30 rounded-full px-2 py-0.5 font-semibold">
                      {prize}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-card/30 flex items-center justify-center font-semibold overflow-hidden">
                    {s.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photo_url}
                        alt={s.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials(s.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-sm text-white/90 tabular-nums">
                      {money(s.revenue_cents)}
                    </div>
                    <div className="text-xs text-white/80">
                      {s.job_count} {s.job_count === 1 ? "job" : "jobs"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimeChip({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="bg-sky-50 border border-sky-100 text-sky-700 text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums">
      {String(value).padStart(2, "0")}
      {unit}
    </span>
  );
}
