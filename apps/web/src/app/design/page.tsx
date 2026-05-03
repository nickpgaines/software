import Link from "next/link";

const concepts = [
  {
    slug: "concept-a",
    name: "Concept A — Linear",
    tagline: "Precision. Density. Calm.",
    description:
      "Light canvas, hairline borders, compact typography, monospaced numerics. Inspired by Linear, Height, Attio. Built for power users who live in the product.",
    swatches: ["#ffffff", "#f4f4f5", "#e4e4e7", "#71717a", "#0a0a0a"],
  },
  {
    slug: "concept-b",
    name: "Concept B — Editorial",
    tagline: "Generous. Confident. Quiet.",
    description:
      "Big typographic headlines, lots of whitespace, flat white, no shadows. Inspired by Vercel and Notion. Reads like a magazine, navigates like an app.",
    swatches: ["#ffffff", "#fafafa", "#e5e5e5", "#737373", "#000000"],
  },
  {
    slug: "concept-c",
    name: "Concept C — Obsidian",
    tagline: "Dark. Focused. Premium.",
    description:
      "Pure black canvas with off-white type and zinc dividers. Inspired by Stripe night mode and Arc. A serious tool for serious work.",
    swatches: ["#000000", "#0a0a0a", "#18181b", "#a1a1aa", "#fafafa"],
  },
  {
    slug: "concept-d",
    name: "Concept D — Soft",
    tagline: "Warm. Tactile. Friendly.",
    description:
      "Off-white canvas, soft rounded cards, gentle shadows, pill buttons. Inspired by Apple, Things, and Cron. Feels approachable without losing polish.",
    swatches: ["#fafaf9", "#f5f5f4", "#e7e5e4", "#78716c", "#1c1917"],
  },
];

export default function DesignIndexPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 mb-3">
            Design lab
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Pick a direction.
          </h1>
          <p className="text-zinc-500 mt-3 max-w-xl">
            Four takes on a modern CRM, all in black / white / grey. Each preview
            is a self-contained mock dashboard so you can feel the difference.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {concepts.map((c) => (
            <Link
              key={c.slug}
              href={`/design/${c.slug}`}
              className="group block rounded-2xl border border-zinc-200 hover:border-zinc-900 transition-colors overflow-hidden"
            >
              <div className="aspect-[16/10] bg-zinc-50 border-b border-zinc-200 relative overflow-hidden">
                <ConceptThumbnail slug={c.slug} />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {c.name}
                  </h2>
                  <span className="text-xs text-zinc-400 group-hover:text-zinc-900 transition-colors">
                    Open →
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mb-4">{c.tagline}</p>
                <p className="text-sm text-zinc-600 leading-relaxed mb-5">
                  {c.description}
                </p>
                <div className="flex items-center gap-1.5">
                  {c.swatches.map((s) => (
                    <div
                      key={s}
                      className="w-6 h-6 rounded-full border border-zinc-200"
                      style={{ background: s }}
                    />
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-xs text-zinc-400 mt-12 text-center">
          These are mocks. Picking one will inform the design system we apply
          across the real app.
        </p>
      </div>
    </div>
  );
}

function ConceptThumbnail({ slug }: { slug: string }) {
  if (slug === "concept-a") {
    return (
      <div className="absolute inset-0 p-4 grid grid-cols-[80px_1fr] gap-3">
        <div className="bg-white border border-zinc-200 rounded-md p-2 space-y-1.5">
          <div className="h-1.5 bg-zinc-900 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-md h-10" />
            ))}
          </div>
          <div className="bg-white border border-zinc-200 rounded-md flex-1 h-[calc(100%-3rem)] p-2 space-y-1">
            <div className="h-1 bg-zinc-100 rounded-sm" />
            <div className="h-1 bg-zinc-100 rounded-sm" />
            <div className="h-1 bg-zinc-100 rounded-sm" />
            <div className="h-1 bg-zinc-100 rounded-sm" />
            <div className="h-1 bg-zinc-100 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-b") {
    return (
      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-2 w-12 bg-zinc-200 rounded-sm" />
          <div className="h-5 w-44 bg-zinc-900 rounded-sm" />
          <div className="h-2 w-32 bg-zinc-300 rounded-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-14 bg-white border border-zinc-200 rounded-lg" />
          <div className="h-14 bg-white border border-zinc-200 rounded-lg" />
          <div className="h-14 bg-white border border-zinc-200 rounded-lg" />
        </div>
      </div>
    );
  }
  if (slug === "concept-c") {
    return (
      <div className="absolute inset-0 bg-black p-4 grid grid-cols-[80px_1fr] gap-3">
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-2 space-y-1.5">
          <div className="h-1.5 bg-white rounded-sm" />
          <div className="h-1.5 bg-zinc-800 rounded-sm" />
          <div className="h-1.5 bg-zinc-800 rounded-sm" />
          <div className="h-1.5 bg-zinc-800 rounded-sm" />
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-zinc-950 border border-zinc-800 rounded-md" />
            <div className="h-10 bg-zinc-950 border border-zinc-800 rounded-md" />
            <div className="h-10 bg-zinc-950 border border-zinc-800 rounded-md" />
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-md h-[calc(100%-3rem)] p-2 space-y-1">
            <div className="h-1 bg-zinc-900 rounded-sm" />
            <div className="h-1 bg-zinc-900 rounded-sm" />
            <div className="h-1 bg-zinc-900 rounded-sm" />
            <div className="h-1 bg-zinc-900 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-stone-100 p-5 space-y-3">
      <div className="bg-white rounded-2xl shadow-sm h-12 px-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-stone-200" />
        <div className="h-2 w-24 bg-stone-200 rounded-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm h-20" />
        <div className="bg-white rounded-2xl shadow-sm h-20" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm h-12" />
    </div>
  );
}
