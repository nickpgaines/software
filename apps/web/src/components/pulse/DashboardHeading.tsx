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
// greeting once mounted.

export function GreetingTitle({ firstName }: { firstName: string }) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  return (
    <>
      {hour === null ? "Hello" : greeting(hour)},{" "}
      <span style={{ color: PULSE.violetVar }}>{firstName}.</span>
    </>
  );
}

export function LocalDateLabel() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(dateLabel(new Date()));
  }, []);
  return <>{label}</>;
}
