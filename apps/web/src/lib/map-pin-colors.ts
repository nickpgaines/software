import {
  Ban,
  DollarSign,
  FileText,
  Home,
  RotateCcw,
  ShieldX,
  Skull,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

// Canonical door-knock pin status registry. The same eight statuses surface
// on the map markers, the drop/detail sheets, the scorecard knocking stats,
// and the reports tables — every UI reads from this object so colors and
// icons stay aligned across the app.
//
// Visual treatment is "holographic": translucent colored background with a
// brighter same-color icon inside. Renderers compose
// `${color}26` (~15%) for the fill, `${color}80` (~50%) for the border, and
// the full color for the icon glyph. See DESIGN_SYSTEM.md §8 "Door-knock
// map pins".
export const PIN_STATUS = {
  sale:           { label: "Sale",           color: "#22c55e", icon: DollarSign },
  not_home:       { label: "Not Home",       color: "#f59e0b", icon: Home },
  not_interested: { label: "Not Interested", color: "#ef4444", icon: Ban },
  not_qualified:  { label: "Not Qualified",  color: "#a78bfa", icon: ShieldX },
  do_not_contact: { label: "Do Not Contact", color: "#94a3b8", icon: Skull },
  revisit:        { label: "Revisit",        color: "#22d3ee", icon: RotateCcw },
  referral:       { label: "Referral",       color: "#ec4899", icon: UserPlus },
  quote:          { label: "Quote",          color: "#3b82f6", icon: FileText },
} as const satisfies Record<string, { label: string; color: string; icon: LucideIcon }>;

export type PinStatus = keyof typeof PIN_STATUS;

export const PIN_STATUS_KEYS = Object.keys(PIN_STATUS) as PinStatus[];

// Older pin rows in the DB use legacy keys from the previous 6-status
// registry (come_back / quote_sent / do_not_return). Normalize on read so
// historical pins render in the same buckets as new ones.
const LEGACY_MAP: Record<string, PinStatus> = {
  come_back: "revisit",
  quote_sent: "quote",
  do_not_return: "do_not_contact",
};

export function normalizePinStatus(s: string | null | undefined): PinStatus {
  if (!s) return "not_home";
  if (s in PIN_STATUS) return s as PinStatus;
  if (s in LEGACY_MAP) return LEGACY_MAP[s];
  return "not_home";
}

export function isPinStatus(s: string): s is PinStatus {
  return s in PIN_STATUS || s in LEGACY_MAP;
}

// Filled glyph SVGs for the actual Mapbox markers. Lucide icons render via
// React in DOM surfaces (sheet, stats, table), but the map marker is a raw
// HTMLElement built outside the React tree, so we inline these.
//
// Stroke-based so the icon picks up `color: <hex>` from the marker element.
export function filledGlyphSvg(status: PinStatus, color: string, size = 16): string {
  const stroke = `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`;
  switch (status) {
    case "sale":
      return wrap(
        `<line x1="12" y1="2" x2="12" y2="22" ${stroke}/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" ${stroke}/>`
      );
    case "not_home":
      return wrap(
        `<path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z" ${stroke}/>`
      );
    case "not_interested":
      return wrap(
        `<circle cx="12" cy="12" r="9" ${stroke}/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" ${stroke}/>`
      );
    case "not_qualified":
      // Shield + small X (lucide ShieldX).
      return wrap(
        `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" ${stroke}/><line x1="9.5" y1="9.5" x2="14.5" y2="14.5" ${stroke}/><line x1="14.5" y1="9.5" x2="9.5" y2="14.5" ${stroke}/>`
      );
    case "do_not_contact":
      // Skull (lucide-ish).
      return wrap(
        `<path d="M5 11a7 7 0 0 1 14 0v3a3 3 0 0 1-2 2.8V20H7v-3.2A3 3 0 0 1 5 14z" ${stroke}/><circle cx="9" cy="13" r="1.2" fill="${color}"/><circle cx="15" cy="13" r="1.2" fill="${color}"/><line x1="11" y1="18" x2="13" y2="18" ${stroke}/>`
      );
    case "revisit":
      return wrap(
        `<polyline points="21 4 21 10 15 10" ${stroke}/><path d="M3.5 14a8 8 0 0 0 14.5 4l3-3" ${stroke}/><polyline points="3 20 3 14 9 14" ${stroke}/><path d="M20.5 10a8 8 0 0 0-14.5-4l-3 3" ${stroke}/>`
      );
    case "referral":
      // User-plus (lucide).
      return wrap(
        `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" ${stroke}/><circle cx="9" cy="7" r="4" ${stroke}/><line x1="19" y1="8" x2="19" y2="14" ${stroke}/><line x1="22" y1="11" x2="16" y2="11" ${stroke}/>`
      );
    case "quote":
      return wrap(
        `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" ${stroke}/><polyline points="14 2 14 8 20 8" ${stroke}/><line x1="8" y1="13" x2="16" y2="13" ${stroke}/><line x1="8" y1="17" x2="14" y2="17" ${stroke}/>`
      );
  }
}
