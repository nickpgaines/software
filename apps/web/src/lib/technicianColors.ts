// Shared color map for technician swatches and per-technician job blocks
// on the schedule. Keys are kept in sync with the EmployeeForm color
// picker and the ALLOWED_COLORS list in /api/staff. Tailwind's JIT picks
// up these literal class strings via content scanning, so referencing
// them by `bg-${color}-500` would not work — they must be enumerated.

export type TechColorKey =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "teal"
  | "pink"
  | "gray";

export const TECH_COLOR_KEYS: TechColorKey[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "teal",
  "pink",
  "gray",
];

export const TECH_COLOR_OPTIONS: { key: TechColorKey; label: string; swatch: string }[] = [
  { key: "blue", label: "Blue", swatch: "bg-blue-500" },
  { key: "green", label: "Green", swatch: "bg-green-500" },
  { key: "red", label: "Red", swatch: "bg-red-500" },
  { key: "yellow", label: "Yellow", swatch: "bg-yellow-400" },
  { key: "purple", label: "Purple", swatch: "bg-purple-500" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500" },
  { key: "teal", label: "Teal", swatch: "bg-teal-500" },
  { key: "pink", label: "Pink", swatch: "bg-pink-500" },
  { key: "gray", label: "Gray", swatch: "bg-slate-400" },
];

const SWATCH: Record<TechColorKey, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  gray: "bg-slate-400",
};

// Per-technician job block classes for the "scheduled" (not-started)
// state. Translucent fill + colored left accent matches the visual
// weight of the status-color blocks (completed_paid / completed_unpaid)
// it sits alongside.
const JOB_CLASSES: Record<TechColorKey, string> = {
  blue:
    "bg-blue-500/15 border-blue-500/40 text-blue-100 border-l-4 border-l-blue-400",
  green:
    "bg-green-500/15 border-green-500/40 text-green-100 border-l-4 border-l-green-400",
  red:
    "bg-red-500/15 border-red-500/40 text-red-100 border-l-4 border-l-red-400",
  yellow:
    "bg-yellow-400/15 border-yellow-400/40 text-yellow-100 border-l-4 border-l-yellow-300",
  purple:
    "bg-purple-500/15 border-purple-500/40 text-purple-100 border-l-4 border-l-purple-400",
  orange:
    "bg-orange-500/15 border-orange-500/40 text-orange-100 border-l-4 border-l-orange-400",
  teal:
    "bg-teal-500/15 border-teal-500/40 text-teal-100 border-l-4 border-l-teal-400",
  pink:
    "bg-pink-500/15 border-pink-500/40 text-pink-100 border-l-4 border-l-pink-400",
  gray:
    "bg-slate-500/15 border-slate-500/40 text-zinc-200 border-l-4 border-l-slate-400",
};

export function techColorKey(color: string | null | undefined): TechColorKey {
  if (color && (TECH_COLOR_KEYS as string[]).includes(color)) {
    return color as TechColorKey;
  }
  return "blue";
}

export function techJobClasses(color: string | null | undefined): string {
  return JOB_CLASSES[techColorKey(color)];
}

export function techSwatchClass(color: string | null | undefined): string {
  return SWATCH[techColorKey(color)];
}

// Permission levels that get to see the whole company's schedule.
// Field techs and "own-jobs" salespeople are filtered to their own rows.
export const FULL_SCHEDULE_PERMISSIONS = new Set([
  "admin",
  "manager",
  "team_lead",
  "salesperson_all",
  "custom",
]);
