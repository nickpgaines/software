// Preview the four spacing options for the new 14 px / weight 600
// scorecard style. Same sample data, same locked styling — only the
// vertical gap between the label / value / bottom line varies.

const SAMPLES = [
  { label: "Close Rate", value: "34%", sub: "vs last week" },
  { label: "Scheduled", value: "3", sub: "$1,846.99" },
  { label: "Total Revenue", value: "$48,210", sub: "Across 24 jobs" },
];

function ScoreCard({
  label,
  value,
  sub,
  gap,
}: {
  label: string;
  value: string;
  sub: string;
  gap: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="text-[14px] font-semibold text-zinc-500">{label}</div>
      <div
        className={`${gap} text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white`}
      >
        {value}
      </div>
      <div className={`${gap} text-[14px] font-semibold text-zinc-400`}>
        {sub}
      </div>
    </div>
  );
}

const VARIANTS = [
  {
    title: "1 — Current (8 px gap)",
    blurb: "mt-2 between every line — no change to current spacing.",
    gap: "mt-2",
  },
  {
    title: "2 — 10 px gap",
    blurb: "mt-2.5 — +2 px from current.",
    gap: "mt-2.5",
  },
  {
    title: "3 — 12 px gap",
    blurb: "mt-3 — +4 px from current.",
    gap: "mt-3",
  },
  {
    title: "4 — 14 px gap",
    blurb: "mt-3.5 — +6 px from current.",
    gap: "mt-3.5",
  },
];

export default function ScorecardSpacingPreview() {
  return (
    <div className="min-h-screen bg-canvas text-white">
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-[14px] font-semibold text-zinc-500 mb-3">
            Reports / Dashboard — Scorecard spacing options
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">
            Four scorecard spacing variants
          </h1>
          <p className="text-zinc-400 max-w-3xl">
            Locked: top label 14 px / weight 600 / zinc-500, value 28 px /
            weight 800 / white, bottom line 14 px / weight 600 / zinc-400.
            Only the vertical gap between the three lines varies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {VARIANTS.map(({ title, blurb, gap }) => (
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
                  <ScoreCard
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    sub={s.sub}
                    gap={gap}
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
