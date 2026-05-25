import {
  PIN_STATUS,
  PIN_STATUS_KEYS,
  filledGlyphSvg,
  type PinStatus,
} from "@/lib/map-pin-colors";

// Standalone /design scratch page: the two door-knock pin treatments side by
// side so we can pick between them. The markup here mirrors the real
// renderers — the holographic marker in `makeMarkerElement` (MapClient.tsx,
// live now) and the solid-fill spec in DESIGN_SYSTEM.md §8.21 (the earlier
// look from the drop sheet + stats screenshots). Glyphs reuse the canonical
// `filledGlyphSvg`, exactly like the map, so nothing here is invented.

// Greenish-grey aerial backdrop so the holographic pins' translucent fill
// reads in context the way it does over the satellite basemap (over pure
// black it would look misleadingly like the solid style).
const MAP_BG =
  "radial-gradient(90% 90% at 30% 20%, #525a4b 0%, #3a4135 45%, #262b22 100%)";

function glyphTextColor(status: PinStatus): string {
  // §8.21: white glyph everywhere except Not Home, which uses dark slate for
  // contrast against the amber fill.
  return status === "not_home" ? "#0f172a" : "#ffffff";
}

function NowPin({ status, size = 30 }: { status: PinStatus; size?: number }) {
  const { color } = PIN_STATUS[status];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${color}26`,
        border: `1.5px solid ${color}`,
        color,
        boxShadow: `0 0 14px ${color}66, 0 2px 6px rgba(0,0,0,0.45)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dangerouslySetInnerHTML={{
        __html: filledGlyphSvg(status, color, Math.round(size * 0.53)),
      }}
    />
  );
}

function BeforePin({ status, size = 30 }: { status: PinStatus; size?: number }) {
  const { color } = PIN_STATUS[status];
  const glyph = glyphTextColor(status);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: glyph,
        boxShadow: `0 0 0 1px ${color}, 0 0 12px 2px ${color}cc, 0 0 24px 4px ${color}55, 0 2px 4px rgba(0,0,0,0.45)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dangerouslySetInnerHTML={{
        __html: filledGlyphSvg(status, glyph, Math.round(size * 0.53)),
      }}
    />
  );
}

function PinPanel({ kind }: { kind: "now" | "before" }) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ background: MAP_BG }}
    >
      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
        {PIN_STATUS_KEYS.map((key) => (
          <div key={key} className="flex flex-col items-center gap-2">
            {kind === "now" ? (
              <NowPin status={key} />
            ) : (
              <BeforePin status={key} />
            )}
            <span className="text-[11px] font-semibold text-white text-center leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {PIN_STATUS[key].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PinOptionsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1000px] px-6 py-12">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-3 font-bold">
            Pin styles
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Side by side — pick a pin style.
          </h1>
          <p className="text-sm text-white/60 mt-3 max-w-[640px] leading-relaxed">
            Same eight door-knock statuses, two visual treatments.{" "}
            <strong className="text-white">Now</strong> is what&apos;s live on{" "}
            <code className="text-white/80">/map</code> today.{" "}
            <strong className="text-white">Before</strong> is the earlier
            solid-fill look from your drop-sheet and stats screenshots.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-extrabold tracking-tight">
                Now — Holographic
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Live
              </span>
            </div>
            <PinPanel kind="now" />
            <p className="text-[12.5px] text-white/55 mt-3 leading-relaxed">
              Translucent colored fill, thin colored ring, <em>same-color</em>{" "}
              glyph, soft glow. Reads as glass over the map.
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-extrabold tracking-tight">
                Before — Solid fill
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Earlier
              </span>
            </div>
            <PinPanel kind="before" />
            <p className="text-[12.5px] text-white/55 mt-3 leading-relaxed">
              Solid colored fill, white glyph, soft colored glow. Higher
              contrast, reads bolder at a glance.
            </p>
          </div>
        </div>

        <h2 className="text-lg font-extrabold tracking-tight mb-4">
          Status by status
        </h2>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_8rem_8rem] items-center px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white/40 border-b border-white/10">
            <span>Status</span>
            <span className="text-center">Now</span>
            <span className="text-center">Before</span>
          </div>
          {PIN_STATUS_KEYS.map((key) => (
            <div
              key={key}
              className="grid grid-cols-[1fr_8rem_8rem] items-center px-5 py-4 border-b border-white/5 last:border-b-0"
            >
              <span
                className="text-sm font-extrabold"
                style={{ color: PIN_STATUS[key].color }}
              >
                {PIN_STATUS[key].label}
              </span>
              <div className="flex justify-center">
                <div
                  className="flex h-12 w-20 items-center justify-center rounded-xl border border-white/10"
                  style={{ background: MAP_BG }}
                >
                  <NowPin status={key} size={34} />
                </div>
              </div>
              <div className="flex justify-center">
                <div
                  className="flex h-12 w-20 items-center justify-center rounded-xl border border-white/10"
                  style={{ background: MAP_BG }}
                >
                  <BeforePin status={key} size={34} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[12px] text-white/40">
          Standalone preview at <code>/design/pin-options</code>. Nothing on the
          live map changes from this page — it&apos;s just for picking.
        </p>
      </div>
    </div>
  );
}
