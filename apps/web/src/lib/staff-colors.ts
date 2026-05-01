export const STAFF_COLOR_HEX: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#eab308",
  purple: "#a855f7",
  orange: "#f97316",
  teal: "#14b8a6",
  pink: "#ec4899",
  gray: "#94a3b8",
};

export function staffColorHex(name: string | null | undefined): string {
  if (!name) return STAFF_COLOR_HEX.blue;
  return STAFF_COLOR_HEX[name] || STAFF_COLOR_HEX.blue;
}
