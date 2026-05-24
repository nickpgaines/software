/**
 * Marketing screenshot — week-view calendar.
 *
 * Static, server-compatible visual representation of `CalendarClient`'s
 * `WeekView` (see `apps/web/src/components/CalendarClient.tsx:844`). The
 * live client fetches `/api/jobs` and is ~1500 lines of stateful logic;
 * this is a hand-rolled facsimile that LOOKS like the real surface but
 * carries no behaviour. No state, no client directives.
 *
 * Visual language mirrors the dashboard primitives in
 * `apps/web/src/components/pulse/widgets.tsx` — rounded-2xl card on
 * `PULSE.card`, 1px `PULSE.cardBorder`, `tracking-tight` headlines,
 * Inter `font-extrabold` / `font-black`. Job colors are pulled from the
 * same Tailwind palette the live `jobStatusColors()` uses (emerald for
 * completed_paid, amber for in_progress/completed_partial, technician
 * blues for scheduled).
 */

import { PULSE } from "@/components/pulse/theme";

/* --------------------------------------------------------------------- */
/*  Constants matching CalendarClient                                    */
/* --------------------------------------------------------------------- */

// Slimmer than the live `HOUR_PX = 56` so the screenshot fits on a
// marketing card without dominating the viewport.
const HOUR_PX = 44;
const START_HOUR = 7; // 7 AM
const END_HOUR = 18; // 6 PM (inclusive label)
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

function formatHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}

function formatTimeRange(startH: number, startM: number, endH: number, endM: number) {
  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(startH, startM)} – ${fmt(endH, endM)}`;
}

/* --------------------------------------------------------------------- */
/*  Seeded week + job blocks                                             */
/* --------------------------------------------------------------------- */

// Days are labelled "Sun … Sat" with a numeric date. The dates are
// hard-coded so the screenshot is deterministic in SSR — no Date.now().
const DAYS = [
  { weekday: "Sun", date: 19 },
  { weekday: "Mon", date: 20 },
  { weekday: "Tue", date: 21 },
  { weekday: "Wed", date: 22, isToday: true },
  { weekday: "Thu", date: 23 },
  { weekday: "Fri", date: 24 },
  { weekday: "Sat", date: 25 },
];

type JobBlock = {
  dayIndex: number;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  customer: string;
  service: string;
  price: string;
  // Tailwind utility classes — sampled from `jobStatusColors` in
  // `CalendarClient.tsx:687`. Three buckets: emerald (paid),
  // amber (in-progress / partial), and a calm blue/sky for scheduled.
  tone: "emerald" | "amber" | "sky" | "violet";
};

const JOBS: JobBlock[] = [
  {
    dayIndex: 0,
    startH: 9,
    startM: 0,
    endH: 10,
    endM: 30,
    customer: "Hannah Vargas",
    service: "Window Cleaning",
    price: "$240",
    tone: "sky",
  },
  {
    dayIndex: 1,
    startH: 8,
    startM: 0,
    endH: 9,
    endM: 30,
    customer: "Brennan Group",
    service: "Recurring Maintenance",
    price: "$185",
    tone: "emerald",
  },
  {
    dayIndex: 1,
    startH: 13,
    startM: 0,
    endH: 15,
    endM: 0,
    customer: "Cypress Loft",
    service: "Deep Clean",
    price: "$420",
    tone: "amber",
  },
  {
    dayIndex: 2,
    startH: 10,
    startM: 0,
    endH: 11,
    endM: 30,
    customer: "Mira Patel",
    service: "Window Cleaning",
    price: "$220",
    tone: "sky",
  },
  {
    dayIndex: 2,
    startH: 14,
    startM: 30,
    endH: 16,
    endM: 0,
    customer: "Atlas Realty",
    service: "Screen Repair",
    price: "$160",
    tone: "violet",
  },
  {
    dayIndex: 3,
    startH: 8,
    startM: 30,
    endH: 10,
    endM: 0,
    customer: "Mountain View Window Co.",
    service: "Recurring Maintenance",
    price: "$295",
    tone: "emerald",
  },
  {
    dayIndex: 3,
    startH: 12,
    startM: 0,
    endH: 13,
    endM: 30,
    customer: "Lakeside Diner",
    service: "Storefront Wash",
    price: "$140",
    tone: "sky",
  },
  {
    dayIndex: 3,
    startH: 15,
    startM: 0,
    endH: 17,
    endM: 0,
    customer: "Eastwood Estate",
    service: "Deep Clean",
    price: "$540",
    tone: "amber",
  },
  {
    dayIndex: 4,
    startH: 9,
    startM: 30,
    endH: 11,
    endM: 0,
    customer: "Rivera Family",
    service: "Window Cleaning",
    price: "$260",
    tone: "sky",
  },
  {
    dayIndex: 4,
    startH: 13,
    startM: 30,
    endH: 15,
    endM: 30,
    customer: "Bayside Office",
    service: "Commercial Route",
    price: "$680",
    tone: "emerald",
  },
  {
    dayIndex: 5,
    startH: 10,
    startM: 0,
    endH: 11,
    endM: 30,
    customer: "Old Mill Café",
    service: "Storefront Wash",
    price: "$165",
    tone: "violet",
  },
  {
    dayIndex: 6,
    startH: 11,
    startM: 0,
    endH: 12,
    endM: 30,
    customer: "Sutton Residence",
    service: "Window Cleaning",
    price: "$210",
    tone: "sky",
  },
];

/* --------------------------------------------------------------------- */
/*  Tone → Tailwind classes                                              */
/* --------------------------------------------------------------------- */

// Mirrors the `bg-* border-* text-* border-l-4 border-l-*` shape from
// `jobStatusColors` in CalendarClient.
const TONE_CLASSES: Record<JobBlock["tone"], string> = {
  emerald: "bg-emerald-500/15 border-emerald-500/30 border-l-emerald-400",
  amber: "bg-amber-500/15 border-amber-500/30 border-l-amber-400",
  sky: "bg-sky-500/15 border-sky-500/30 border-l-sky-400",
  violet: "bg-violet-500/15 border-violet-500/30 border-l-violet-400",
};

/* --------------------------------------------------------------------- */
/*  KPI chip                                                             */
/* --------------------------------------------------------------------- */

function KpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
      style={{
        background: PULSE.bgAlt,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <span
        className="text-[11px] font-extrabold tracking-tight"
        style={{ color: PULSE.textSubtle }}
      >
        {label}
      </span>
      <span
        className="text-[12px] font-black tracking-tight tabular-nums"
        style={{ color: PULSE.text }}
      >
        {value}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*  Component                                                            */
/* --------------------------------------------------------------------- */

export function ScheduleScreenshot() {
  return (
    <section
      className="w-full rounded-2xl p-6"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      {/* KPI strip ------------------------------------------------------ */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <KpiChip label="Today" value="14 jobs" />
        <KpiChip label="This Week" value="67 jobs" />
        <KpiChip label="Avg Ticket" value="$185" />
      </div>

      {/* Header row ----------------------------------------------------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Schedule
          </div>
          <h3
            className="mt-1 text-[22px] font-extrabold tracking-tight"
            style={{ color: PULSE.text }}
          >
            Week of Apr 19
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* "Today" button */}
          <div
            className="inline-flex h-9 items-center rounded-full px-4 text-[12px] font-extrabold tracking-tight"
            style={{
              background: PULSE.bgAlt,
              border: `1px solid ${PULSE.cardBorder}`,
              color: PULSE.text,
            }}
          >
            Today
          </div>
          {/* Day / Week / Month pill group — same pattern as the
              chart-card range pill bar (`widgets.tsx:436`). */}
          <div
            className="inline-flex items-center gap-1 rounded-full p-1"
            style={{
              background: PULSE.bgAlt,
              border: `1px solid ${PULSE.cardBorder}`,
            }}
          >
            <span
              className="rounded-full px-3 py-1 text-[11.5px] font-extrabold tracking-tight"
              style={{ color: PULSE.textMuted }}
            >
              Day
            </span>
            <span
              className="rounded-full px-3 py-1 text-[11.5px] font-extrabold tracking-tight"
              style={{
                background: PULSE.text,
                color: PULSE.bg,
              }}
            >
              Week
            </span>
            <span
              className="rounded-full px-3 py-1 text-[11.5px] font-extrabold tracking-tight"
              style={{ color: PULSE.textMuted }}
            >
              Month
            </span>
          </div>
        </div>
      </div>

      {/* Calendar grid -------------------------------------------------- */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ border: `1px solid ${PULSE.cardBorder}` }}
      >
        {/* Day header row */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `64px repeat(7, minmax(0, 1fr))`,
            borderBottom: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <div />
          {DAYS.map((d, i) => (
            <div
              key={d.weekday}
              className="px-3 py-2 text-center"
              style={{
                background: d.isToday ? PULSE.bg : "transparent",
                borderLeft: i === 0 ? "none" : `1px solid ${PULSE.cardBorder}`,
              }}
            >
              <div
                className="text-[11px] font-extrabold tracking-tight"
                style={{
                  color: d.isToday ? PULSE.text : PULSE.textMuted,
                }}
              >
                {d.weekday}
              </div>
              <div
                className="mt-0.5 text-[15px] font-extrabold tracking-tight tabular-nums"
                style={{ color: PULSE.text }}
              >
                {d.date}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid + day columns */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `64px repeat(7, minmax(0, 1fr))`,
            background: PULSE.bg,
          }}
        >
          {/* Time gutter */}
          <div
            style={{
              borderRight: `1px solid ${PULSE.cardBorder}`,
              height: `${GRID_HEIGHT}px`,
            }}
          >
            {HOURS.slice(0, -1).map((h) => (
              <div
                key={h}
                className="pr-2 text-right text-[10px] font-bold"
                style={{
                  height: `${HOUR_PX}px`,
                  color: PULSE.textDim,
                  transform: "translateY(-6px)",
                }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map((d, dayIndex) => {
            const dayJobs = JOBS.filter((j) => j.dayIndex === dayIndex);
            return (
              <div
                key={d.weekday}
                className="relative"
                style={{
                  height: `${GRID_HEIGHT}px`,
                  borderLeft:
                    dayIndex === 0
                      ? "none"
                      : `1px solid ${PULSE.cardBorder}`,
                  background: d.isToday ? "rgba(255,255,255,0.02)" : "transparent",
                }}
              >
                {/* Horizontal hour grid lines */}
                {HOURS.slice(1, -1).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0"
                    style={{
                      top: `${(i + 1) * HOUR_PX}px`,
                      height: 0,
                      borderTop: `1px dashed ${PULSE.cardBorder}`,
                    }}
                  />
                ))}

                {/* Job blocks */}
                {dayJobs.map((job, i) => {
                  const startMin =
                    (job.startH - START_HOUR) * 60 + job.startM;
                  const endMin = (job.endH - START_HOUR) * 60 + job.endM;
                  const top = (startMin / 60) * HOUR_PX;
                  const height = Math.max(
                    32,
                    ((endMin - startMin) / 60) * HOUR_PX,
                  );
                  return (
                    <div
                      key={i}
                      className={`absolute overflow-hidden rounded-lg border border-l-4 px-2 py-1.5 ${TONE_CLASSES[job.tone]}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: "4px",
                        right: "4px",
                      }}
                    >
                      <div
                        className="truncate text-[11px] font-bold tracking-tight"
                        style={{ color: PULSE.text }}
                      >
                        {job.customer}
                      </div>
                      <div
                        className="truncate text-[10px] font-bold"
                        style={{ color: PULSE.textMuted }}
                      >
                        {job.service}
                      </div>
                      {height >= 56 && (
                        <div
                          className="truncate text-[10px] font-bold tabular-nums"
                          style={{ color: PULSE.textMuted }}
                        >
                          {formatTimeRange(
                            job.startH,
                            job.startM,
                            job.endH,
                            job.endM,
                          )}
                        </div>
                      )}
                      <div
                        className="mt-0.5 text-[11px] font-black tabular-nums tracking-tight"
                        style={{ color: PULSE.text }}
                      >
                        {job.price}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
