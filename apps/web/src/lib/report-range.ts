export type ReportRange = "1w" | "1m" | "3m" | "1y";

export function resolveReportRange(range: string | null | undefined): {
  range: ReportRange;
  start: Date;
  end: Date;
} {
  const r: ReportRange =
    range === "1w" || range === "3m" || range === "1y" ? range : "1m";
  const end = new Date();
  const start = new Date(end);
  if (r === "1w") start.setDate(start.getDate() - 7);
  else if (r === "3m") start.setMonth(start.getMonth() - 3);
  else if (r === "1y") start.setFullYear(start.getFullYear() - 1);
  else start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return { range: r, start, end };
}
