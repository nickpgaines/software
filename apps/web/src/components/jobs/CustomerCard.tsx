"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export type CustomerCardCustomer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function formatPhone(p: string | null | undefined): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return p;
}

type GeocodeState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      lat: number;
      lng: number;
      formatted: string;
    }
  | { status: "error"; message: string };

// TODO post-launch: build a backfill geocoding admin action for CSV-imported customers without lat/lng.
async function geocode(
  address: string
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  if (!KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results: Array<{
      geometry: { location: { lat: number; lng: number } };
      formatted_address: string;
    }>;
  };
  if (data.status !== "OK" || !data.results.length) return null;
  const first = data.results[0];
  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formatted: first.formatted_address,
  };
}

export default function CustomerCard({
  customer,
  onRemove,
  href,
}: {
  customer: CustomerCardCustomer;
  // Optional: when omitted (e.g. on the estimate detail page) the Remove
  // control is hidden and the card reads as a fixed customer summary.
  onRemove?: () => void;
  // Optional: links the customer name to their profile.
  href?: string;
}) {
  const [geo, setGeo] = useState<GeocodeState>({ status: "idle" });
  // Bumped by the placeholder's Retry button to re-run a failed geocode.
  const [attempt, setAttempt] = useState(0);
  // Set when the Google Maps JS API fails to load (invalid key / referer
  // restriction) so we render the clean placeholder rather than Google's
  // gray error tile.
  const [mapLoadError, setMapLoadError] = useState(false);

  // Prefer the structured formatted_address; fall back to legacy address.
  const preferredAddress =
    (customer.formatted_address || "").trim() ||
    (customer.address || "").trim();

  useEffect(() => {
    // A fresh lookup clears any prior JS-API load failure.
    setMapLoadError(false);
    const lat = customer.latitude;
    const lng = customer.longitude;
    // Fast path: lat AND lng are stored on the customer record (set by the
    // Places autocomplete when the customer was created/edited). Skip the
    // Geocoding API round-trip entirely.
    if (typeof lat === "number" && typeof lng === "number") {
      setGeo({
        status: "ok",
        lat,
        lng,
        formatted: preferredAddress,
      });
      return;
    }
    // Legacy fallback: customer doesn't have lat/lng on file. Geocode the
    // formatted_address (or the legacy address) client-side, same as before.
    const addr = preferredAddress;
    if (!addr) {
      setGeo({ status: "error", message: "No address on file" });
      return;
    }
    if (!KEY) {
      setGeo({ status: "error", message: "Map unavailable" });
      return;
    }
    let cancelled = false;
    setGeo({ status: "loading" });
    geocode(addr)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setGeo({ status: "error", message: "Address not found" });
          return;
        }
        setGeo({ status: "ok", ...result });
      })
      .catch(() => {
        if (!cancelled)
          setGeo({ status: "error", message: "Address not found" });
      });
    return () => {
      cancelled = true;
    };
  }, [
    customer.id,
    customer.latitude,
    customer.longitude,
    preferredAddress,
    attempt,
  ]);

  const displayedAddress =
    geo.status === "ok" && geo.formatted
      ? geo.formatted
      : preferredAddress;

  return (
    <div className="border border-line rounded-2xl bg-card overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {href ? (
                <Link
                  href={href}
                  className="text-page-title text-white truncate hover:underline block"
                >
                  {customer.name || "Customer"}
                </Link>
              ) : (
                <h3 className="text-page-title text-white truncate">
                  {customer.name || "Customer"}
                </h3>
              )}
            </div>
            {onRemove && (
              <Button
                variant="ghost"
                type="button"
                onClick={onRemove}
                className="h-auto p-0 text-xs text-zinc-400 hover:text-rose-600 border border-line hover:border-rose-200 rounded-full px-3 py-1.5 whitespace-nowrap"
                aria-label="Remove selected customer"
              >
                Remove
              </Button>
            )}
          </div>

          <dl className="space-y-2.5 text-sm">
            <Row label="Address">
              {displayedAddress ? (
                <span className="text-zinc-300 break-words">
                  {displayedAddress}
                </span>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </Row>
            <Row label="Phone">
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone}`}
                  className="text-zinc-300 hover:text-white hover:underline"
                >
                  {formatPhone(customer.phone)}
                </a>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </Row>
            <Row label="Email">
              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="text-zinc-300 hover:text-white hover:underline break-all"
                >
                  {customer.email}
                </a>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </Row>
          </dl>
        </div>

        <div className="bg-black md:border-l border-line min-h-[220px]">
          {geo.status === "ok" && !mapLoadError ? (
            <CustomerMap
              lat={geo.lat}
              lng={geo.lng}
              onError={() => setMapLoadError(true)}
            />
          ) : (
            <MapPlaceholder
              status={mapLoadError || geo.status === "ok" ? "error" : geo.status}
              message={
                mapLoadError
                  ? "Map unavailable"
                  : geo.status === "error"
                  ? geo.message
                  : "Looking up address…"
              }
              onRetry={
                !mapLoadError &&
                geo.status === "error" &&
                geo.message === "Address not found"
                  ? () => setAttempt((n) => n + 1)
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-xs font-bold text-zinc-500 pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function CustomerMap({
  lat,
  lng,
  onError,
}: {
  lat: number;
  lng: number;
  onError?: () => void;
}) {
  return (
    <APIProvider apiKey={KEY} onError={() => onError?.()}>
      <div className="w-full h-full min-h-[220px]" style={{ height: "100%" }}>
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={18}
          mapTypeId="satellite"
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl
          streetViewControl
          fullscreenControl
          zoomControl
          style={{ width: "100%", height: "100%", minHeight: 220 }}
        >
          <Marker position={{ lat, lng }} />
        </Map>
      </div>
    </APIProvider>
  );
}

function MapPlaceholder({
  status,
  message,
  onRetry,
}: {
  status: "idle" | "loading" | "error";
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center gap-2 px-4 py-8 text-sm text-zinc-400 font-bold text-center">
      {status === "loading" ? (
        <span>Looking up address…</span>
      ) : (
        <>
          <span>{message}</span>
          {onRetry && (
            <Button
              variant="ghost"
              type="button"
              onClick={onRetry}
              className="h-auto rounded-full border border-line px-3 py-1 text-xs text-zinc-300 hover:text-white"
            >
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}
