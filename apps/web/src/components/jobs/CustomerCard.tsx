"use client";

import { useEffect, useState } from "react";
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
}: {
  customer: CustomerCardCustomer;
  onRemove: () => void;
}) {
  const [geo, setGeo] = useState<GeocodeState>({ status: "idle" });

  // Prefer the structured formatted_address; fall back to legacy address.
  const preferredAddress =
    (customer.formatted_address || "").trim() ||
    (customer.address || "").trim();

  useEffect(() => {
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
      setGeo({
        status: "error",
        message: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set",
      });
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
              <h3 className="text-page-title text-white truncate">
                {customer.name || "Customer"}
              </h3>
            </div>
            <Button
              variant="ghost"
              type="button"
              onClick={onRemove}
              className="h-auto p-0 text-xs text-zinc-400 hover:text-rose-600 border border-line hover:border-rose-200 rounded-full px-3 py-1.5 whitespace-nowrap"
              aria-label="Remove selected customer"
            >
              Remove
            </Button>
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
          {geo.status === "ok" ? (
            <CustomerMap lat={geo.lat} lng={geo.lng} />
          ) : (
            <MapPlaceholder
              status={geo.status}
              message={
                geo.status === "error" ? geo.message : "Looking up address…"
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

function CustomerMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <APIProvider apiKey={KEY}>
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
}: {
  status: "idle" | "loading" | "error";
  message: string;
}) {
  return (
    <div className="w-full h-full min-h-[220px] flex items-center justify-center px-4 py-8 text-sm text-zinc-400 font-bold text-center">
      {status === "loading" ? (
        <span>Looking up address…</span>
      ) : (
        <span>{message}</span>
      )}
    </div>
  );
}
