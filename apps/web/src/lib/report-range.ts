export type ReportRange = "1w" | "1m" | "3m" | "1y" | "7d" | "30d" | "90d" | "ytd" | "custom";

const PRESETS = new Set<ReportRange>([
  "1w",
  "1m",
  "3m",
  "1y",
  "7d",
  "30d",
  "90d",
  "ytd",
]);

function parseIsoDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveReportRange(
  range: string | null | undefined,
  start?: string | null,
  end?: string | null,
): {
  range: ReportRange;
  start: Date;
  end: Date;
} {
  const customStart = parseIsoDate(start);
  const customEnd = parseIsoDate(end);
  if (range === "custom" && customStart && customEnd) {
    const s = new Date(customStart);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    return { range: "custom", start: s, end: e };
  }

  const r: ReportRange = PRESETS.has(range as ReportRange)
    ? (range as ReportRange)
    : "1m";
  const end_ = new Date();
  const startDate = new Date(end_);

  if (r === "1w" || r === "7d") {
    startDate.setDate(startDate.getDate() - 7);
  } else if (r === "30d") {
    startDate.setDate(startDate.getDate() - 30);
  } else if (r === "90d") {
    startDate.setDate(startDate.getDate() - 90);
  } else if (r === "3m") {
    startDate.setMonth(startDate.getMonth() - 3);
  } else if (r === "1y") {
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else if (r === "ytd") {
    startDate.setMonth(0, 1);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }
  startDate.setHours(0, 0, 0, 0);
  return { range: r, start: startDate, end: end_ };
}

export function resolveReportRangeFromUrl(url: URL): {
  range: ReportRange;
  start: Date;
  end: Date;
} {
  return resolveReportRange(
    url.searchParams.get("range"),
    url.searchParams.get("start"),
    url.searchParams.get("end"),
  );
}
