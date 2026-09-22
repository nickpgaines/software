export const COMPANY_TRIAL_DAYS = 14;
const TRIAL_MS = COMPANY_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Legacy SQLite datetime('now') values are UTC, never server-local time. */
export function companyTrialEndsAt(startedAt: string | null, now: Date): string | null {
  if (!startedAt) return null;
  const sqlDate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(startedAt);
  const normalized = sqlDate ? `${startedAt.replace(' ', 'T')}Z` : startedAt;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) return null;
  const start = Date.parse(normalized);
  if (!Number.isFinite(start) || start > now.getTime()) return null;
  // Date.parse normalizes impossible calendar days (e.g. February 30).
  const calendarDate = normalized.slice(0, 10);
  if (new Date(`${calendarDate}T00:00:00Z`).toISOString().slice(0, 10) !== calendarDate) return null;
  return new Date(start + TRIAL_MS).toISOString();
}
