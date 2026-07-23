// Shared phone-number formatting helpers.
//
// Storage convention: phone numbers are stored as plain strings exactly as
// the form submits them. Both helpers are display-side only — the API does
// no phone parsing of its own.

/**
 * Format a stored phone string for display: `(843) 504-5474`.
 * Accepts 10-digit numbers and 11-digit numbers with a leading 1.
 * Anything else is returned unchanged.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/**
 * As-you-type mask for phone inputs. Strips non-digits (and one optional
 * leading country-code 1), caps at 10 digits, and formats progressively:
 * "(704" → "(704) 123" → "(704) 123-4567".
 */
export function formatPhoneAsTyped(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
