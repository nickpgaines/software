import Link from "next/link";

const VARIANTS = [
  {
    slug: "a",
    name: "A — Editorial",
    tagline: "Display serif numbers · single tall area chart · hairline dividers.",
    description:
      "Magazine-style. Big serif KPIs, sans labels in caps, no card borders. The smooth area chart leads at the top; metric sections stack underneath with hairline blue dividers.",
  },
  {
    slug: "b",
    name: "B — Console",
    tagline: "Mono numbers · stepped bar chart · dense 1px borders.",
    description:
      "Spreadsheet/terminal vibe. JetBrains Mono for every value so columns line up, vertical bars per day instead of a smooth line, heavy 1px borders, no shadows.",
  },
  {
    slug: "c",
    name: "C — Bento (sparklines)",
    tagline: "Tight sans · inline sparklines on every revenue card · uniform grid.",
    description:
      "Linear-style modular grid. Every revenue KPI carries its own mini sparkline; jobs/customers stay numeric. A smaller combo chart anchors the bottom.",
  },
  {
    slug: "d",
    name: "D — Soft (donuts)",
    tagline: "Rounded-3xl cards · donut for ratios · gradient area chart.",
    description:
      "Calmer, consumer-feel. Collection rate becomes a donut ring; jobs split into a multi-segment donut. Big rounded cards, soft shadows, generous padding.",
  },
];

export default function ReportsIndex() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-3 font-bold">
            Reports — UI exploration
          </p>
          <h1 className="text-5xl font-bold tracking-tight">
            Pick a Reports look.
          </h1>
          <p className="text-neutral-500 mt-3 max-w-xl text-base font-medium">
            Same data, same colors, same metrics. Four different typography +
            chart treatments to compare side-by-side.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/design/reports/${v.slug}`}
              className="group block rounded-3xl bg-white overflow-hidden ring-1 ring-neutral-200 hover:ring-neutral-950 transition-all"
            >
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h3 className="text-lg font-bold tracking-tight">{v.name}</h3>
                  <span className="text-xs text-neutral-400 group-hover:text-neutral-950 transition-colors font-bold">
                    Open →
                  </span>
                </div>
                <p className="text-sm text-neutral-500 font-semibold mb-3">
                  {v.tagline}
                </p>
                <p className="text-sm text-neutral-600 leading-relaxed font-medium">
                  {v.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
