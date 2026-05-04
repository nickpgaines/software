import Link from "next/link";

const VARIANTS = [
  {
    slug: "a",
    name: "A — Donut suite",
    tagline: "Three donut charts up top · KPI cards below.",
    description:
      "Donuts lead. Collection Rate as a single ring, Jobs as a multi-segment ring (completed / scheduled / canceled), Customer mix as a third ring. The full Revenue / Jobs / Customers number sets sit beneath as standard rounded cards. No line chart on this one.",
  },
  {
    slug: "b",
    name: "B — Chart forward",
    tagline: "Dashboard-style KPI strip · big revenue chart · numeric sections.",
    description:
      "Line chart leads, like the dashboard homepage. Heaviest type (font-black) on the numbers, four-up KPI strip at the top, the existing smooth area chart in the middle, then Jobs and Customers as KPI rows. No donuts here.",
  },
  {
    slug: "c",
    name: "C — Balanced mix",
    tagline: "Line chart + Collection Rate donut hero · jobs split donut.",
    description:
      "Hero row splits 2/3 line chart and 1/3 collection-rate donut. Revenue numbers sit underneath. Jobs section pairs a multi-segment donut with the numeric breakdown. Softer rounded-3xl cards, more whitespace.",
  },
  {
    slug: "d",
    name: "D — Compact dashboard",
    tagline: "KPI strip with sparklines · chart · jobs donut + numbers side-by-side.",
    description:
      "Densest of the four. Revenue KPI strip carries inline sparklines, the smooth chart sits in the middle at full width, the Jobs section combines a donut with the five numeric cards, Customers stays as a tight three-up. Sharper rounded-xl corners.",
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
            Same data, same blue accent, same modern bold language as the rest
            of the app. Four mixes of donut charts, line charts, and number
            cards.
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
