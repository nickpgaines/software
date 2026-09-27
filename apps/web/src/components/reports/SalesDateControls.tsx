"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDay, resolveSalesRange, type SalesRange } from "@/lib/sales-report-range";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ranges: { key: SalesRange; label: string }[] = [
  { key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" },
  { key: "1w", label: "1W" }, { key: "1m", label: "1M" },
  { key: "3m", label: "3M" }, { key: "ytd", label: "YTD" }, { key: "custom", label: "Custom" },
];

export default function SalesDateControls({ onQueryChange }: { onQueryChange: (query: string) => void }) {
  const [range, setRange] = useState<SalesRange>("1m");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [clock, setClock] = useState<{ now: Date; zone: string } | null>(null);
  useEffect(() => {
    const refresh = () => setClock({ now: new Date(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    refresh();
    // Refresh on return to the page and across midnight, not a GPS/polling loop.
    const visible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(visible, 60_000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", refresh); };
  }, []);

  const params = new URLSearchParams({ range, timeZone: clock?.zone || "UTC" });
  if (range === "custom") { params.set("start", start); params.set("end", end); }
  let resolved: ReturnType<typeof resolveSalesRange> | null = null;
  let error: string | null = null;
  if (clock) {
    try { resolved = resolveSalesRange(new URL(`https://forge.invalid/?${params}`), clock.now); }
    catch (e) { error = e instanceof Error ? e.message : "Choose a valid date range."; }
  }
  // Include the selected day so the query changes across local midnight.
  // The API resolves relative presets in the supplied timezone.
  if (resolved && (range === "today" || range === "yesterday")) {
    params.set("start", calendarDay(resolved.start));
    params.set("end", calendarDay(resolved.start));
  }
  const query = clock && resolved ? params.toString() : "";
  useEffect(() => { onQueryChange(query); }, [query, onQueryChange]);

  const firstDay = resolved ? calendarDay(resolved.start) : "";
  // Custom dates are inclusive; relative daily presets are always one day.
  const singleDay = range === "today" || range === "yesterday" || (range === "custom" && start === end && !!resolved);
  const select = (next: SalesRange) => {
    if (next === "custom" && clock && !start) {
      const d = new Date(clock.now); d.setDate(d.getDate() - 30);
      setStart(calendarDay(d)); setEnd(calendarDay(clock.now));
    }
    setRange(next);
  };
  const shiftDay = (delta: number) => {
    if (!firstDay) return;
    const d = new Date(`${firstDay}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    setStart(next); setEnd(next); setRange("custom");
  };

  return <div className="flex flex-col items-end gap-2 max-w-full">
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto gap-1.5 border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-sm font-bold text-zinc-200">
            {ranges.find(r => r.key === range)?.label}<span aria-hidden="true">⌄</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {ranges.map(r => <DropdownMenuItem key={r.key} onSelect={() => select(r.key)}>
            <span className="w-4 inline-block" aria-hidden="true">{range === r.key ? "✓" : ""}</span><span className="ml-1">{r.label}</span>
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      {singleDay && resolved && <div className="flex items-center gap-1 rounded-full border border-line bg-card px-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Previous day" onClick={() => shiftDay(-1)}><ChevronLeft size={16} /></Button>
        <span className="text-xs font-bold text-zinc-200 whitespace-nowrap">{resolved.start.toLocaleDateString(undefined, { timeZone: clock?.zone, month: "short", day: "numeric", year: "numeric" })}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Next day" disabled={firstDay >= (clock ? calendarDay(clock.now) : "")} onClick={() => shiftDay(1)}><ChevronRight size={16} /></Button>
      </div>}
    </div>
    {range === "custom" && <div className="flex flex-wrap justify-end items-center gap-2 text-xs">
      <Input type="date" aria-label="Sales start date" value={start} onChange={e => setStart(e.target.value)} className="h-8 w-36" />
      <span className="text-zinc-500">to</span>
      <Input type="date" aria-label="Sales end date" value={end} onChange={e => setEnd(e.target.value)} className="h-8 w-36" />
    </div>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </div>;
}
