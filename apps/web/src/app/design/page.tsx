import Link from "next/link";

const refined = [
  {
    slug: "concept-g",
    name: "Concept G — Balanced Light",
    tagline: "Layered tones. Dark top bar. Bold but breathable.",
    description:
      "Grey canvas → white cards → black accents, with a full-width dark top bar (HomeBase pattern). Bold weights, rounded-2xl, structured. The current frontrunner.",
    swatches: ["#09090b", "#f4f4f5", "#ffffff", "#e4e4e7", "#71717a"],
  },
  {
    slug: "concept-h",
    name: "Concept H — Balanced Dark",
    tagline: "Layered tones. Black top bar. Cards lift off the canvas.",
    description:
      "Dark grey canvas → lighter zinc-800 cards → white accents. Avoids the all-black-on-black trap. Same system as G, inverted palette.",
    swatches: ["#000000", "#18181b", "#27272a", "#3f3f46", "#ffffff"],
  },
];

const earlierBold = [
  {
    slug: "concept-e",
    name: "Concept E — Bold Dark",
    tagline: "All-black canvas. Rounded-3xl pillows.",
    swatches: ["#000000", "#0a0a0a", "#27272a", "#a1a1aa", "#ffffff"],
  },
  {
    slug: "concept-f",
    name: "Concept F — Bold Light",
    tagline: "Warm neutral canvas. Rounded-3xl pillows.",
    swatches: ["#f5f5f5", "#ffffff", "#e5e5e5", "#737373", "#0a0a0a"],
  },
];

const earlier = [
  {
    slug: "concept-a",
    name: "Concept A — Linear",
    tagline: "Precision. Density. Calm.",
    swatches: ["#ffffff", "#f4f4f5", "#e4e4e7", "#71717a", "#0a0a0a"],
  },
  {
    slug: "concept-b",
    name: "Concept B — Editorial",
    tagline: "Generous. Confident. Quiet.",
    swatches: ["#ffffff", "#fafafa", "#e5e5e5", "#737373", "#000000"],
  },
  {
    slug: "concept-c",
    name: "Concept C — Obsidian",
    tagline: "Dark. Focused. Premium.",
    swatches: ["#000000", "#0a0a0a", "#18181b", "#a1a1aa", "#fafafa"],
  },
  {
    slug: "concept-d",
    name: "Concept D — Soft",
    tagline: "Warm. Tactile. Friendly.",
    swatches: ["#fafaf9", "#f5f5f4", "#e7e5e4", "#78716c", "#1c1917"],
  },
];

export default function DesignIndexPage() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-3 font-bold">
            Design lab
          </p>
          <h1 className="text-5xl font-bold tracking-tight">
            Pick a direction.
          </h1>
          <p className="text-neutral-500 mt-3 max-w-xl text-base font-medium">
            Two refined concepts (E + F) based on your feedback — bolder type,
            more rounded, simpler. Original four (A–D) below for comparison.
          </p>
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Latest — start here
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {refined.map((c) => (
            <ConceptCard key={c.slug} {...c} highlighted />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Bold round (E, F)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {earlierBold.map((c) => (
            <ConceptCard key={c.slug} {...c} description="" />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Earlier explorations (A–D)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {earlier.map((c) => (
            <ConceptCard key={c.slug} {...c} description="" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ConceptCard({
  slug,
  name,
  tagline,
  description,
  swatches,
  highlighted,
}: {
  slug: string;
  name: string;
  tagline: string;
  description?: string;
  swatches: string[];
  highlighted?: boolean;
}) {
  return (
    <Link
      href={`/design/${slug}`}
      className={
        "group block rounded-3xl bg-white overflow-hidden transition-all " +
        (highlighted
          ? "ring-2 ring-neutral-950 hover:ring-offset-2 hover:ring-offset-neutral-100"
          : "ring-1 ring-neutral-200 hover:ring-neutral-950")
      }
    >
      <div className="aspect-[16/10] border-b border-neutral-100 relative overflow-hidden">
        <ConceptThumbnail slug={slug} />
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h3 className="text-lg font-bold tracking-tight">{name}</h3>
          <span className="text-xs text-neutral-400 group-hover:text-neutral-950 transition-colors font-bold">
            Open →
          </span>
        </div>
        <p className="text-sm text-neutral-500 font-semibold mb-3">{tagline}</p>
        {description ? (
          <p className="text-sm text-neutral-600 leading-relaxed mb-4 font-medium">
            {description}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5">
          {swatches.map((s) => (
            <div
              key={s}
              className="w-6 h-6 rounded-full ring-1 ring-neutral-200"
              style={{ background: s }}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}

function ConceptThumbnail({ slug }: { slug: string }) {
  if (slug === "concept-g") {
    return (
      <div className="absolute inset-0 bg-zinc-100 flex flex-col">
        <div className="bg-zinc-950 h-7 flex items-center gap-1 px-3">
          <div className="w-3 h-3 rounded bg-white" />
          <div className="h-1.5 w-8 bg-white/20 rounded-sm ml-2" />
          <div className="h-1.5 w-8 bg-white/10 rounded-sm" />
          <div className="h-1.5 w-8 bg-white/10 rounded-sm" />
          <div className="h-1.5 w-8 bg-white/10 rounded-sm" />
          <div className="ml-auto h-3 w-12 rounded-full bg-white/10" />
          <div className="h-3 w-8 rounded-full bg-white" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <div className="h-3 w-32 bg-zinc-900 rounded-sm" />
          <div className="grid grid-cols-4 gap-1.5">
            <div className="h-9 bg-white border border-zinc-200 rounded-lg" />
            <div className="h-9 bg-white border border-zinc-200 rounded-lg" />
            <div className="h-9 bg-white border border-zinc-200 rounded-lg" />
            <div className="h-9 bg-white border border-zinc-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="col-span-2 h-16 bg-white border border-zinc-200 rounded-lg" />
            <div className="h-16 bg-white border border-zinc-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-h") {
    return (
      <div className="absolute inset-0 bg-zinc-900 flex flex-col">
        <div className="bg-black h-7 flex items-center gap-1 px-3">
          <div className="w-3 h-3 rounded bg-white" />
          <div className="h-1.5 w-8 bg-white/20 rounded-sm ml-2" />
          <div className="h-1.5 w-8 bg-white/10 rounded-sm" />
          <div className="h-1.5 w-8 bg-white/10 rounded-sm" />
          <div className="h-1.5 w-8 bg-white/10 rounded-sm" />
          <div className="ml-auto h-3 w-12 rounded-full bg-white/10" />
          <div className="h-3 w-8 rounded-full bg-white" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <div className="h-3 w-32 bg-white rounded-sm" />
          <div className="grid grid-cols-4 gap-1.5">
            <div className="h-9 bg-zinc-800 border border-zinc-700/60 rounded-lg" />
            <div className="h-9 bg-zinc-800 border border-zinc-700/60 rounded-lg" />
            <div className="h-9 bg-zinc-800 border border-zinc-700/60 rounded-lg" />
            <div className="h-9 bg-zinc-800 border border-zinc-700/60 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="col-span-2 h-16 bg-zinc-800 border border-zinc-700/60 rounded-lg" />
            <div className="h-16 bg-zinc-800 border border-zinc-700/60 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-e") {
    return (
      <div className="absolute inset-0 bg-black p-3 grid grid-cols-[60px_1fr] gap-2">
        <div className="bg-zinc-950 rounded-2xl p-2 space-y-1.5">
          <div className="h-2 bg-white rounded-full" />
          <div className="h-2 bg-zinc-800 rounded-full" />
          <div className="h-2 bg-zinc-800 rounded-full" />
          <div className="h-2 bg-zinc-800 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="bg-zinc-950 rounded-2xl h-10" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-zinc-950 rounded-2xl" />
            <div className="h-10 bg-zinc-950 rounded-2xl" />
            <div className="h-10 bg-zinc-950 rounded-2xl" />
          </div>
          <div className="bg-zinc-950 rounded-2xl h-[calc(100%-5.25rem)] p-2 space-y-1">
            <div className="h-3 bg-black rounded-xl" />
            <div className="h-3 bg-black rounded-xl" />
            <div className="h-3 bg-black rounded-xl" />
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-f") {
    return (
      <div className="absolute inset-0 bg-neutral-100 p-3 grid grid-cols-[60px_1fr] gap-2">
        <div className="bg-white rounded-2xl p-2 space-y-1.5">
          <div className="h-2 bg-neutral-950 rounded-full" />
          <div className="h-2 bg-neutral-200 rounded-full" />
          <div className="h-2 bg-neutral-200 rounded-full" />
          <div className="h-2 bg-neutral-200 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="bg-white rounded-2xl h-10" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-white rounded-2xl" />
            <div className="h-10 bg-white rounded-2xl" />
            <div className="h-10 bg-white rounded-2xl" />
          </div>
          <div className="bg-white rounded-2xl h-[calc(100%-5.25rem)] p-2 space-y-1">
            <div className="h-3 bg-neutral-100 rounded-xl" />
            <div className="h-3 bg-neutral-100 rounded-xl" />
            <div className="h-3 bg-neutral-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-a") {
    return (
      <div className="absolute inset-0 bg-zinc-50 p-4 grid grid-cols-[80px_1fr] gap-3">
        <div className="bg-white border border-zinc-200 rounded-md p-2 space-y-1.5">
          <div className="h-1.5 bg-zinc-900 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-white border border-zinc-200 rounded-md" />
            <div className="h-10 bg-white border border-zinc-200 rounded-md" />
            <div className="h-10 bg-white border border-zinc-200 rounded-md" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-md h-[calc(100%-3rem)] p-2 space-y-1">
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
      <div className="absolute inset-0 bg-white p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-2 w-12 bg-neutral-200 rounded-sm" />
          <div className="h-5 w-44 bg-neutral-900 rounded-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-14 bg-white border border-neutral-200 rounded-lg" />
          <div className="h-14 bg-white border border-neutral-200 rounded-lg" />
          <div className="h-14 bg-white border border-neutral-200 rounded-lg" />
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
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-zinc-950 border border-zinc-800 rounded-md" />
            <div className="h-10 bg-zinc-950 border border-zinc-800 rounded-md" />
            <div className="h-10 bg-zinc-950 border border-zinc-800 rounded-md" />
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-md h-[calc(100%-3rem)]" />
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-stone-100 p-5 space-y-3">
      <div className="bg-white rounded-2xl shadow-sm h-12" />
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm h-20" />
        <div className="bg-white rounded-2xl shadow-sm h-20" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm h-12" />
    </div>
  );
}
