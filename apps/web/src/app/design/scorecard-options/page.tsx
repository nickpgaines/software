// Four side-by-side scorecard variants for visual comparison.
//
// Same sample data across the row so size / weight / color choices are the
// only thing varying. Render in the app dark theme.

const SAMPLES = [
  { label: "Close Rate", value: "34%", sub: "vs last week" },
  { label: "Scheduled", value: "3", sub: "$1,846.99" },
  { label: "Total Revenue", value: "$48,210", sub: "Across 24 jobs" },
];

// ---------- Variant 1: Current (as-is) -----------------------------------

function CardCurrent({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="text-[13px] font-bold text-zinc-500">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-bold text-zinc-400">{sub}</div>
    </div>
  );
}

// ---------- Variant 2: White small lines, lower weight -------------------
//
// Same 13px size on the surrounding text as today, but switched to white at
// reduced opacity instead of zinc-500 / zinc-400. Weight drops to 500 so the
// 28px / 800 value still dominates.

function CardWhite({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="text-[13px] font-medium text-white/60">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-white/50">{sub}</div>
    </div>
  );
}

// ---------- Variant 3: Numbers-forward, value first ----------------------
//
// Inverted hierarchy. The number is the first thing you read, sized way up
// (40px / weight 900). Label drops underneath as a single-word eyebrow in
// small caps weight 600. Bottom line stays as a tiny supporting note in
// zinc-500. Removes the "label tells you what you're about to read" cadence
// in favor of "see the number, then read what it is."

function CardNumbersForward({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-5">
      <div className="text-[40px] font-black tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-3 text-[13px] font-semibold text-zinc-300">
        {label}
      </div>
      <div className="mt-1 text-[12px] font-medium text-zinc-500">{sub}</div>
    </div>
  );
}

// ---------- Variant 4: Editorial / display ------------------------------
//
// Slightly more whitespace, a hairline divider between the value and the
// bottom line, and a thinner / larger value (32px weight 700) that reads
// closer to a magazine pull-quote than a dashboard number. Label gets a
// small dot prefix in zinc-600 to suggest a "metric" semantic without
// shouting.

function CardEditorial({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        <div className="text-[13px] font-semibold text-zinc-400">{label}</div>
      </div>
      <div className="mt-3 text-[32px] font-bold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-4 pt-3 border-t border-line text-[12px] font-semibold text-zinc-500">
        {sub}
      </div>
    </div>
  );
}

const VARIANTS = [
  {
    title: "1 — Current",
    blurb:
      "label 13/700/zinc-500 · value 28/800/white · bottom 13/700/zinc-400",
    Card: CardCurrent,
  },
  {
    title: "2 — White small lines",
    blurb:
      "label 13/500/white-60 · value 28/800/white · bottom 13/500/white-50",
    Card: CardWhite,
  },
  {
    title: "3 — Numbers forward",
    blurb:
      "value 40/900/white first · label 13/600/zinc-300 below · bottom 12/500/zinc-500",
    Card: CardNumbersForward,
  },
  {
    title: "4 — Editorial / display",
    blurb:
      "dot + label 13/600/zinc-400 · value 32/700/white · hairline · bottom 12/600/zinc-500",
    Card: CardEditorial,
  },
];

export default function ScorecardOptionsPreview() {
  return (
    <div className="min-h-screen bg-canvas text-white">
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-[13px] font-bold text-zinc-500 mb-3">
            Reports / Dashboard — Scorecard styling options
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">
            Four scorecard variants
          </h1>
          <p className="text-zinc-400 max-w-3xl">
            Same sample data across the row in every variant — only the
            typography, weight, color, and layout vary. Pick the one that
            best reads "modern, bold, simple, clean."
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {VARIANTS.map(({ title, blurb, Card }) => (
            <section key={title} className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {title}
                </h2>
                <p className="mt-1 text-[12px] font-medium text-zinc-500 leading-snug">
                  {blurb}
                </p>
              </div>
              <div className="space-y-3">
                {SAMPLES.map((s) => (
                  <Card
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    sub={s.sub}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
