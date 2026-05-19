// Concept page: four directions for modernizing door-knock map pins.
// Static visual exploration — no data, no Mapbox, no logic. Renders each
// style against a faux satellite backdrop so the options can be compared
// against the current production pin (see MapClient.makeMarkerElement).
//
// Per CLAUDE.md §4: this is an exploration step — pick a direction here
// before introducing a new primitive into the design system.

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
// Style 1 — Teardrop (Flyra-inspired classic map pin, bolder + cleaner)
// ────────────────────────────────────────────────────────────────────────
function TeardropPin({ s, size = 44 }: { s: StatusItem; size?: number }) {
  const w = size * 0.78;
  const Icon = s.icon;
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  return (
    <div
      style={{ width: w, height: size }}
      className="relative drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
    >
      <svg viewBox="0 0 32 40" width={w} height={size} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16 0C7.2 0 0 7 0 15.4 0 26 16 40 16 40s16-14 16-24.6C32 7 24.8 0 16 0z"
          fill={s.color}
        />
      </svg>
      <div
        className="absolute inset-x-0 top-[16%] flex items-center justify-center"
        style={{ height: w }}
      >
        <Icon width={w * 0.46} height={w * 0.46} color={iconColor} strokeWidth={2.5} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Style 2 — Squircle Tile (app-icon energy, very flat & modern)
// ────────────────────────────────────────────────────────────────────────
function SquirclePin({ s, size = 36 }: { s: StatusItem; size?: number }) {
  const Icon = s.icon;
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  return (
    <div
      style={{
        width: size,
        height: size,
        background: s.color,
        borderRadius: size * 0.32,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)",
      }}
      className="flex items-center justify-center"
    >
      <Icon width={size * 0.52} height={size * 0.52} color={iconColor} strokeWidth={2.5} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Style 3 — Halo Ring (translucent outer halo + solid core; very Flyra)
// ────────────────────────────────────────────────────────────────────────
function HaloPin({ s, size = 40 }: { s: StatusItem; size?: number }) {
  const Icon = s.icon;
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  const core = size * 0.7;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `${s.color}33`, // 20% opacity halo ring
        borderRadius: "50%",
      }}
      className="flex items-center justify-center"
    >
      <div
        style={{
          width: core,
          height: core,
          background: s.color,
          borderRadius: "50%",
          boxShadow:
            "0 0 0 2px rgba(255,255,255,0.95), 0 2px 6px rgba(0,0,0,0.45)",
        }}
        className="flex items-center justify-center"
      >
        <Icon width={core * 0.55} height={core * 0.55} color={iconColor} strokeWidth={2.5} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Style 4 — Glassy Bevel (subtle gradient + inner white ring, premium)
// ────────────────────────────────────────────────────────────────────────
function GlassyPin({ s, size = 36 }: { s: StatusItem; size?: number }) {
  const Icon = s.icon;
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 25%, ${s.color}, ${s.color}cc 60%, ${s.color}99)`,
        borderRadius: "50%",
        boxShadow:
          "0 0 0 1.5px rgba(255,255,255,0.9) inset, 0 4px 10px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)",
      }}
      className="flex items-center justify-center relative overflow-hidden"
    >
      {/* glossy top highlight */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: 2,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)",
        }}
      />
      <Icon
        width={size * 0.5}
        height={size * 0.5}
        color={iconColor}
        strokeWidth={2.5}
        style={{ position: "relative" }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Current production pin (rendered for direct comparison)
// ────────────────────────────────────────────────────────────────────────
function CurrentPin({ s, size = 28 }: { s: StatusItem; size?: number }) {
  const Icon = s.icon;
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  return (
    <div
      style={{
        width: size,
        height: size,
        background: s.color,
        border: "2px solid white",
        borderRadius: "50%",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
      className="flex items-center justify-center"
    >
      <Icon width={size * 0.5} height={size * 0.5} color={iconColor} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Layout
// ────────────────────────────────────────────────────────────────────────

const VARIANTS = [
  {
    key: "current",
    name: "Current",
    tagline: "What ships today — 28px ringed circle.",
    render: (s: StatusItem) => <CurrentPin s={s} />,
    note: "Baseline for comparison.",
  },
  {
    key: "teardrop",
    name: "Option 1 — Teardrop",
    tagline: "Classic map pin, bolder + cleaner. Flyra-flavored.",
    render: (s: StatusItem) => <TeardropPin s={s} />,
    note:
      "Reads instantly as 'map location'. The point anchors to a precise spot, which is more accurate at high zoom. Best when pins are sparse.",
  },
  {
    key: "squircle",
    name: "Option 2 — Squircle tile",
    tagline: "App-icon energy. Flat, geometric, very modern.",
    render: (s: StatusItem) => <SquirclePin s={s} />,
    note:
      "Feels native to a dark/bold UI like ours. Larger icon tap target. Doesn't 'point' at a coordinate, so works best with center-anchored markers.",
  },
  {
    key: "halo",
    name: "Option 3 — Halo ring",
    tagline: "Translucent halo + solid core. Premium, soft.",
    render: (s: StatusItem) => <HaloPin s={s} />,
    note:
      "The translucent ring gives each pin breathing room on a busy satellite view. White inner ring makes the color pop. Closest to Flyra's read.",
  },
  {
    key: "glassy",
    name: "Option 4 — Glassy bevel",
    tagline: "Subtle gradient + inner white ring. Dimensional.",
    render: (s: StatusItem) => <GlassyPin s={s} />,
    note:
      "Same footprint as today's pin but with depth — top highlight + darker bottom. Feels like a polished iOS control. Most 'designed' of the four.",
  },
] as const;

export default function PinStylesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
            Design exploration
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Door-knock pin styles
          </h1>
          <p className="mt-2 text-zinc-400 max-w-2xl">
            Four directions for modernizing the map pins. Each style is shown
            against a faux satellite backdrop with the full status set, plus
            the current production pin at the top for comparison.
          </p>
        </header>

        <div className="grid gap-8">
          {VARIANTS.map((v) => (
            <section
              key={v.key}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
            >
              <div className="flex items-start justify-between gap-6 px-6 pt-5 pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{v.name}</h2>
                  <p className="text-sm text-zinc-400">{v.tagline}</p>
                </div>
                <div className="text-xs text-zinc-500 max-w-sm text-right hidden md:block">
                  {v.note}
                </div>
              </div>

              {/* Faux satellite backdrop */}
              <div
                className="relative px-6 py-10"
                style={{
                  background:
                    "linear-gradient(135deg, #2f3a2a 0%, #4a553f 35%, #6b6457 60%, #3a4434 100%)",
                  backgroundImage:
                    "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.35) 0, transparent 22%), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.08) 0, transparent 25%), radial-gradient(circle at 60% 20%, rgba(0,0,0,0.25) 0, transparent 18%), linear-gradient(135deg, #2f3a2a 0%, #4a553f 35%, #6b6457 60%, #3a4434 100%)",
                }}
              >
                {/* fake road */}
                <div
                  className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-6 opacity-50"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent, #1f1f1f 30%, #2a2a2a 50%, #1f1f1f 70%, transparent)",
                  }}
                />
                <div className="relative flex flex-wrap items-end justify-around gap-6">
                  {STATUSES.map((s) => (
                    <div key={s.key} className="flex flex-col items-center gap-2">
                      {v.render(s)}
                      <div className="text-[10px] uppercase tracking-wide text-white/85 font-medium drop-shadow">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:hidden px-6 py-3 text-xs text-zinc-500 border-t border-zinc-800">
                {v.note}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 text-sm text-zinc-500">
          Pick a direction and I'll wire it into{" "}
          <code className="text-zinc-300">makeMarkerElement</code> in{" "}
          <code className="text-zinc-300">MapClient.tsx</code> and document it
          as a new primitive in <code className="text-zinc-300">DESIGN_SYSTEM.md</code>.
        </footer>
      </div>
    </div>
  );
}
