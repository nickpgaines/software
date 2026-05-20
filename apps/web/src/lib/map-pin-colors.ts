import { DollarSign, Home, Ban, FileText, RotateCcw, Skull } from "lucide-react";

export const PIN_STATUS = {
  sale:           { label: "Sale",            color: "#22c55e", textColor: "#ffffff", icon: DollarSign },
  not_home:       { label: "Not home",        color: "#facc15", textColor: "#0f172a", icon: Home },
  not_interested: { label: "Not interested",  color: "#ef4444", textColor: "#ffffff", icon: Ban },
  come_back:      { label: "Come back later", color: "#3b82f6", textColor: "#ffffff", icon: RotateCcw },
  quote_sent:     { label: "Quote sent",      color: "#f97316", textColor: "#ffffff", icon: FileText },
  do_not_return:  { label: "Do not return",   color: "#0f172a", textColor: "#ffffff", icon: Skull },
} as const;

export type PinStatus = keyof typeof PIN_STATUS;

export function isPinStatus(s: string): s is PinStatus {
  return s in PIN_STATUS;
}

// ---------------------------------------------------------------------------
// Filled glyph SVGs for map markers ("Flyra-style" pins).
//
// The lucide icons in PIN_STATUS are outline icons — used in UI surfaces
// (icon strip, drop modal, popup chrome). The actual map markers render
// these solid filled versions for the bolder, glow-friendly Flyra look.
// See DESIGN_SYSTEM.md §8 "Door-knock map pins".
// ---------------------------------------------------------------------------
export function filledGlyphSvg(status: PinStatus, color: string, size = 16): string {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">`;
  switch (status) {
    case "sale":
      return `${open}<path d="M13 2.5v1.6a4.5 4.5 0 0 1 3.9 3.4l-2 .5A2.5 2.5 0 0 0 12 6c-1.7 0-3 1-3 2.3 0 1.2.9 1.8 3.5 2.3 3.2.6 4.5 1.8 4.5 4 0 2.2-1.6 3.9-4 4.3v1.6h-2v-1.6a4.7 4.7 0 0 1-4.2-3.7l2-.5A2.7 2.7 0 0 0 12 17c1.8 0 3-1 3-2.4 0-1.2-.8-1.8-3.5-2.3-3.1-.6-4.5-1.7-4.5-4 0-2.1 1.6-3.8 4-4.2V2.5h2z"/></svg>`;
    case "not_home":
      return `${open}<path d="M12 3.2 2.5 11.5c-.3.3-.1.8.3.8H5v8c0 .3.2.5.5.5h4V14h5v6.8h4c.3 0 .5-.2.5-.5v-8h2.2c.4 0 .6-.5.3-.8L12 3.2z"/></svg>`;
    case "not_interested":
      // Donut ring (evenodd) + diagonal slash.
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" fill-rule="evenodd" clip-rule="evenodd"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z"/><rect x="10.85" y="3" width="2.3" height="18" rx="1.15" transform="rotate(45 12 12)"/></svg>`;
    case "come_back":
      return `${open}<path d="M4 4v6h6L7.5 7.5A6 6 0 0 1 18 12h2A8 8 0 0 0 6 6.4L4 4zm16 16v-6h-6l2.5 2.5A6 6 0 0 1 6 12H4a8 8 0 0 0 14 5.6L20 20z"/></svg>`;
    case "quote_sent":
      return `${open}<path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15zm0 3h5v1.5H8V18z"/></svg>`;
    case "do_not_return":
      return `${open}<path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.4 3.5 6.7V19a1 1 0 0 0 1 1h1v-2h1.5v2h2v-2H14v2h1a1 1 0 0 0 1-1v-2.3C18 15.4 20 13 20 10a8 8 0 0 0-8-8zM9 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4 4.5h2l-1 2-1-2z"/></svg>`;
  }
}
