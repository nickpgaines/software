// Concept page: 3 circle pin variants.
//   1. Flyra-style — filled glyph, no white outline, soft colored glow
//   2. Current — filled-color circle, 2px white outline, lucide outline icon
//   3. Current without the white outline
//
// All 28px circles. Pick one and it becomes the new production pin in
// MapClient.makeMarkerElement.

import type { ReactNode } from "react";
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

const SIZE = 28;
const ICON_SIZE = 14;

// Filled glyphs (Flyra-style — solid, no stroke). One per status.
function FilledGlyph({ kind, color, size }: { kind: string; color: string; size: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: color,
    xmlns: "http://www.w3.org/2000/svg",
  };
  switch (kind) {
    case "sale":
      return (
        <svg {...props}>
          <path d="M13 2.5v1.6a4.5 4.5 0 0 1 3.9 3.4l-2 .5A2.5 2.5 0 0 0 12 6c-1.7 0-3 1-3 2.3 0 1.2.9 1.8 3.5 2.3 3.2.6 4.5 1.8 4.5 4 0 2.2-1.6 3.9-4 4.3v1.6h-2v-1.6a4.7 4.7 0 0 1-4.2-3.7l2-.5A2.7 2.7 0 0 0 12 17c1.8 0 3-1 3-2.4 0-1.2-.8-1.8-3.5-2.3-3.1-.6-4.5-1.7-4.5-4 0-2.1 1.6-3.8 4-4.2V2.5h2z" />
        </svg>
      );
    case "not_home":
      return (
        <svg {...props}>
          <path d="M12 3.2 2.5 11.5c-.3.3-.1.8.3.8H5v8c0 .3.2.5.5.5h4V14h5v6.8h4c.3 0 .5-.2.5-.5v-8h2.2c.4 0 .6-.5.3-.8L12 3.2z" />
        </svg>
      );
    case "not_interested":
      // Donut ring (outer + inner via evenodd) + diagonal slash through it.
      return (
        <svg {...props} fillRule="evenodd" clipRule="evenodd">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z" />
          <rect x="10.85" y="3" width="2.3" height="18" rx="1.15" transform="rotate(45 12 12)" />
        </svg>
      );
    case "come_back":
      return (
        <svg {...props}>
          <path d="M4 4v6h6L7.5 7.5A6 6 0 0 1 18 12h2A8 8 0 0 0 6 6.4L4 4zm16 16v-6h-6l2.5 2.5A6 6 0 0 1 6 12H4a8 8 0 0 0 14 5.6L20 20z" />
        </svg>
      );
    case "quote_sent":
      return (
        <svg {...props}>
          <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15zm0 3h5v1.5H8V18z" />
        </svg>
      );
    case "do_not_return":
      return (
        <svg {...props}>
          <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.4 3.5 6.7V19a1 1 0 0 0 1 1h1v-2h1.5v2h2v-2H14v2h1a1 1 0 0 0 1-1v-2.3C18 15.4 20 13 20 10a8 8 0 0 0-8-8zM9 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4 4.5h2l-1 2-1-2z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

// ── Pin variants ─────────────────────────────────────────────────────────

// 1. Flyra-style — filled icon, no white ring, soft colored glow
function FlyraPin({ s }: { s: StatusItem }) {
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        background: s.color,
        borderRadius: "50%",
        boxShadow:
          `0 0 0 1px ${s.color}, 0 0 12px 2px ${s.color}cc, 0 0 24px 4px ${s.color}55, 0 2px 4px rgba(0,0,0,0.45)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FilledGlyph kind={s.key} color={iconColor} size={ICON_SIZE + 2} />
    </div>
  );
}

// 2. Current production pin — 2px white ring, lucide outline icon
function CurrentPin({ s }: { s: StatusItem }) {
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  const Icon = s.icon;
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        background: s.color,
        border: "2px solid white",
        borderRadius: "50%",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon width={ICON_SIZE} height={ICON_SIZE} color={iconColor} />
    </div>
  );
}

// 3. Current minus the white outline
function CurrentNoRingPin({ s }: { s: StatusItem }) {
  const iconColor = s.dark ? "#0f172a" : "#ffffff";
  const Icon = s.icon;
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        background: s.color,
        borderRadius: "50%",
        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon width={ICON_SIZE} height={ICON_SIZE} color={iconColor} />
    </div>
  );
}

const VARIANTS = [
  {
    key: "flyra",
    name: "Option 1 — Flyra-style",
    tagline: "Filled glyph, no white ring, soft colored glow. Slightly holographic.",
    render: (s: StatusItem) => <FlyraPin s={s} />,
  },
  {
    key: "current",
    name: "Option 2 — Current (baseline)",
    tagline: "2px white ring, outline icon. What ships today.",
    render: (s: StatusItem) => <CurrentPin s={s} />,
  },
  {
    key: "no-ring",
    name: "Option 3 — Current without white ring",
    tagline: "Same outline icon, but drop the white border.",
    render: (s: StatusItem) => <CurrentNoRingPin s={s} />,
  },
];

function MapBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative px-6 py-10 rounded-xl overflow-hidden"
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

export default function PinStylesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
            Design exploration
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Door-knock pins — 3 options
          </h1>
          <p className="mt-2 text-zinc-400 max-w-2xl">
            Same 28px circle footprint as today. Three variants for comparison.
          </p>
        </header>

        <div className="grid gap-6">
          {VARIANTS.map((v) => (
            <section
              key={v.key}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
            >
              <div className="px-6 pt-5 pb-4">
                <h2 className="text-lg font-semibold">{v.name}</h2>
                <p className="text-sm text-zinc-400">{v.tagline}</p>
              </div>
              <div className="px-6 pb-6">
                <MapBackdrop>
                  <div className="flex flex-wrap items-center justify-around gap-5">
                    {STATUSES.map((s) => (
                      <div key={s.key} className="flex flex-col items-center gap-2">
                        {v.render(s)}
                        <div className="text-[10px] uppercase tracking-wide text-white/85 font-medium drop-shadow">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </MapBackdrop>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 text-sm text-zinc-500">
          Tell me which option to land on and I&apos;ll wire it into{" "}
          <code className="text-zinc-300">makeMarkerElement</code> in{" "}
          <code className="text-zinc-300">MapClient.tsx</code> and remove this page.
        </footer>
      </div>
    </div>
  );
}
