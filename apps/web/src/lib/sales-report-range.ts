import { TZDateMini } from "@date-fns/tz";
export type SalesDate = InstanceType<typeof TZDateMini>;

export type SalesRange = "today" | "yesterday" | "1w" | "1m" | "3m" | "ytd" | "custom";
const presets = new Set(["today", "yesterday", "1w", "7d", "1m", "30d", "3m", "90d", "1y", "ytd"]);

export function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDay(value: string | null, zone: string): SalesDate {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid start and end date.");
  const [year, month, day] = value.split("-").map(Number);
  const result = new TZDateMini(year, month - 1, day, zone);
  if (calendarDay(result) !== value) throw new Error("Choose a valid start and end date.");
  return result;
}

/** Date-only subscription starts are calendar dates; SQLite timestamps are UTC. */
export function salesTimestamp(value: string, zone: string): SalesDate {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try { return parseDay(value, zone); } catch { return new TZDateMini(NaN, zone); }
  }
  const iso = value.replace(" ", "T");
  return new TZDateMini(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`, zone);
}

/** Sales-only range semantics: local calendar days, with an exclusive end. */
export function resolveSalesRange(url: URL, now: Date = new Date()) {
  const zone = url.searchParams.get("timeZone") || "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); }
  catch { throw new Error("Choose a valid time zone."); }
  const requested = url.searchParams.get("range");
  const range = requested === "custom" || presets.has(requested || "") ? requested! : "1m";
  let start = new TZDateMini(now.getTime(), zone);
  let end = new TZDateMini(now.getTime(), zone);
  if (range === "custom") {
    start = parseDay(url.searchParams.get("start"), zone);
    end = parseDay(url.searchParams.get("end"), zone);
    end.setDate(end.getDate() + 1);
  } else if (range === "today" || range === "yesterday") {
    start.setHours(0, 0, 0, 0);
    if (range === "yesterday") start.setDate(start.getDate() - 1);
    end = new TZDateMini(start.getTime(), zone);
    end.setDate(end.getDate() + 1);
  } else {
    if (range === "1w" || range === "7d") start.setDate(start.getDate() - 7);
    else if (range === "30d") start.setDate(start.getDate() - 30);
    else if (range === "90d") start.setDate(start.getDate() - 90);
    else if (range === "3m") start.setMonth(start.getMonth() - 3);
    else if (range === "1y") start.setFullYear(start.getFullYear() - 1);
    else if (range === "ytd") start.setMonth(0, 1);
    else start.setMonth(start.getMonth() - 1);
    start.setHours(0, 0, 0, 0);
  }
  if (!(start < end) || end.getTime() - start.getTime() > 3660 * 86400000) {
    throw new Error("Choose an end date on or after the start, within ten years.");
  }
  const priorEnd = new TZDateMini(start.getTime(), zone);
  let priorStart = new TZDateMini(start.getTime() - (end.getTime() - start.getTime()), zone);
  if (range === "custom" || range === "today" || range === "yesterday") {
    // Calendar arithmetic, not a fixed 24-hour subtraction across DST.
    const days = Math.round((Date.parse(calendarDay(end)) - Date.parse(calendarDay(start))) / 86400000);
    priorStart = new TZDateMini(start.getTime(), zone);
    priorStart.setDate(priorStart.getDate() - days);
  } else if (range === "ytd") {
    priorStart = new TZDateMini(start.getTime(), zone);
    priorStart.setFullYear(priorStart.getFullYear() - 1);
    priorEnd.setTime(end.getTime());
    priorEnd.setFullYear(priorEnd.getFullYear() - 1);
  }
  return { range, start, end, zone, prior: { start: priorStart, end: priorEnd } };
}

export function salesDays(start: SalesDate, end: Date): { date: string }[] {
  const cursor = new TZDateMini(start.getTime(), start.timeZone);
  cursor.setHours(0, 0, 0, 0);
  const days: { date: string }[] = [];
  while (cursor < end) {
    days.push({ date: calendarDay(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
