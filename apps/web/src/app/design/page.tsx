import Link from "next/link";

const live = [
  {
    slug: "concept-live",
    name: "Concept Live — Real data",
    tagline: "Z + floating sidebar + real DB · clickable Dashboard / Schedule / Leaderboard / Reports / Customers.",
    description:
      "The Z visual treatment (left-bar active nav, accent line under card titles, blue #379CFB) wired to your actual CRM. The sidebar floats off the wall (Flyra style) — collapsed icons, expands on hover, with margin from the viewport edges. Click any nav item to load that page with real data; everything else falls back to honest empty states.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
];

const fixed = [
  {
    slug: "concept-v",
    name: "Concept V — Default",
    tagline: "Base · fixes applied · light/dark toggle.",
    description:
      "Three fixes from the latest round: dark-mode headline stays visible (always dark on the light grey canvas), content constrained to max-w-6xl like your real dashboard, and the sidebar collapses to icons by default and expands on hover (Flyra pattern). Standard rounded-2xl + border + subtle shadow.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-w",
    name: "Concept W — Soft",
    tagline: "Borderless cards. Layered shadow. More rounded.",
    description:
      "Same color scheme. Cards drop the border and lean on a softer shadow. rounded-3xl for a gentler feel.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-x",
    name: "Concept X — Crisp",
    tagline: "Stronger borders. No shadow. Sharper corners.",
    description:
      "rounded-xl, heavier 1px borders, no shadow. Body text drops to font-medium so the headline does the lifting. Reads as a precise tool.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-y",
    name: "Concept Y — Editorial",
    tagline: "Bigger headline. Outlined status pills.",
    description:
      "Display-size greeting (text-5xl), borderless cards, status pills become outlined (blue border + blue text instead of solid fill). More magazine, more presence.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-z",
    name: "Concept Z — Tinted",
    tagline: "Active nav uses left-bar accent. Card titles get a thin blue underline.",
    description:
      "More color presence overall without changing the palette. Active sidebar item uses a tinted background + left bar; card section titles get a small blue accent line under them.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
];

const realFeatures = [
  {
    slug: "concept-q",
    name: "Concept Q — Crisp",
    tagline: "Base · light/dark toggle · real features.",
    description:
      "The current dashboard layout (greeting + search, revenue chart, today's schedule, inbox + tasks) with a working light/dark toggle. Light grey canvas stays the same in both modes — only the sidebar and widgets flip.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-r",
    name: "Concept R — Floating",
    tagline: "Sidebar floats. Cards have shadow, no border.",
    description:
      "Sidebar pulls away from the edge with margins and rounds on all sides. Cards drop the border for a softer, floatier look.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-s",
    name: "Concept S — Sharp",
    tagline: "Tighter rounded-lg corners. Strong borders.",
    description:
      "Architectural and tool-like. Smaller radius, heavier 1px borders, no shadows. Reads as a precise instrument.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-t",
    name: "Concept T — Spacious",
    tagline: "Rounded-3xl. More padding. Borderless.",
    description:
      "Bigger corners, more whitespace inside cards. Calmer, more deliberate pace.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
  {
    slug: "concept-u",
    name: "Concept U — Accented",
    tagline: "Active nav uses a blue left-bar tint instead of solid fill.",
    description:
      "Subtler active state — left-bar accent with light blue background tint. More color presence overall, less heavy.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#27272a", "#09090b"],
  },
];

const blueSet = [
  {
    slug: "concept-m",
    name: "Concept M — Light",
    tagline: "Light grey canvas · #379CFB accent.",
    description:
      "Zinc-100 background (very light grey), white cards, sky-blue accent. Calm and clean.",
    swatches: ["#f4f4f5", "#ffffff", "#379CFB", "#71717a", "#09090b"],
  },
  {
    slug: "concept-n",
    name: "Concept N — Mid",
    tagline: "Mid grey canvas · #379CFB accent.",
    description:
      "Zinc-300 background — clearly grey, no ambiguity. White cards pop strongly.",
    swatches: ["#d4d4d8", "#ffffff", "#379CFB", "#71717a", "#09090b"],
  },
  {
    slug: "concept-o",
    name: "Concept O — Dark",
    tagline: "Neutral dark grey canvas · #379CFB accent.",
    description:
      "Zinc-800 background, zinc-700 cards. Dark but not pure black — keeps the layered feel.",
    swatches: ["#27272a", "#3f3f46", "#379CFB", "#a1a1aa", "#fafafa"],
  },
  {
    slug: "concept-p",
    name: "Concept P — Cool Dark",
    tagline: "Cool dark grey canvas · #379CFB accent.",
    description:
      "Slate-800 background (slight blue tint) — harmonizes with the blue accent. Slate-700 cards.",
    swatches: ["#1e293b", "#334155", "#379CFB", "#94a3b8", "#ffffff"],
  },
];

const colored = [
  {
    slug: "concept-i",
    name: "Concept I — Cobalt",
    tagline: "Light-mid grey · electric blue accent.",
    description:
      "Zinc-200 canvas, white cards, blue-600 active states. Familiar but vibrant. Sidebar uses your existing nav verbatim.",
    swatches: ["#e4e4e7", "#ffffff", "#2563eb", "#1e40af", "#09090b"],
  },
  {
    slug: "concept-j",
    name: "Concept J — Ember",
    tagline: "Dark-mid grey · warm amber accent.",
    description:
      "Zinc-800 canvas, zinc-700 cards, amber-400 pop. Cozy and premium — the warm contrast against cool grey adds life.",
    swatches: ["#27272a", "#3f3f46", "#fbbf24", "#fcd34d", "#ffffff"],
  },
  {
    slug: "concept-k",
    name: "Concept K — Mint",
    tagline: "Warm light-mid grey · emerald accent.",
    description:
      "Stone-200 canvas (warmer tone), white cards, emerald-600 accent. Fresh and clean — fits a window-cleaning brand naturally.",
    swatches: ["#e7e5e4", "#ffffff", "#059669", "#047857", "#1c1917"],
  },
  {
    slug: "concept-l",
    name: "Concept L — Iris",
    tagline: "Cool dark-mid grey · indigo accent.",
    description:
      "Slate-800 canvas (slight blue tint), slate-700 cards, indigo-400 accent. Tech-forward and refined.",
    swatches: ["#1e293b", "#334155", "#818cf8", "#a5b4fc", "#ffffff"],
  },
];

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
            Concept Live wires the Z visual treatment to your actual CRM data
            with a floating sidebar (Flyra pattern) and click-through navigation
            across Dashboard, Schedule, Leaderboard, Reports, and Customers.
          </p>
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Live — start here
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 mb-16">
          {live.map((c) => (
            <ConceptCard key={c.slug} {...c} highlighted />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Real-features set V–Z
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {fixed.map((c) => (
            <ConceptCard key={c.slug} {...c} />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Real features (Q–U)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {realFeatures.map((c) => (
            <ConceptCard key={c.slug} {...c} />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Background-only blue (M–P)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {blueSet.map((c) => (
            <ConceptCard key={c.slug} {...c} />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Color exploration (I–L)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {colored.map((c) => (
            <ConceptCard key={c.slug} {...c} />
          ))}
        </div>

        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight uppercase text-neutral-500">
            Balanced (G, H)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {refined.map((c) => (
            <ConceptCard key={c.slug} {...c} />
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
  if (slug === "concept-live") {
    return (
      <div className="absolute inset-0 bg-zinc-100 p-3">
        {/* Floating sidebar */}
        <div className="absolute left-3 top-3 bottom-3 w-9 bg-white rounded-xl border border-zinc-200 shadow-md p-1.5 space-y-1">
          <div className="h-3 rounded-md" style={{ background: "#379CFB" }} />
          <div className="h-2 rounded-md" style={{ background: "#379CFB" }} />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
        </div>
        {/* Main */}
        <div className="ml-14 mr-1 space-y-1.5">
          <div className="flex items-end gap-1.5">
            <div className="h-3 w-24 bg-zinc-900 rounded-sm" />
            <div className="h-3 w-10 rounded-sm" style={{ background: "#379CFB" }} />
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 h-12 p-1.5 space-y-1 relative">
            <div className="absolute top-1.5 left-1.5 w-3 h-0.5 rounded-full" style={{ background: "#379CFB" }} />
            <div className="h-1 w-12 bg-zinc-300 rounded-full mt-1" />
            <div className="h-1 w-full rounded-full" style={{ background: "#379CFB" }} />
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 h-10 p-1.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-2 bg-zinc-200 rounded-full" />
              <div className="h-1 flex-1 bg-zinc-100 rounded-full" />
              <div className="h-1.5 w-3 rounded-full" style={{ background: "#379CFB" }} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-2 bg-zinc-200 rounded-full" />
              <div className="h-1 flex-1 bg-zinc-100 rounded-full" />
              <div className="h-1.5 w-3 rounded-full bg-zinc-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-white rounded-lg border border-zinc-200 h-8" />
            <div className="bg-white rounded-lg border border-zinc-200 h-8" />
          </div>
        </div>
      </div>
    );
  }
  if (["concept-v", "concept-w", "concept-x", "concept-y", "concept-z"].includes(slug)) {
    const styles: Record<string, { radius: string; cardBorder: boolean; shadow: boolean; activeStyle: "fill" | "leftbar"; bigHeading?: boolean; accentLine?: boolean }> = {
      "concept-v": { radius: "rounded-xl", cardBorder: true, shadow: false, activeStyle: "fill" },
      "concept-w": { radius: "rounded-2xl", cardBorder: false, shadow: true, activeStyle: "fill" },
      "concept-x": { radius: "rounded-md", cardBorder: true, shadow: false, activeStyle: "fill" },
      "concept-y": { radius: "rounded-xl", cardBorder: false, shadow: true, activeStyle: "fill", bigHeading: true },
      "concept-z": { radius: "rounded-xl", cardBorder: true, shadow: false, activeStyle: "leftbar", accentLine: true },
    };
    const s = styles[slug];
    const cardCls = `bg-white ${s.radius} ${s.cardBorder ? "border border-zinc-200" : ""} ${s.shadow ? "shadow-md" : ""}`;
    const activeNav =
      s.activeStyle === "fill" ? (
        <div className="h-2.5 rounded-md" style={{ background: "#379CFB" }} />
      ) : (
        <div className="h-2.5 rounded-md flex items-center" style={{ background: "#379CFB1A" }}>
          <div className="w-0.5 h-2.5 rounded-r" style={{ background: "#379CFB" }} />
        </div>
      );
    return (
      <div className="absolute inset-0 bg-zinc-100 grid grid-cols-[24px_1fr]">
        <div className="bg-white border-r border-zinc-200 p-1 space-y-1">
          <div className="h-3 rounded" style={{ background: "#379CFB" }} />
          <div className="h-2 rounded" style={{ background: "#379CFB" }} />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
          <div className="h-1.5 bg-zinc-200 rounded" />
        </div>
        <div className="p-3">
          <div className="max-w-[90%] mx-auto space-y-2">
            <div className="flex items-end gap-1.5">
              <div className={`${s.bigHeading ? "h-4 w-24" : "h-3 w-20"} bg-zinc-900 rounded-sm`} />
              <div className={`${s.bigHeading ? "h-4 w-10" : "h-3 w-8"} rounded-sm`} style={{ background: "#379CFB" }} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className={`col-span-2 h-3 ${cardCls}`} />
              <div className={`h-3 ${cardCls}`} />
            </div>
            <div className={`${cardCls} h-12 px-2 py-1.5 space-y-1 relative`}>
              {s.accentLine && (
                <div className="absolute top-3 left-2 w-3 h-0.5 rounded-full" style={{ background: "#379CFB" }} />
              )}
              <div className="h-1 w-12 bg-zinc-300 rounded-full mt-1" />
              <div className="h-1 w-full rounded-full" style={{ background: "#379CFB" }} />
            </div>
            <div className={`${cardCls} h-10 p-1.5 space-y-1`}>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-2 bg-zinc-200 rounded-full" />
                <div className="h-1 flex-1 bg-zinc-100 rounded-full" />
                <div className="h-1.5 w-3 rounded-full" style={{ background: "#379CFB" }} />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-2 bg-zinc-200 rounded-full" />
                <div className="h-1 flex-1 bg-zinc-100 rounded-full" />
                <div className="h-1.5 w-3 rounded-full bg-zinc-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className={`${cardCls} h-8`} />
              <div className={`${cardCls} h-8`} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (["concept-q", "concept-r", "concept-s", "concept-t", "concept-u"].includes(slug)) {
    const styles: Record<string, { float: boolean; radius: string; sidebarShadow: boolean; cardBorder: boolean; activeStyle: "fill" | "leftbar" }> = {
      "concept-q": { float: false, radius: "rounded-xl", sidebarShadow: false, cardBorder: true, activeStyle: "fill" },
      "concept-r": { float: true, radius: "rounded-xl", sidebarShadow: true, cardBorder: false, activeStyle: "fill" },
      "concept-s": { float: false, radius: "rounded-md", sidebarShadow: false, cardBorder: true, activeStyle: "fill" },
      "concept-t": { float: false, radius: "rounded-2xl", sidebarShadow: false, cardBorder: false, activeStyle: "fill" },
      "concept-u": { float: false, radius: "rounded-xl", sidebarShadow: false, cardBorder: true, activeStyle: "leftbar" },
    };
    const s = styles[slug];
    const sidebarBg = s.sidebarShadow ? "bg-white shadow-md" : "bg-white";
    const cardCls = `bg-white ${s.radius} ${s.cardBorder ? "border border-zinc-200" : "shadow-sm"}`;
    const activeNav =
      s.activeStyle === "fill" ? (
        <div className="h-2.5 rounded-md" style={{ background: "#379CFB" }} />
      ) : (
        <div className="h-2.5 rounded-md flex items-center" style={{ background: "#379CFB1A" }}>
          <div className="w-0.5 h-2.5 rounded-r" style={{ background: "#379CFB" }} />
        </div>
      );
    return (
      <div className={`absolute inset-0 bg-zinc-100 ${s.float ? "p-2 grid grid-cols-[60px_1fr] gap-2" : "grid grid-cols-[60px_1fr]"}`}>
        <div className={`${sidebarBg} ${s.float ? s.radius : "border-r border-zinc-200"} p-2 space-y-1.5`}>
          <div className="h-3 rounded-sm" style={{ background: "#379CFB" }} />
          {activeNav}
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
          <div className="h-1.5 bg-zinc-200 rounded-sm" />
        </div>
        <div className={`p-2 space-y-1.5 ${s.float ? "" : ""}`}>
          <div className={`${cardCls} h-10`} />
          <div className={`${cardCls} h-12`} />
          <div className="grid grid-cols-2 gap-1.5">
            <div className={`${cardCls} h-10`} />
            <div className={`${cardCls} h-10`} />
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-m" || slug === "concept-n" || slug === "concept-o" || slug === "concept-p") {
    const palettes: Record<string, { bg: string; side: string; card: string; isDark: boolean }> = {
      "concept-m": { bg: "bg-zinc-100", side: "bg-white border-r border-zinc-200", card: "bg-white border border-zinc-200", isDark: false },
      "concept-n": { bg: "bg-zinc-300", side: "bg-white border-r border-zinc-300", card: "bg-white border border-zinc-300/70", isDark: false },
      "concept-o": { bg: "bg-zinc-800", side: "bg-zinc-900 border-r border-zinc-800", card: "bg-zinc-700 border border-zinc-600/40", isDark: true },
      "concept-p": { bg: "bg-slate-800", side: "bg-slate-900 border-r border-slate-800", card: "bg-slate-700 border border-slate-600/40", isDark: true },
    };
    const p = palettes[slug];
    const trackColor = p.isDark ? "bg-zinc-500/30" : "bg-zinc-300/50";
    return (
      <div className={`absolute inset-0 ${p.bg} grid grid-cols-[60px_1fr]`}>
        <div className={`${p.side} p-2 space-y-1.5`}>
          <div className="h-4 rounded-md" style={{ background: "#379CFB" }} />
          <div className="h-2 rounded-sm" style={{ background: "#379CFB" }} />
          <div className={`h-1.5 ${trackColor} rounded-sm`} />
          <div className={`h-1.5 ${trackColor} rounded-sm`} />
          <div className={`h-1.5 ${trackColor} rounded-sm`} />
          <div className={`h-1.5 ${trackColor} rounded-sm`} />
          <div className={`h-1.5 ${trackColor} rounded-sm`} />
        </div>
        <div className="p-2 space-y-1.5">
          <div className="h-4" />
          <div className="grid grid-cols-4 gap-1.5">
            <div className={`h-9 ${p.card} rounded-lg`} />
            <div className={`h-9 ${p.card} rounded-lg`} />
            <div className={`h-9 ${p.card} rounded-lg`} />
            <div className={`h-9 ${p.card} rounded-lg`} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className={`col-span-2 h-12 ${p.card} rounded-lg relative overflow-hidden`}>
              <div className="absolute bottom-1 left-1 right-1 h-0.5 rounded-full" style={{ background: "#379CFB" }} />
            </div>
            <div className={`h-12 ${p.card} rounded-lg p-1.5 space-y-1`}>
              <div className="h-1 w-2/3 rounded-full" style={{ background: "#379CFB" }} />
              <div className={`h-1 w-1/2 ${trackColor} rounded-full`} />
              <div className={`h-1 w-3/4 ${trackColor} rounded-full`} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (slug === "concept-i" || slug === "concept-j" || slug === "concept-k" || slug === "concept-l") {
    const palettes: Record<string, { bg: string; side: string; card: string; accent: string; cardBorder: string }> = {
      "concept-i": { bg: "bg-zinc-200", side: "bg-white border-r border-zinc-300", card: "bg-white border border-zinc-300/60", accent: "bg-blue-600", cardBorder: "border-zinc-200" },
      "concept-j": { bg: "bg-zinc-800", side: "bg-zinc-900 border-r border-zinc-800", card: "bg-zinc-700 border border-zinc-600/40", accent: "bg-amber-400", cardBorder: "border-zinc-600/40" },
      "concept-k": { bg: "bg-stone-200", side: "bg-white border-r border-stone-300", card: "bg-white border border-stone-300/60", accent: "bg-emerald-600", cardBorder: "border-stone-200" },
      "concept-l": { bg: "bg-slate-800", side: "bg-slate-900 border-r border-slate-800", card: "bg-slate-700 border border-slate-600/40", accent: "bg-indigo-500", cardBorder: "border-slate-600/40" },
    };
    const p = palettes[slug];
    return (
      <div className={`absolute inset-0 ${p.bg} grid grid-cols-[60px_1fr]`}>
        <div className={`${p.side} p-2 space-y-1.5`}>
          <div className={`h-4 rounded-md ${p.accent}`} />
          <div className={`h-2 rounded-sm ${p.accent}`} />
          <div className="h-1.5 bg-zinc-300/40 rounded-sm" />
          <div className="h-1.5 bg-zinc-300/40 rounded-sm" />
          <div className="h-1.5 bg-zinc-300/40 rounded-sm" />
          <div className="h-1.5 bg-zinc-300/40 rounded-sm" />
          <div className="h-1.5 bg-zinc-300/40 rounded-sm" />
        </div>
        <div className="p-2 space-y-1.5">
          <div className="h-4" />
          <div className="grid grid-cols-4 gap-1.5">
            <div className={`h-9 ${p.card} rounded-lg`} />
            <div className={`h-9 ${p.card} rounded-lg`} />
            <div className={`h-9 ${p.card} rounded-lg`} />
            <div className={`h-9 ${p.card} rounded-lg`} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className={`col-span-2 h-12 ${p.card} rounded-lg relative overflow-hidden`}>
              <div className={`absolute bottom-1 left-1 right-1 h-0.5 ${p.accent} rounded-full`} />
            </div>
            <div className={`h-12 ${p.card} rounded-lg p-1.5 space-y-1`}>
              <div className={`h-1 w-2/3 ${p.accent} rounded-full`} />
              <div className="h-1 w-1/2 bg-zinc-400/30 rounded-full" />
              <div className="h-1 w-3/4 bg-zinc-400/30 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }
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
