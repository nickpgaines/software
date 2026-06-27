"use client";

import { useEffect, useState } from "react";
import { PULSE } from "@/components/pulse/theme";
import { dateLabel, greeting } from "@/components/pulse/format";

// The dashboard is server-rendered (force-dynamic), so a server-side
// `new Date()` resolves in the server's timezone (UTC on Vercel) — which shows
// the wrong time-of-day greeting and can roll the date a day forward for users
// behind UTC (e.g. 5pm Sunday Pacific renders as "Good morning" / "Monday").
// These components compute from the browser's local clock after mount instead.
//
// The initial (pre-mount) render is timezone-neutral so the server HTML and the
// first client render match — no hydration mismatch, and the user never sees a
// wrong time-of-day greeting flash; "Hello" simply resolves to the local
// greeting once mounted. Both components also reserve their final footprint up
// front so filling in the real value after mount cannot shift layout (no CLS).

export function GreetingTitle({ firstName }: { firstName: string }) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  return (
    // Grid-stack the real greeting over an invisible sizing twin that always
    // holds the longest greeting. The cell sizes to the twin, so swapping
    // "Hello" → the real greeting (shorter or equal) never reflows the heading.
    <span className="grid">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        Good afternoon, {firstName}.
      </span>
      <span className="col-start-1 row-start-1">
        {hour === null ? "Hello" : greeting(hour)},{" "}
        <span style={{ color: PULSE.violetVar }}>{firstName}.</span>
      </span>
    </span>
  );
}

export function LocalDateLabel() {
  // Start with a non-breaking space so the kicker reserves its single line of
  // height from first paint; the date (always one line) fills in on mount
  // without nudging the heading below it.
  const [label, setLabel] = useState("\u00A0");
  useEffect(() => {
    setLabel(dateLabel(new Date()));
  }, []);
  return <>{label}</>;
}
