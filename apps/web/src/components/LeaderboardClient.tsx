"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import NewSprintModal from "./NewSprintModal";
import SprintWidget, { type Sprint } from "./SprintWidget";
import { Button } from "@/components/ui/button";
import {
  LeaderboardRankingsView,
  initials,
  money,
  type Range,
  type Row,
  type View,
} from "./leaderboard/LeaderboardRankingsView";

type Resp = {
  range: Range;
  view: View;
  start: string;
  end: string;
  rows: Row[];
};

function todayDateInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function LeaderboardClient({
  currentUser,
  currentStaffId,
  isAdmin,
  canSeeSales = true,
  canSeeTech = true,
}: {
  currentUser: string;
  currentStaffId: number | null;
  isAdmin: boolean;
  canSeeSales?: boolean;
  canSeeTech?: boolean;
}) {
  const initialView: View = canSeeSales ? "sales" : "tech";
  const [view, setView] = useState<View>(initialView);
  const [range, setRange] = useState<Range>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>(todayDateInput());
  const [customOpen, setCustomOpen] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const router = useRouter();
  const goToStats = useCallback(
    (id: number) => {
      if (view === "tech") {
        router.push(`/tech-stats/${id}`);
      } else {
        router.push(`/sales-stats/${id}?view=sales`);
      }
    },
    [router, view]
  );

  const loadSprints = useCallback(async () => {
    try {
      const r = await fetch(`/api/sprints?view=${view}`);
      if (!r.ok) return;
      const j = (await r.json()) as { sprints: Sprint[] };
      setSprints(j.sprints || []);
    } catch {
      // ignore
    }
  }, [view]);

  useEffect(() => {
    loadSprints();
  }, [loadSprints]);

  // Refresh sprint standings periodically so revenue numbers stay current.
  useEffect(() => {
    const t = setInterval(loadSprints, 60_000);
    return () => clearInterval(t);
  }, [loadSprints]);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ view, range });
    if (range === "custom") {
      params.set("from", new Date(`${customFrom}T00:00:00`).toISOString());
      const end = new Date(`${customTo}T00:00:00`);
      end.setDate(end.getDate() + 1);
      params.set("to", end.toISOString());
    }
    fetch(`/api/leaderboard?${params}`)
      .then((r) => r.json())
      .then((d: Resp) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, range, customFrom, customTo]);

  const activeRows = useMemo(
    () => (data ? data.rows.filter((r) => r.job_count > 0) : []),
    [data]
  );

  const total = activeRows.reduce((a, r) => a + r.revenue_cents, 0);
  const totalJobs = activeRows.reduce((a, r) => a + r.job_count, 0);
  const top = activeRows[0] || null;

  const me = useMemo(() => {
    if (!data) return null;
    if (currentStaffId != null) {
      const byId = data.rows.find((r) => r.id === currentStaffId);
      if (byId) return byId;
    }
    const u = currentUser.trim().toLowerCase();
    if (u) {
      const exact = data.rows.find((r) => r.name.trim().toLowerCase() === u);
      if (exact) return exact;
    }
    return null;
  }, [data, currentUser, currentStaffId]);
  const myRank = me ? activeRows.findIndex((r) => r.id === me.id) + 1 : null;
  const meName = me?.name || (currentUser ? currentUser : "You");
  const meRevenue = me?.revenue_cents ?? total;
  const meIsFallback = !me;

  const title = view === "sales" ? "Sales Leaderboard" : "Technician Leaderboard";

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-white">{title}</h1>

      {isAdmin && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={() => setShowNewSprint(true)}
            className="h-auto text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 gap-2 text-zinc-300 font-bold"
          >
            <span className="text-lg leading-none">+</span> Start a sprint
          </Button>
        </div>
      )}

      {sprints.length > 0 && (
        <div className="space-y-3">
          {sprints.map((s) => (
            <SprintWidget
              key={s.id}
              sprint={s}
              isAdmin={isAdmin}
              onDeleted={loadSprints}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          if (me) goToStats(me.id);
          else {
            const el = document.getElementById("rankings");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }
        }}
        className="w-full h-auto text-left flex items-center gap-3 justify-start bg-card border border-line rounded-2xl px-5 py-4 hover:bg-black shadow-sm whitespace-normal"
      >
        <div
          className={
            "w-12 h-12 rounded-full flex items-center justify-center font-semibold text-base overflow-hidden " +
            (me?.photo_url ? "" : "bg-amber-100 text-amber-700")
          }
        >
          {me?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.photo_url}
              alt={meName}
              className="w-full h-full object-cover"
            />
          ) : (
            initials(meName)
          )}
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-white tracking-tight">Your Stats</div>
          <div className="text-sm text-zinc-400 font-bold">
            {money(meRevenue)} {view === "sales" ? "sold" : "cleaned"}
            {myRank
              ? ` · Rank #${myRank}`
              : meIsFallback
              ? " · Add yourself on the Team page to track personal rank"
              : ""}
          </div>
        </div>
        <span className="text-zinc-500 text-2xl leading-none">›</span>
      </Button>

      <LeaderboardRankingsView
        view={view}
        range={range}
        rows={activeRows}
        total={total}
        totalJobs={totalJobs}
        topName={top?.name || null}
        meId={me?.id ?? null}
        customFrom={customFrom}
        customTo={customTo}
        mounted={mounted}
        loading={loading}
        canSeeSales={canSeeSales}
        canSeeTech={canSeeTech}
        onViewChange={setView}
        onRangeChange={(r) => {
          setRange(r);
          setCustomOpen(false);
        }}
        customOpen={customOpen}
        onCustomToggle={() => {
          setRange("custom");
          setCustomOpen((o) => !o);
        }}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onApplyCustom={() => setCustomOpen(false)}
        onRowClick={goToStats}
      />

      {showNewSprint && (
        <NewSprintModal
          view={view}
          onClose={() => setShowNewSprint(false)}
          onCreated={() => {
            setShowNewSprint(false);
            loadSprints();
          }}
        />
      )}
    </div>
  );
}
