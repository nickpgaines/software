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
// Visual treatment is "solid-fill" (Flyra-style): a solid circle in the
// status color, a filled white glyph (`textColor`), and a soft layered
// colored glow. See DESIGN_SYSTEM.md §8.21 "Door-knock map pins".
export const PIN_STATUS = {
  sale:           { label: "Sale",           color: "#22c55e", textColor: "#ffffff", icon: DollarSign },
  not_home:       { label: "Not Home",       color: "#f59e0b", textColor: "#ffffff", icon: Home },
  not_interested: { label: "Not Interested", color: "#ef4444", textColor: "#ffffff", icon: Ban },
  not_qualified:  { label: "Not Qualified",  color: "#a78bfa", textColor: "#ffffff", icon: ShieldX },
  do_not_contact: { label: "Do Not Contact", color: "#94a3b8", textColor: "#ffffff", icon: Skull },
  revisit:        { label: "Revisit",        color: "#22d3ee", textColor: "#ffffff", icon: RotateCcw },
  referral:       { label: "Referral",       color: "#ec4899", textColor: "#ffffff", icon: UserPlus },
  quote:          { label: "Quote",          color: "#3b82f6", textColor: "#ffffff", icon: FileText },
} as const satisfies Record<string, { label: string; color: string; textColor: string; icon: LucideIcon }>;

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

// Filled glyph SVGs for the solid-fill markers/swatches. Lucide outline
// icons render via React in the small stat/report chips, but the actual map
// marker is a raw HTMLElement built outside the React tree, and the pin
// swatches (drop modal, door sheet) mirror it, so those inline these solid
// glyphs for the bolder, glow-friendly Flyra look. `color` here is the
// glyph fill (the status `textColor`), drawn against the solid pin color.
export function filledGlyphSvg(status: PinStatus, color: string, size = 16): string {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">`;
  switch (status) {
    case "sale":
      return `${open}<path d="M13 2.5v1.6a4.5 4.5 0 0 1 3.9 3.4l-2 .5A2.5 2.5 0 0 0 12 6c-1.7 0-3 1-3 2.3 0 1.2.9 1.8 3.5 2.3 3.2.6 4.5 1.8 4.5 4 0 2.2-1.6 3.9-4 4.3v1.6h-2v-1.6a4.7 4.7 0 0 1-4.2-3.7l2-.5A2.7 2.7 0 0 0 12 17c1.8 0 3-1 3-2.4 0-1.2-.8-1.8-3.5-2.3-3.1-.6-4.5-1.7-4.5-4 0-2.1 1.6-3.8 4-4.2V2.5h2z"/></svg>`;
    case "not_home":
      return `${open}<path d="M12 3.2 2.5 11.5c-.3.3-.1.8.3.8H5v8c0 .3.2.5.5.5h4V14h5v6.8h4c.3 0 .5-.2.5-.5v-8h2.2c.4 0 .6-.5.3-.8L12 3.2z"/></svg>`;
    case "not_interested":
      // Donut ring (evenodd) + diagonal slash — the classic prohibition mark.
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" fill-rule="evenodd" clip-rule="evenodd"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z"/><rect x="10.85" y="3" width="2.3" height="18" rx="1.15" transform="rotate(45 12 12)"/></svg>`;
    case "not_qualified":
      // Filled shield with an X knocked out (single-path cross → clean hole
      // under evenodd, rotated 45° into an X).
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" fill-rule="evenodd" clip-rule="evenodd"><path d="M12 2.2 4.6 5A1.4 1.4 0 0 0 3.6 6.3v5.1c0 4.6 3.3 7.7 8 9.2 4.7-1.5 8-4.6 8-9.2V6.3A1.4 1.4 0 0 0 18.6 5L12 2.2z"/><path transform="rotate(45 12 12)" d="M10.9 7.8h2.2v3.1h3.1v2.2h-3.1v3.1h-2.2v-3.1H7.8v-2.2h3.1z"/></svg>`;
    case "do_not_contact":
      // Skull: eye sockets + nose are holes via path winding.
      return `${open}<path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.4 3.5 6.7V19a1 1 0 0 0 1 1h1v-2h1.5v2h2v-2H14v2h1a1 1 0 0 0 1-1v-2.3C18 15.4 20 13 20 10a8 8 0 0 0-8-8zM9 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4 4.5h2l-1 2-1-2z"/></svg>`;
    case "revisit":
      return `${open}<path d="M4 4v6h6L7.5 7.5A6 6 0 0 1 18 12h2A8 8 0 0 0 6 6.4L4 4zm16 16v-6h-6l2.5 2.5A6 6 0 0 1 6 12H4a8 8 0 0 0 14 5.6L20 20z"/></svg>`;
    case "referral":
      // Filled person + plus badge (two solid shapes, no holes needed).
      return `${open}<path d="M9.5 4a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6zM4.4 19.8c-.5 0-.9-.4-.9-.9 0-3.3 2.6-5.3 6-5.3 1.2 0 2.3.2 3.2.7a4.7 4.7 0 0 0-.4 5.5H4.4z"/><path d="M18 11h1.5v2.5H22V15h-2.5v2.5H18V15h-2.5v-1.5H18z"/></svg>`;
    case "quote":
      return `${open}<path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15zm0 3h5v1.5H8V18z"/></svg>`;
  }
}
