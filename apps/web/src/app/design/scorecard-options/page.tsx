// Four side-by-side scorecard variants. Same sample data across the row;
// only weight and color on the surrounding small lines vary. Value stays
// locked at text-[28px] font-extrabold text-white.

const SAMPLES = [
  { label: "Close Rate", value: "34%", sub: "vs last week" },
  { label: "Scheduled", value: "3", sub: "$1,846.99" },
  { label: "Total Revenue", value: "$48,210", sub: "Across 24 jobs" },
];

// 1. Current — top/bottom font-bold (700), zinc-500 / zinc-400.
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

// 2. Less bold — top/bottom drop to font-semibold (600). Same colors as
// the current card.
function CardLessBold({
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
      <div className="text-[13px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-semibold text-zinc-400">{sub}</div>
    </div>
  );
}

// 3. White, same boldness as #2 — both top and bottom pure white at
// font-semibold (600). No opacity tricks.
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
      <div className="text-[13px] font-semibold text-white">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-semibold text-white">{sub}</div>
    </div>
  );
}

// 4. Even less bold than #2 — top/bottom drop another step to
// font-medium (500). Same colors as the current card.
function CardEvenLighter({
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
      <div className="text-[13px] font-medium text-zinc-500">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-zinc-400">{sub}</div>
    </div>
  );
}

const VARIANTS = [
  {
    title: "1 — Current",
    blurb: "top/bottom 13/700 · zinc-500 / zinc-400 · value 28/800 white",
    Card: CardCurrent,
  },
  {
    title: "2 — Less bold",
    blurb: "top/bottom 13/600 · zinc-500 / zinc-400 · value 28/800 white",
    Card: CardLessBold,
  },
  {
    title: "3 — White, same as #2",
    blurb: "top/bottom 13/600 · white / white · value 28/800 white",
    Card: CardWhite,
  },
  {
    title: "4 — Even less bold",
    blurb: "top/bottom 13/500 · zinc-500 / zinc-400 · value 28/800 white",
    Card: CardEvenLighter,
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
            Four scorecard weight variants
          </h1>
          <p className="text-zinc-400 max-w-3xl">
            Same sample data across the row, same 28 px / weight 800 white
            value, same 13 px size on the surrounding lines. Only the
            weight (and on #3, the color) of the top label and bottom
            supporting line vary.
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
