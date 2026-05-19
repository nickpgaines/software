// Concept page: circle-only pin variations.
// All circles, same ~28px footprint as today. The two axes being explored:
//   1) Border / ring treatment (no ring, thin white, thick white, halo, etc.)
//   2) Icon style (stroke weight + filled vs outline)
//
// Pick a (border × icon) combo and that becomes the new production pin in
// MapClient.makeMarkerElement.

import type { CSSProperties, ReactNode } from "react";
import { DollarSign, Home, Ban, FileText, RotateCcw, Skull } from "lucide-react";

type StatusItem = {
  key: string;
  label: string;
  color: string;
  icon: typeof DollarSign;
  dark?: boolean;
};

const STATUSES: StatusItem[] = [
  { key: "sale",           label: "Sale",            color: "#22c55e", icon: DollarSign },
  { key: "not_home",       label: "Not home",        color: "#facc15", icon: Home, dark: true },
  { key: "not_interested", label: "Not interested",  color: "#ef4444", icon: Ban },
  { key: "come_back",      label: "Come back",       color: "#3b82f6", icon: RotateCcw },
  { key: "quote_sent",     label: "Quote sent",      color: "#f97316", icon: FileText },
  { key: "do_not_return",  label: "Do not return",   color: "#0f172a", icon: Skull },
];

// ────────────────────────────────────────────────────────────────────────
// Icon renderers — different "fonts" for the glyph inside the circle.
// ────────────────────────────────────────────────────────────────────────

type IconStyle = "lucide-thin" | "lucide-normal" | "lucide-bold" | "filled";

function StatusGlyph({
  s,
  style,
  size,
}: {
  s: StatusItem;
  style: IconStyle;
  size: number;
}) {
  const color = s.dark ? "#0f172a" : "#ffffff";

  if (style === "filled") {
    // Custom filled glyphs — bolder, app-icon-style read.
    return <FilledGlyph kind={s.key} color={color} size={size} />;
  }

  const stroke = style === "lucide-thin" ? 1.5 : style === "lucide-bold" ? 2.75 : 2;
  const Icon = s.icon;
  return <Icon width={size} height={size} color={color} strokeWidth={stroke} />;
}

function FilledGlyph({
  kind,
  color,
  size,
}: {
  kind: string;
  color: string;
  size: number;
}) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: color, xmlns: "http://www.w3.org/2000/svg" };
  switch (kind) {
    case "sale":
      // Dollar sign filled
      return (
        <svg {...props}>
          <path d="M13 2.5v1.6a4.5 4.5 0 0 1 3.9 3.4l-2 .5A2.5 2.5 0 0 0 12 6c-1.7 0-3 1-3 2.3 0 1.2.9 1.8 3.5 2.3 3.2.6 4.5 1.8 4.5 4 0 2.2-1.6 3.9-4 4.3v1.6h-2v-1.6a4.7 4.7 0 0 1-4.2-3.7l2-.5A2.7 2.7 0 0 0 12 17c1.8 0 3-1 3-2.4 0-1.2-.8-1.8-3.5-2.3-3.1-.6-4.5-1.7-4.5-4 0-2.1 1.6-3.8 4-4.2V2.5h2z" />
        </svg>
      );
    case "not_home":
      // Home filled
      return (
        <svg {...props}>
          <path d="M12 3.2 2.5 11.5c-.3.3-.1.8.3.8H5v8c0 .3.2.5.5.5h4V14h5v6.8h4c.3 0 .5-.2.5-.5v-8h2.2c.4 0 .6-.5.3-.8L12 3.2z" />
        </svg>
      );
    case "not_interested":
      // Ban / prohibition filled (disc with diagonal cutout)
      return (
        <svg {...props}>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-6.6 6.4a8 8 0 0 1 11.2 11.2L5.4 8.4zm1.4 2.8 9.4 9.4A8 8 0 0 1 6.8 11.2z" />
        </svg>
      );
    case "come_back":
      // Rotate / refresh filled
      return (
        <svg {...props}>
          <path d="M4 4v6h6L7.5 7.5A6 6 0 0 1 18 12h2A8 8 0 0 0 6 6.4L4 4zm16 16v-6h-6l2.5 2.5A6 6 0 0 1 6 12H4a8 8 0 0 0 14 5.6L20 20z" />
        </svg>
      );
    case "quote_sent":
      // Document filled
      return (
        <svg {...props}>
          <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15zm0 3h5v1.5H8V18z" />
        </svg>
      );
    case "do_not_return":
      // Skull filled
      return (
        <svg {...props}>
          <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.4 3.5 6.7V19a1 1 0 0 0 1 1h1v-2h1.5v2h2v-2H14v2h1a1 1 0 0 0 1-1v-2.3C18 15.4 20 13 20 10a8 8 0 0 0-8-8zM9 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4 4.5h2l-1 2-1-2z" />
        </svg>
      );
    default:
      return <svg {...props}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Circle pin variants — all 28px footprint, different ring treatments.
// ────────────────────────────────────────────────────────────────────────

type RingVariant = {
  key: string;
  name: string;
  desc: string;
  render: (s: StatusItem, iconStyle: IconStyle) => ReactNode;
};

const SIZE = 28;
const ICON_SIZE = 14;

function CircleBase({
  s,
  iconStyle,
  style,
  innerSize = SIZE,
  iconSize = ICON_SIZE,
}: {
  s: StatusItem;
  iconStyle: IconStyle;
  style: CSSProperties;
  innerSize?: number;
  iconSize?: number;
}) {
  return (
    <div
      style={{
        width: innerSize,
        height: innerSize,
        background: s.color,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <StatusGlyph s={s} style={iconStyle} size={iconSize} />
    </div>
  );
}

const RING_VARIANTS: RingVariant[] = [
  {
    key: "current",
    name: "A · Current",
    desc: "2px white ring, soft drop shadow. Baseline.",
    render: (s, i) => (
      <CircleBase
        s={s}
        iconStyle={i}
        style={{ border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
      />
    ),
  },
  {
    key: "no-ring",
    name: "B · No ring",
    desc: "No border, deeper shadow. Color reads stronger.",
    render: (s, i) => (
      <CircleBase
        s={s}
        iconStyle={i}
        style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(0,0,0,0.2)" }}
      />
    ),
  },
  {
    key: "thick-ring",
    name: "C · Thick white ring",
    desc: "3px white ring. Bolder, more contrast against satellite.",
    render: (s, i) => (
      <CircleBase
        s={s}
        iconStyle={i}
        style={{ border: "3px solid white", boxShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
      />
    ),
  },
  {
    key: "halo",
    name: "D · White ring + halo",
    desc: "2px white ring + 3px translucent colored halo. Flyra-flavored.",
    render: (s, i) => (
      <div
        style={{
          padding: 3,
          borderRadius: "50%",
          background: `${s.color}40`,
        }}
      >
        <CircleBase
          s={s}
          iconStyle={i}
          style={{ border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
        />
      </div>
    ),
  },
  {
    key: "dark-ring",
    name: "E · Dark ring",
    desc: "1.5px near-black ring. Reads cleaner on light/concrete backdrops.",
    render: (s, i) => (
      <CircleBase
        s={s}
        iconStyle={i}
        style={{
          border: "1.5px solid rgba(15,23,42,0.85)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.35)",
        }}
      />
    ),
  },
  {
    key: "dual-ring",
    name: "F · Dual ring",
    desc: "1.5px dark hairline outside 2px white ring. Hyper-crisp at any zoom.",
    render: (s, i) => (
      <CircleBase
        s={s}
        iconStyle={i}
        style={{
          border: "2px solid white",
          boxShadow:
            "0 0 0 1px rgba(15,23,42,0.6), 0 2px 4px rgba(0,0,0,0.35)",
        }}
      />
    ),
  },
];

// ────────────────────────────────────────────────────────────────────────
// Icon "font" options
// ────────────────────────────────────────────────────────────────────────

const ICON_STYLES: { key: IconStyle; name: string; desc: string }[] = [
  { key: "lucide-thin",   name: "1 · Thin stroke",   desc: "Lucide @ stroke 1.5 (current)." },
  { key: "lucide-normal", name: "2 · Normal stroke", desc: "Lucide @ stroke 2 — slight bump." },
  { key: "lucide-bold",   name: "3 · Bold stroke",   desc: "Lucide @ stroke 2.75 — chunky." },
  { key: "filled",        name: "4 · Filled glyph",  desc: "Solid icons (no stroke). Bolder, app-icon read." },
];

// ────────────────────────────────────────────────────────────────────────
// Layout helpers
// ────────────────────────────────────────────────────────────────────────

function MapBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative px-6 py-8 rounded-xl overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.35) 0, transparent 22%), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.08) 0, transparent 25%), radial-gradient(circle at 60% 20%, rgba(0,0,0,0.25) 0, transparent 18%), linear-gradient(135deg, #2f3a2a 0%, #4a553f 35%, #6b6457 60%, #3a4434 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-5 opacity-50"
        style={{
          background:
            "linear-gradient(180deg, transparent, #1f1f1f 30%, #2a2a2a 50%, #1f1f1f 70%, transparent)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function StatusRow({
  render,
}: {
  render: (s: StatusItem) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-around gap-5">
      {STATUSES.map((s) => (
        <div key={s.key} className="flex flex-col items-center gap-2">
          {render(s)}
          <div className="text-[10px] uppercase tracking-wide text-white/85 font-medium drop-shadow">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PinStylesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
            Design exploration
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Door-knock pins — circle variations
          </h1>
          <p className="mt-2 text-zinc-400 max-w-2xl">
            All circles, same 28px footprint as today. Two axes:{" "}
            <span className="text-zinc-200">ring/border treatment</span> (rows
            below) and{" "}
            <span className="text-zinc-200">icon style</span> (columns).
            Final pin = one ring × one icon.
          </p>
        </header>

        {/* SECTION 1 — Ring/border variants, normal-stroke icons */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-1">Ring &amp; border</h2>
          <p className="text-sm text-zinc-400 mb-5">
            Same icons (Lucide stroke 2) — vary only the outline of the circle.
          </p>
          <div className="grid gap-5">
            {RING_VARIANTS.map((v) => (
              <div
                key={v.key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
              >
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-6">
                  <div>
                    <div className="text-sm font-semibold">{v.name}</div>
                    <div className="text-xs text-zinc-400">{v.desc}</div>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <MapBackdrop>
                    <StatusRow render={(s) => v.render(s, "lucide-normal")} />
                  </MapBackdrop>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2 — Icon style variants, current ring */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-1">Icon style</h2>
          <p className="text-sm text-zinc-400 mb-5">
            Same ring (current — 2px white) — vary only the glyph weight / fill.
          </p>
          <div className="grid gap-5">
            {ICON_STYLES.map((i) => (
              <div
                key={i.key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
              >
                <div className="px-5 pt-4 pb-3">
                  <div className="text-sm font-semibold">{i.name}</div>
                  <div className="text-xs text-zinc-400">{i.desc}</div>
                </div>
                <div className="px-5 pb-5">
                  <MapBackdrop>
                    <StatusRow
                      render={(s) =>
                        RING_VARIANTS[0].render(s, i.key)
                      }
                    />
                  </MapBackdrop>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3 — Combined preview: each ring with bold + filled */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-1">Combined preview</h2>
          <p className="text-sm text-zinc-400 mb-5">
            Each ring style paired with bold-stroke (top) and filled (bottom)
            icons, so you can see which combo reads best.
          </p>
          <div className="grid gap-5">
            {RING_VARIANTS.map((v) => (
              <div
                key={v.key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
              >
                <div className="px-5 pt-4 pb-3">
                  <div className="text-sm font-semibold">{v.name}</div>
                </div>
                <div className="px-5 pb-5 grid gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">
                      Bold stroke
                    </div>
                    <MapBackdrop>
                      <StatusRow render={(s) => v.render(s, "lucide-bold")} />
                    </MapBackdrop>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">
                      Filled
                    </div>
                    <MapBackdrop>
                      <StatusRow render={(s) => v.render(s, "filled")} />
                    </MapBackdrop>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 text-sm text-zinc-500">
          Tell me the ring + icon combo to land on (e.g. &ldquo;D + filled&rdquo;)
          and I&apos;ll wire it into{" "}
          <code className="text-zinc-300">makeMarkerElement</code> in{" "}
          <code className="text-zinc-300">MapClient.tsx</code> and remove this
          page.
        </footer>
      </div>
    </div>
  );
}
