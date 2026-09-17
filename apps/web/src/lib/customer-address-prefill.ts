import type { AddressValue } from "@/components/customers/AddressFields";

/** Capture navigation values before a create page removes its query string. */
export function addressFromSearchParams(params: { get(key: string): string | null }): AddressValue {
  const rawLat = params.get("latitude");
  const rawLng = params.get("longitude");
  const lat = rawLat?.trim() ? Number(rawLat) : NaN;
  const lng = rawLng?.trim() ? Number(rawLng) : NaN;
  const validCoordinates = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  return {
    address_line1: params.get("address_line1") || params.get("address") || "",
    unit: params.get("unit") || "",
    city: params.get("city") || "",
    state: params.get("state") || "",
    zip: params.get("zip") || "",
    formatted_address: params.get("formatted_address") || "",
    latitude: validCoordinates ? lat : null,
    longitude: validCoordinates ? lng : null,
  };
}

type GeocodingContext = { id?: string; text?: string; short_code?: string; properties?: { short_code?: string } };
type GeocodingFeature = GeocodingContext & {
  place_type?: string[];
  address?: string;
  place_name?: string;
  context?: GeocodingContext[];
};

export async function resolvePinAddress(seed: AddressValue, token: string, signal?: AbortSignal): Promise<AddressValue> {
  if (!token || seed.latitude == null || seed.longitude == null) throw new Error("Pin address lookup is unavailable");
  const query = new URLSearchParams({ access_token: token, types: "address", limit: "1" });
  const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${seed.longitude},${seed.latitude}.json?${query}`, { signal });
  if (!response.ok) throw new Error("Pin address lookup failed");
  const data = await response.json() as { features?: GeocodingFeature[] };
  const feature = data.features?.find(item => item.place_type?.includes("address") || item.id?.startsWith("address."));
  if (!feature) throw new Error("No street address found for this pin");
  const context = feature.context || [];
  const part = (kind: string) => context.find(item => item.id?.startsWith(`${kind}.`));
  const region = part("region");
  const regionCode = region?.short_code || region?.properties?.short_code || "";
  return {
    ...seed,
    address_line1: [feature.address, feature.text].filter(Boolean).join(" ") || seed.address_line1,
    city: part("place")?.text || part("locality")?.text || seed.city,
    state: regionCode.split("-").pop()?.toUpperCase() || seed.state,
    zip: part("postcode")?.text || seed.zip,
    formatted_address: feature.place_name || "",
    // Keep the user's exact pin, even when the geocoder returns a nearby rooftop.
    latitude: seed.latitude,
    longitude: seed.longitude,
  };
}
