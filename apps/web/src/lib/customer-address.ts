export type AddressInput = {
  address_line1?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formatted_address?: string | null;
};

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function buildFormattedAddress(input: AddressInput): string {
  const supplied = clean(input.formatted_address);
  if (supplied) return supplied;
  const line1 = clean(input.address_line1);
  const unit = clean(input.unit);
  const city = clean(input.city);
  const state = clean(input.state);
  const zip = clean(input.zip);
  const street = unit ? `${line1}${line1 ? ", " : ""}${unit}` : line1;
  const cityState = [city, [state, zip].filter(Boolean).join(" ")]
    .filter((s) => s.trim())
    .join(", ");
  return [street, cityState].filter((s) => s && s.trim()).join(", ");
}

export type ResolvedAddress = {
  address: string | null;
  address_line1: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
};

/**
 * Normalize an incoming address payload.
 *
 * - Builds formatted_address from parts if not supplied.
 * - Mirrors formatted_address into the legacy `address` column so any
 *   read path that still queries `address` keeps working.
 * - Treats blank strings as null.
 */
export function normalizeAddress(
  input: AddressInput,
  fallback: { legacyAddress?: string | null } = {}
): ResolvedAddress {
  const line1 = clean(input.address_line1);
  const unit = clean(input.unit);
  const city = clean(input.city);
  const state = clean(input.state);
  const zip = clean(input.zip);
  const formatted = buildFormattedAddress(input);
  // The legacy `address` column gets the formatted string when we have
  // structured data; otherwise fall back to whatever was passed in or
  // the existing legacy value (used by PATCH).
  const legacy =
    formatted ||
    clean(fallback.legacyAddress) ||
    "";
  const lat =
    typeof input.latitude === "number" && !Number.isNaN(input.latitude)
      ? input.latitude
      : null;
  const lng =
    typeof input.longitude === "number" && !Number.isNaN(input.longitude)
      ? input.longitude
      : null;
  return {
    address: legacy || null,
    address_line1: line1 || null,
    unit: unit || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    latitude: lat,
    longitude: lng,
    formatted_address: formatted || null,
  };
}
