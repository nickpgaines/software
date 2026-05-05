"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type View = "sales" | "tech";
type Duration = "1d" | "1w" | "2w" | "1m" | "custom";

const DURATIONS: { key: Duration; label: string }[] = [
  { key: "1d", label: "1 Day" },
  { key: "1w", label: "1 Week" },
  { key: "2w", label: "2 Weeks" },
  { key: "1m", label: "1 Month" },
  { key: "custom", label: "Custom" },
];

const PLACE_OPTIONS = [
  { value: 1, label: "1st Place" },
  { value: 2, label: "2nd Place" },
  { value: 3, label: "3rd Place" },
  { value: 4, label: "4th Place" },
  { value: 5, label: "5th Place" },
];

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function durationDays(d: Duration): number {
  if (d === "1d") return 1;
  if (d === "1w") return 7;
  if (d === "2w") return 14;
  if (d === "1m") return 30;
  return 7;
}

export default function NewSprintModal({
  view,
  onClose,
  onCreated,
}: {
  view: View;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<Duration>("1w");
  const [start, setStart] = useState(todayInput());
  const [end, setEnd] = useState(addDays(todayInput(), 7));
  const [prizes, setPrizes] = useState<{ place: number; title: string }[]>([
    { place: 1, title: "" },
    { place: 2, title: "" },
    { place: 3, title: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pickDuration(d: Duration) {
    setDuration(d);
    if (d !== "custom") {
      const today = todayInput();
      setStart(today);
      setEnd(addDays(today, durationDays(d)));
    }
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Sprint name is required.");
      return;
    }
    const startMs = Date.parse(`${start}T00:00:00`);
    const endIso = new Date(`${end}T00:00:00`);
    endIso.setDate(endIso.getDate() + 1);
    const endMs = endIso.getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      setError("Choose a valid start and end date.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          view,
          start_at: new Date(startMs).toISOString(),
          end_at: endIso.toISOString(),
          prizes: prizes
            .filter((p) => p.title.trim().length > 0)
            .map((p) => ({ place: p.place, title: p.title.trim() })),
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || "Failed to create sprint.");
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch {
      setError("Failed to create sprint.");
      setSubmitting(false);
    }
  }

  function addPrize() {
    setPrizes((p) => [...p, { place: p.length + 1, title: "" }]);
  }
  function removePrize(i: number) {
    setPrizes((p) => p.filter((_, idx) => idx !== i));
  }
  function updatePrize(i: number, patch: Partial<{ place: number; title: string }>) {
    setPrizes((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f12] rounded-2xl w-full max-w-lg my-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#1f1f24] flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">New Sprint</h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-8 h-8 h-auto p-0 rounded-full hover:bg-black text-zinc-400 flex items-center justify-center"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </Button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <Label className="block text-sm font-extrabold text-white tracking-tight mb-1">
              Sprint Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Sales Competition"
              className="w-full border-[#1f1f24] rounded-full px-4 py-2 h-auto text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          </div>
          <div>
            <Label className="block text-sm font-extrabold text-white tracking-tight mb-1">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the sprint…"
              rows={3}
              className="w-full border-[#1f1f24] rounded-2xl px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          </div>
          <div>
            <Label className="block text-sm font-extrabold text-white tracking-tight mb-2">
              Sprint Duration <span className="text-rose-500">*</span>
            </Label>
            <div className="flex flex-wrap items-center gap-1 bg-black border border-[#1f1f24] rounded-full p-1 text-sm w-fit">
              {DURATIONS.map((d) => (
                <Button
                  key={d.key}
                  variant="ghost"
                  onClick={() => pickDuration(d.key)}
                  className={
                    "px-3 py-1 h-auto rounded-full whitespace-nowrap " +
                    (duration === d.key
                      ? "bg-[#0f0f12] text-white shadow-sm"
                      : "text-zinc-400 hover:text-white")
                  }
                >
                  {d.label}
                </Button>
              ))}
            </div>
            {duration === "custom" && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="block text-xs font-normal uppercase tracking-wide text-zinc-500 mb-1">
                    Start
                  </Label>
                  <Input
                    type="date"
                    value={start}
                    max={end}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full border-[#1f1f24] rounded-full px-3 py-1.5 h-auto text-sm"
                  />
                </div>
                <div>
                  <Label className="block text-xs font-normal uppercase tracking-wide text-zinc-500 mb-1">
                    End
                  </Label>
                  <Input
                    type="date"
                    value={end}
                    min={start}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full border-[#1f1f24] rounded-full px-3 py-1.5 h-auto text-sm"
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-zinc-400 mt-2">
              The sprint will automatically activate on the start date and
              complete on the end date.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="block text-sm font-extrabold text-white tracking-tight">
                Prizes (Optional)
              </Label>
              <Button
                variant="ghost"
                type="button"
                onClick={addPrize}
                className="text-sm bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-full px-3 py-1 h-auto inline-flex items-center gap-1"
              >
                <span className="text-base leading-none">+</span> Add Prize
              </Button>
            </div>
            <div className="space-y-2">
              {prizes.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className={
                      "w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 " +
                      (p.place === 1
                        ? "bg-amber-400"
                        : p.place === 2
                        ? "bg-slate-400"
                        : p.place === 3
                        ? "bg-orange-400"
                        : "bg-[#2a2a32]")
                    }
                  >
                    {p.place}
                  </span>
                  {/* Native <select> retained — no Select primitive migration in this batch */}
                  <select
                    value={p.place}
                    onChange={(e) =>
                      updatePrize(i, { place: Number(e.target.value) })
                    }
                    className="border border-[#1f1f24] rounded-full px-3 py-1.5 text-sm bg-[#0f0f12]"
                  >
                    {PLACE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={p.title}
                    onChange={(e) => updatePrize(i, { title: e.target.value })}
                    placeholder="Prize title (e.g., $500 Bonus)"
                    className="flex-1 border-[#1f1f24] rounded-full px-3 py-1.5 h-auto text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  />
                  {prizes.length > 1 && (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => removePrize(i)}
                      className="text-zinc-500 hover:text-rose-500 px-1 h-auto p-0"
                      aria-label="Remove prize"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#1f1f24] flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 h-auto text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 text-white rounded-full px-4 py-2 h-auto"
          >
            {submitting ? "Creating…" : "Create Sprint"}
          </Button>
        </div>
      </div>
    </div>
  );
}
