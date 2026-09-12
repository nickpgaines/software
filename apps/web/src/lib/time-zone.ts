export const DEFAULT_COMPANY_TIME_ZONE = "America/New_York";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch { return false; }
}

export function companyTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : DEFAULT_COMPANY_TIME_ZONE;
}
