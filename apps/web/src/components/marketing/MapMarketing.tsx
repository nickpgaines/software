/**
 * Marketing-page map. Renders a Mapbox satellite-streets-v12 static image
 * (the same style the live `MapClient` defaults to) with holographic CRM
 * pins overlaid via React using the canonical `PIN_STATUS` registry.
 *
 * The pins share their colors, icons, and visual treatment with the live
 * map by importing from `lib/map-pin-colors.ts` — same source of truth.
 * The image itself is a single Mapbox Static API call, so the marketing
 * page doesn't load mapbox-gl-js or stream tiles. Non-interactive by
 * design: no pan, no zoom, no drag.
 */

import {
  PIN_STATUS,
  filledGlyphSvg,
  type PinStatus,
} from "@/lib/map-pin-colors";

// Center + zoom for a generic, well-lit suburban grid that looks great
// from the satellite-streets style at this zoom. Picked so the image is
// recognizably residential without identifying any specific location.
const CENTER_LNG = -96.6519;
const CENTER_LAT = 32.9343;
const ZOOM = 16.2;
const W = 1280;
const H = 960;

function staticMapUrl(token: string): string {
  // satellite-streets-v12 to match MapClient's default SATELLITE_STYLE.
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
    `${CENTER_LNG},${CENTER_LAT},${ZOOM},0,0/${W}x${H}@2x` +
    `?access_token=${token}` +
    `&logo=false&attribution=false`
  );
}

// Pin positions are picked as % of image dimensions rather than lat/lng
// because the marketing surface is a fixed image — we control exactly
// where the houses and streets land. Each cluster sits along a visible
// street so the layout reads as door-to-door work, not random sprinkle.
type Pin = { x: number; y: number; status: PinStatus };
const PINS: Pin[] = [
  // Top-left cluster — heavy sale activity
  { x: 14, y: 16, status: "sale" },
  { x: 18, y: 16, status: "sale" },
  { x: 22, y: 16, status: "quote" },
  { x: 14, y: 22, status: "sale" },
  { x: 18, y: 22, status: "not_home" },
  { x: 22, y: 22, status: "sale" },
  { x: 14, y: 28, status: "revisit" },
  { x: 18, y: 28, status: "sale" },
  { x: 22, y: 28, status: "sale" },

  // Top-right block
  { x: 62, y: 14, status: "sale" },
  { x: 66, y: 14, status: "quote" },
  { x: 70, y: 14, status: "sale" },
  { x: 74, y: 14, status: "revisit" },
  { x: 78, y: 14, status: "sale" },
  { x: 62, y: 20, status: "sale" },
  { x: 66, y: 20, status: "not_home" },
  { x: 70, y: 20, status: "quote" },
  { x: 74, y: 20, status: "sale" },
  { x: 78, y: 20, status: "sale" },

  // Middle suburb cluster
  { x: 40, y: 40, status: "sale" },
  { x: 44, y: 40, status: "quote" },
  { x: 48, y: 40, status: "sale" },
  { x: 52, y: 40, status: "sale" },
  { x: 40, y: 46, status: "not_interested" },
  { x: 44, y: 46, status: "sale" },
  { x: 48, y: 46, status: "referral" },
  { x: 52, y: 46, status: "revisit" },

  // Bottom-left
  { x: 12, y: 60, status: "sale" },
  { x: 16, y: 60, status: "sale" },
  { x: 20, y: 60, status: "quote" },
  { x: 24, y: 60, status: "sale" },
  { x: 12, y: 66, status: "sale" },
  { x: 16, y: 66, status: "not_home" },
  { x: 20, y: 66, status: "sale" },
  { x: 24, y: 66, status: "referral" },

  // Bottom-right
  { x: 62, y: 58, status: "sale" },
  { x: 66, y: 58, status: "sale" },
  { x: 70, y: 58, status: "quote" },
  { x: 74, y: 58, status: "sale" },
  { x: 78, y: 58, status: "revisit" },
  { x: 62, y: 64, status: "sale" },
  { x: 66, y: 64, status: "not_qualified" },
  { x: 70, y: 64, status: "sale" },
  { x: 74, y: 64, status: "sale" },

  // Scatter along the arterial
  { x: 35, y: 32, status: "quote" },
  { x: 50, y: 35, status: "sale" },
  { x: 55, y: 52, status: "sale" },
  { x: 30, y: 56, status: "revisit" },
];

// Statuses shown in the legend, in display order.
const LEGEND_STATUSES: PinStatus[] = [
  "sale",
  "quote",
  "revisit",
  "not_home",
  "not_interested",
  "referral",
];

export function MapMarketing() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden border border-line bg-card">
      {token ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticMapUrl(token)}
          alt="Door-knock map preview"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        // Fallback if the marketing build runs without a Mapbox token —
        // unlikely in production, but keeps the page rendering.
        <div className="absolute inset-0 bg-[#0a0a0c]" />
      )}

      {/* Solid-fill pins — same Flyra-style treatment as `makeMarkerElement`
          in MapClient (solid `color` circle, filled `textColor` glyph, glow). */}
      {PINS.map((p, i) => {
        const meta = PIN_STATUS[p.status];
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: "translate(-50%, -50%)",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: meta.color,
              color: meta.textColor,
              boxShadow: `0 0 0 1px ${meta.color}, 0 0 12px 2px ${meta.color}cc, 0 0 24px 4px ${meta.color}55, 0 2px 4px rgba(0,0,0,0.45)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            // The icon SVG comes from the same `filledGlyphSvg` the live
            // map uses for its DOM markers, so the glyph + viewbox match
            // exactly.
            dangerouslySetInnerHTML={{
              __html: filledGlyphSvg(p.status, meta.textColor, 16),
            }}
          />
        );
      })}

      {/* Legend chip — bottom-left */}
      <div className="absolute bottom-4 left-4 right-4 md:right-auto bg-card/95 backdrop-blur border border-line rounded-xl px-4 py-3 flex items-center gap-4 md:gap-5 flex-wrap">
        {LEGEND_STATUSES.map((s) => {
          const meta = PIN_STATUS[s];
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: meta.color }}
              />
              <span className="text-[11.5px] font-extrabold text-zinc-300 whitespace-nowrap">
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stat chip — top-right */}
      <div className="absolute top-4 right-4 bg-card/95 backdrop-blur border border-line rounded-xl px-4 py-3">
        <div className="text-[10px] font-extrabold tracking-[0.18em] uppercase text-zinc-500">
          Today
        </div>
        <div className="mt-1 text-[20px] font-black tracking-tight tabular-nums text-white">
          {PINS.length}{" "}
          <span className="text-[12px] font-bold text-zinc-400">doors</span>
        </div>
      </div>
    </div>
  );
}
