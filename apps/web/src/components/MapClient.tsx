"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MapIconStrip from "./MapIconStrip";
import MapPinDropModal, {
  type PinAction,
  type PinSubmitData,
} from "./MapPinDropModal";
import MapTerritoryModal, {
  type Staff as TerritoryStaff,
  type TerritoryDraft,
} from "./MapTerritoryModal";
import TerritoryListPanel from "./MapTerritoryListPanel";
import MapFilterPanel, { type DateRange } from "./MapFilterPanel";
import MapLassoPanel, { type LassoCustomer } from "./MapLassoPanel";
import {
  PIN_STATUS,
  filledGlyphSvg,
  normalizePinStatus,
  type PinStatus,
} from "@/lib/map-pin-colors";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";

// 500ms matches iOS/Android/Google Maps/Apple Maps long-press defaults.
// Safe at this duration because every map gesture (drag, wheel/pinch zoom,
// rotate, pitch, multi-touch) cancels the timer below.
const HOLD_MS = 500;
// Touch fingers wiggle; 5px was firing during normal taps. 12px matches the
// slop most native gesture recognizers use to distinguish a press from a drag.
const MOVE_THRESHOLD_PX = 12;

const CUSTOMER_PIN_COLOR = "#dc2626";
const SUBSCRIPTION_PIN_COLOR = "#22c55e";

// Cluster aggregation distance in pixels. 50px ≈ half a typical pin span on
// mobile; tighter values leave pins visually overlapping at low zoom, wider
// values group adjacent streets together unhelpfully.
const CLUSTER_RADIUS = 50;
// Above this zoom every point renders individually — at street-level the
// user wants to see exact addresses, not aggregations.
const CLUSTER_MAX_ZOOM = 14;
const CUSTOMER_CLUSTER_COLOR = "#dc2626";
// Darker red border on customer clusters (vs the white ring used elsewhere)
// — matches the all-red, no-white-rim treatment of the new customer
// markers. red-800.
const CUSTOMER_CLUSTER_STROKE = "#991b1b";
// Fallback accent if the --color-violet CSS variable is missing (e.g. in
// tests or before stylesheets load). Matches Tailwind's violet-600.
const ACCENT_FALLBACK = "#7c3aed";
const ACCENT_FALLBACK_FOREGROUND = "#ffffff";

function readAccent(): { bg: string; fg: string } {
  if (typeof window === "undefined") {
    return { bg: ACCENT_FALLBACK, fg: ACCENT_FALLBACK_FOREGROUND };
  }
  const override = (() => {
    try {
      return localStorage.getItem("forge-accent");
    } catch {
      return null;
    }
  })();
  const styles = getComputedStyle(document.documentElement);
  const bg =
    override?.trim() ||
    styles.getPropertyValue("--color-violet").trim() ||
    ACCENT_FALLBACK;
  const fg =
    styles.getPropertyValue("--color-violet-foreground").trim() ||
    ACCENT_FALLBACK_FOREGROUND;
  return { bg, fg };
}

// Custom mapbox-gl-draw styles that paint the in-progress lasso / territory
// polygon in the user's accent color rather than the library's default yellow
// (#fbb03b). Built off the upstream default style list so all states
// (inactive, active, midpoint, vertex) remain visible.
function drawStyles(accent: string) {
  return [
    {
      id: "gl-draw-polygon-fill-inactive",
      type: "fill",
      filter: [
        "all",
        ["==", "active", "false"],
        ["==", "$type", "Polygon"],
        ["!=", "mode", "static"],
      ],
      paint: { "fill-color": accent, "fill-outline-color": accent, "fill-opacity": 0.1 },
    },
    {
      id: "gl-draw-polygon-fill-active",
      type: "fill",
      filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
      paint: { "fill-color": accent, "fill-outline-color": accent, "fill-opacity": 0.1 },
    },
    {
      id: "gl-draw-polygon-midpoint",
      type: "circle",
      filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
      paint: { "circle-radius": 3, "circle-color": accent },
    },
    {
      id: "gl-draw-polygon-stroke-inactive",
      type: "line",
      filter: [
        "all",
        ["==", "active", "false"],
        ["==", "$type", "Polygon"],
        ["!=", "mode", "static"],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": accent, "line-width": 2 },
    },
    {
      id: "gl-draw-polygon-stroke-active",
      type: "line",
      filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": accent, "line-dasharray": [0.2, 2], "line-width": 2 },
    },
    {
      id: "gl-draw-line-inactive",
      type: "line",
      filter: [
        "all",
        ["==", "active", "false"],
        ["==", "$type", "LineString"],
        ["!=", "mode", "static"],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": accent, "line-width": 2 },
    },
    {
      id: "gl-draw-line-active",
      type: "line",
      filter: [
        "all",
        ["==", "$type", "LineString"],
        ["==", "active", "true"],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": accent, "line-dasharray": [0.2, 2], "line-width": 2 },
    },
    {
      id: "gl-draw-polygon-and-line-vertex-stroke-inactive",
      type: "circle",
      filter: [
        "all",
        ["==", "meta", "vertex"],
        ["==", "$type", "Point"],
        ["!=", "mode", "static"],
      ],
      paint: { "circle-radius": 5, "circle-color": "#fff" },
    },
    {
      id: "gl-draw-polygon-and-line-vertex-inactive",
      type: "circle",
      filter: [
        "all",
        ["==", "meta", "vertex"],
        ["==", "$type", "Point"],
        ["!=", "mode", "static"],
      ],
      paint: { "circle-radius": 3, "circle-color": accent },
    },
    {
      id: "gl-draw-point-point-stroke-inactive",
      type: "circle",
      filter: [
        "all",
        ["==", "active", "false"],
        ["==", "$type", "Point"],
        ["==", "meta", "feature"],
        ["!=", "mode", "static"],
      ],
      paint: {
        "circle-radius": 5,
        "circle-opacity": 1,
        "circle-color": "#fff",
      },
    },
    {
      id: "gl-draw-point-inactive",
      type: "circle",
      filter: [
        "all",
        ["==", "active", "false"],
        ["==", "$type", "Point"],
        ["==", "meta", "feature"],
        ["!=", "mode", "static"],
      ],
      paint: { "circle-radius": 3, "circle-color": accent },
    },
    {
      id: "gl-draw-point-stroke-active",
      type: "circle",
      filter: [
        "all",
        ["==", "$type", "Point"],
        ["==", "active", "true"],
        ["!=", "meta", "midpoint"],
      ],
      paint: { "circle-radius": 7, "circle-color": "#fff" },
    },
    {
      id: "gl-draw-point-active",
      type: "circle",
      filter: [
        "all",
        ["==", "$type", "Point"],
        ["!=", "meta", "midpoint"],
        ["==", "active", "true"],
      ],
      paint: { "circle-radius": 5, "circle-color": accent },
    },
    {
      id: "gl-draw-polygon-fill-static",
      type: "fill",
      filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"]],
      paint: { "fill-color": "#404040", "fill-outline-color": "#404040", "fill-opacity": 0.1 },
    },
    {
      id: "gl-draw-polygon-stroke-static",
      type: "line",
      filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#404040", "line-width": 2 },
    },
    {
      id: "gl-draw-line-static",
      type: "line",
      filter: ["all", ["==", "mode", "static"], ["==", "$type", "LineString"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#404040", "line-width": 2 },
    },
    {
      id: "gl-draw-point-static",
      type: "circle",
      filter: ["all", ["==", "mode", "static"], ["==", "$type", "Point"]],
      paint: { "circle-radius": 5, "circle-color": "#404040" },
    },
  ];
}

type StyleMode = "satellite" | "streets";

type ApiPin = {
  id: number;
  lat: number;
  lng: number;
  status: string;
  notes: string | null;
  objections: string | null;
  address: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

type CustomerPin = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  is_recurring: number;
  created_at: string;
  has_active_subscription: number;
  latest_subscription_created_at: string | null;
  subscription_employee_ids: number[];
  customer_employee_ids: number[];
};

type ModalState = {
  open: boolean;
  lng: number;
  lat: number;
  address?: string | null;
  editingId?: number;
  initialStatus?: PinStatus;
  initialNote?: string;
  initialObjections?: string[];
};

const STATUS_PILL: Record<PinStatus, { bg: string; text: string }> = {
  sale: { bg: "#dcfce7", text: "#166534" },
  not_home: { bg: "#fef3c7", text: "#854d0e" },
  not_interested: { bg: "#fee2e2", text: "#991b1b" },
  not_qualified: { bg: "#ede9fe", text: "#5b21b6" },
  do_not_contact: { bg: "#e2e8f0", text: "#0f172a" },
  revisit: { bg: "#cffafe", text: "#155e75" },
  referral: { bg: "#fce7f3", text: "#9d174d" },
  quote: { bg: "#dbeafe", text: "#1e40af" },
};

function pinCoordLabel(pin: { lat: number; lng: number }): string {
  return `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
}

function formatPinDate(raw: string): string {
  if (!raw) return "—";
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type GeocodingFeature = {
  id?: string;
  address?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
};

async function fetchGeocoding(
  lng: number,
  lat: number,
  types: string | null
): Promise<GeocodingFeature[] | null> {
  if (!TOKEN) return null;
  try {
    const params = new URLSearchParams({
      access_token: TOKEN,
      limit: "5",
    });
    if (types) params.set("types", types);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: GeocodingFeature[] };
    return data.features ?? null;
  } catch {
    return null;
  }
}

function pickStreetAddress(features: GeocodingFeature[]): string | null {
  const isAddressFeature = (f: GeocodingFeature) =>
    f.place_type?.includes("address") || (f.id || "").startsWith("address.");
  const f = features.find(isAddressFeature) || features[0];
  if (!f) return null;
  if (f.address && f.text) return `${f.address} ${f.text}`;
  if (f.place_name) return f.place_name.split(",")[0].trim();
  if (f.text) return f.text;
  return null;
}

async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  // Try address-typed first for the cleanest "123 Main St" result.
  const addressFeatures = await fetchGeocoding(lng, lat, "address");
  if (addressFeatures && addressFeatures.length > 0) {
    const picked = pickStreetAddress(addressFeatures);
    if (picked) return picked;
  }
  // Fall back to all types — for points just off a known address (driveways,
  // yards near water, etc.) Mapbox often returns the nearest street address
  // when the type filter is dropped.
  const allFeatures = await fetchGeocoding(lng, lat, null);
  if (allFeatures && allFeatures.length > 0) {
    return pickStreetAddress(allFeatures);
  }
  return null;
}

function parseObjections(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => typeof x === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

type ApiTerritory = {
  id: number;
  name: string;
  color: string;
  polygon: string;
  assigned_employee_ids: string | null;
  created_by: string | null;
  created_at: string;
};

type Territory = {
  id: number;
  name: string;
  color: string;
  polygon: number[][];
  assigned_employee_ids: number[];
};

type TerritoryModalState =
  | { open: false }
  | { open: true; draft: TerritoryDraft };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusOf(pin: ApiPin): PinStatus {
  return normalizePinStatus(pin.status);
}

function makeMarkerElement(status: PinStatus): HTMLElement {
  // Flyra-style pin: solid color circle, filled glyph, no border, soft
  // colored glow built from layered box-shadows at decreasing opacity.
  // See DESIGN_SYSTEM.md §8.21 "Door-knock map pins".
  const meta = PIN_STATUS[status];
  const el = document.createElement("div");
  el.className = "mp-pin";
  el.style.cssText =
    "width:26px;height:26px;border-radius:50%;" +
    `background:${meta.color};color:${meta.textColor};` +
    "box-shadow:" +
    `0 0 0 1px ${meta.color},` +
    `0 0 5px 1px ${meta.color}99,` +
    "0 1px 3px rgba(0,0,0,0.4);" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;";
  el.innerHTML = filledGlyphSvg(status, meta.textColor, 18);
  return el;
}

function customerPinColor(c: CustomerPin): string {
  return c.has_active_subscription
    ? SUBSCRIPTION_PIN_COLOR
    : CUSTOMER_PIN_COLOR;
}

function makeCustomerMarkerElement(c: CustomerPin): HTMLElement {
  // Flyra-style customer marker: flat filled circle in the customer state
  // color (red for one-time, green for active subscription), 16px filled
  // user glyph, no stroke, layered colored glow — mirrors the door-knock
  // marker treatment so customers read as the same family of pin.
  // See DESIGN_SYSTEM.md §8.21 / §8.22.
  const color = customerPinColor(c);
  const el = document.createElement("div");
  el.className = "mp-customer-pin";
  // No inline `position` here: mapbox-gl positions every marker with
  // `.mapboxgl-marker { position: absolute }` + an inline transform. Setting
  // `position: relative` overrode that, dropping the marker into normal
  // document flow so it stacked against its siblings and visibly drifted as
  // clustering toggled markers' `display` on zoom. The absolutely-positioned
  // glyph below still centers against this element — the marker is its own
  // containing block via the mapbox transform.
  el.style.cssText =
    "width:26px;height:26px;border-radius:50%;" +
    `background:${color};color:#ffffff;` +
    "box-shadow:" +
    `0 0 0 1px ${color},` +
    `0 0 5px 1px ${color}99,` +
    "0 1px 3px rgba(0,0,0,0.4);" +
    "cursor:pointer;";
  // Material-style Person glyph: head circle + body trapezoid, total
  // bounding box (x: 4..20, y: 4..20) — symmetric about (12, 12). Absolute
  // centered so no flex / inline-baseline drift can pull it off-center.
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ' +
    'style="display:block;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;">' +
    '<circle cx="12" cy="8" r="4" fill="#ffffff"/>' +
    '<path fill="#ffffff" d="M12 14c-4.4 0-8 1.8-8 4v2h16v-2c0-2.2-3.6-4-8-4z"/>' +
    "</svg>";
  const tooltip =
    c.name +
    (c.formatted_address
      ? ` — ${c.formatted_address}`
      : c.address
        ? ` — ${c.address}`
        : "");
  el.title = tooltip;
  return el;
}

export default function MapClient() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const pinsDataRef = useRef<Map<number, ApiPin>>(new Map());
  const customerMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const customerDataRef = useRef<Map<number, CustomerPin>>(new Map());
  const territoriesRef = useRef<Map<number, Territory>>(new Map());
  const drawRef = useRef<MapboxDraw | null>(null);
  const drawingTerritoryRef = useRef(false);
  const drawingLassoRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentPopupRef = useRef<mapboxgl.Popup | null>(null);

  function openSinglePopup(popup: mapboxgl.Popup) {
    currentPopupRef.current?.remove();
    currentPopupRef.current = popup;
    popup.on("close", () => {
      if (currentPopupRef.current === popup) {
        currentPopupRef.current = null;
      }
    });
  }

  const [styleMode, setStyleMode] = useState<StyleMode>("satellite");
  const [pinsVisible, setPinsVisible] = useState(true);
  const pinsVisibleRef = useRef(true);
  const [showCustomerPins, setShowCustomerPins] = useState(true);
  const showCustomerPinsRef = useRef(true);
  // Track the mobile breakpoint at runtime so the map container can use
  // inline styles (which beat mapbox-gl.css's own `.mapboxgl-map`
  // `position: relative` via specificity) while still being responsive.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);
  // After the container width changes (e.g., crossing the md breakpoint on
  // resize), Mapbox doesn't reflow its canvas on its own — call resize.
  useEffect(() => {
    mapRef.current?.resize();
  }, [isMobile]);
  const [staff, setStaff] = useState<TerritoryStaff[]>([]);
  const [drawingTerritory, setDrawingTerritory] = useState(false);
  const [drawingLasso, setDrawingLasso] = useState(false);
  const [lassoSelection, setLassoSelection] = useState<LassoCustomer[] | null>(
    null
  );
  const [territoryListOpen, setTerritoryListOpen] = useState(false);
  const [territoriesVersion, setTerritoriesVersion] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCustomersFilter, setShowCustomersFilter] = useState(true);
  const [showSubscriptionsFilter, setShowSubscriptionsFilter] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<
    number[] | null
  >(null);
  const showCustomersFilterRef = useRef(true);
  const showSubscriptionsFilterRef = useRef(true);
  const dateRangeRef = useRef<DateRange>("all");
  const selectedEmployeeIdsRef = useRef<number[] | null>(null);
  const [territoryModal, setTerritoryModal] = useState<TerritoryModalState>({
    open: false,
  });
  const [modal, setModal] = useState<ModalState>({
    open: false,
    lng: 0,
    lat: 0,
  });

  function clearHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartRef.current = null;
  }

  function removeMarker(id: number) {
    const m = markersRef.current.get(id);
    if (m) m.remove();
    markersRef.current.delete(id);
    pinsDataRef.current.delete(id);
    setPinSourceData();
  }

  function addMarker(pin: ApiPin) {
    const map = mapRef.current;
    if (!map) return;
    const status = statusOf(pin);
    const el = makeMarkerElement(status);
    if (!pinsVisibleRef.current) el.style.display = "none";
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openPinPopup(pin.id);
    });
    markersRef.current.set(pin.id, marker);
    pinsDataRef.current.set(pin.id, pin);
    setPinSourceData();
  }

  function addCustomerMarker(c: CustomerPin) {
    const map = mapRef.current;
    if (!map) return;
    const el = makeCustomerMarkerElement(c);
    if (!isCustomerVisible(c)) el.style.display = "none";
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([c.longitude, c.latitude])
      .addTo(map);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openCustomerPopup(c.id);
    });
    customerMarkersRef.current.set(c.id, marker);
    customerDataRef.current.set(c.id, c);
    setCustomerSourceData();
  }

  // Push the current pin set into the GeoJSON cluster source. Mapbox computes
  // the clusters from this source; the DOM markers added above are toggled
  // hidden whenever a point ends up inside a cluster (see syncMarkerVisibility).
  function setPinSourceData() {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("pins-source") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;
    const features = Array.from(pinsDataRef.current.values()).map((p) => ({
      type: "Feature" as const,
      properties: { id: p.id },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    }));
    source.setData({ type: "FeatureCollection", features });
  }

  function setCustomerSourceData() {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("customers-source") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;
    // Filter to visible customers — hidden ones must not contribute to
    // cluster counts, otherwise a "show subscriptions only" view would still
    // show clusters sized as if customers were present.
    const features = Array.from(customerDataRef.current.values())
      .filter((c) => isCustomerVisible(c))
      .map((c) => ({
        type: "Feature" as const,
        properties: { id: c.id },
        geometry: {
          type: "Point" as const,
          coordinates: [c.longitude, c.latitude],
        },
      }));
    source.setData({ type: "FeatureCollection", features });
  }

  function ensureClusterLayers() {
    const map = mapRef.current;
    if (!map) return;
    const accent = readAccent();

    if (!map.getSource("pins-source")) {
      map.addSource("pins-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: CLUSTER_RADIUS,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
      });
    }
    if (!map.getLayer("pins-cluster-circle")) {
      map.addLayer({
        id: "pins-cluster-circle",
        type: "circle",
        source: "pins-source",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": accent.bg,
          "circle-opacity": 0.92,
          "circle-stroke-width": 0,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            20,
            50,
            24,
            200,
            30,
          ],
        },
      });
    }
    if (!map.getLayer("pins-cluster-count")) {
      map.addLayer({
        id: "pins-cluster-count",
        type: "symbol",
        source: "pins-source",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: { "text-color": accent.fg },
      });
    }

    if (!map.getSource("customers-source")) {
      map.addSource("customers-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: CLUSTER_RADIUS,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
      });
    }
    if (!map.getLayer("customers-cluster-circle")) {
      map.addLayer({
        id: "customers-cluster-circle",
        type: "circle",
        source: "customers-source",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": CUSTOMER_CLUSTER_COLOR,
          "circle-opacity": 0.92,
          "circle-stroke-color": CUSTOMER_CLUSTER_STROKE,
          "circle-stroke-width": 2,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            20,
            50,
            24,
            200,
            30,
          ],
        },
      });
    }
    if (!map.getLayer("customers-cluster-count")) {
      map.addLayer({
        id: "customers-cluster-count",
        type: "symbol",
        source: "customers-source",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
    }

    setPinSourceData();
    setCustomerSourceData();
  }

  // Mapbox clusters live in the GeoJSON source; the rich DOM markers (with
  // status glyphs, glow, popups) live as standalone Markers. To make the two
  // coexist, hide each DOM marker whose feature is currently rolled up into a
  // cluster — leave only "leaf" features showing.
  function syncMarkerVisibility() {
    const map = mapRef.current;
    if (!map) return;

    if (map.getSource("pins-source")) {
      const features = map.querySourceFeatures("pins-source", {
        filter: ["!", ["has", "point_count"]],
      });
      const leafIds = new Set<number>();
      for (const f of features) {
        const id = f.properties?.id;
        if (typeof id === "number") leafIds.add(id);
      }
      for (const [id, marker] of markersRef.current) {
        const el = marker.getElement();
        if (!pinsVisibleRef.current) {
          el.style.display = "none";
          continue;
        }
        el.style.display = leafIds.has(id) ? "flex" : "none";
      }
    }

    if (map.getSource("customers-source")) {
      const features = map.querySourceFeatures("customers-source", {
        filter: ["!", ["has", "point_count"]],
      });
      const leafIds = new Set<number>();
      for (const f of features) {
        const id = f.properties?.id;
        if (typeof id === "number") leafIds.add(id);
      }
      for (const [id, marker] of customerMarkersRef.current) {
        const c = customerDataRef.current.get(id);
        const el = marker.getElement();
        if (!c || !isCustomerVisible(c)) {
          el.style.display = "none";
          continue;
        }
        el.style.display = leafIds.has(id) ? "" : "none";
      }
    }
  }

  function rangeStartMs(range: DateRange): number | null {
    const now = Date.now();
    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (range === "7d") return now - 7 * 24 * 60 * 60 * 1000;
    if (range === "1m") return now - 30 * 24 * 60 * 60 * 1000;
    if (range === "3m") return now - 90 * 24 * 60 * 60 * 1000;
    if (range === "6m") return now - 180 * 24 * 60 * 60 * 1000;
    if (range === "1y") return now - 365 * 24 * 60 * 60 * 1000;
    return null;
  }

  function parseDbDateMs(s: string | null | undefined): number | null {
    if (!s) return null;
    const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  }

  function isCustomerVisible(c: CustomerPin): boolean {
    if (!showCustomerPinsRef.current) return false;
    const isSub = !!c.has_active_subscription;
    if (isSub && !showSubscriptionsFilterRef.current) return false;
    if (!isSub && !showCustomersFilterRef.current) return false;

    const start = rangeStartMs(dateRangeRef.current);
    if (start !== null) {
      const dateStr = isSub
        ? c.latest_subscription_created_at
        : c.created_at;
      const ms = parseDbDateMs(dateStr);
      if (ms === null || ms < start) return false;
    }

    const sel = selectedEmployeeIdsRef.current;
    if (sel !== null) {
      const ids = isSub
        ? c.subscription_employee_ids
        : c.customer_employee_ids;
      if (ids.length === 0) return false;
      if (!ids.some((id) => sel.includes(id))) return false;
    }

    return true;
  }

  function applyCustomerFilters() {
    // Rebuild the cluster source first so cluster counts reflect the filter,
    // then re-sync DOM marker visibility against the new cluster layout.
    setCustomerSourceData();
    syncMarkerVisibility();
  }

  function parseTerritory(t: ApiTerritory): Territory {
    let polygon: number[][] = [];
    let assigned: number[] = [];
    try {
      polygon = JSON.parse(t.polygon);
    } catch {
      // ignore
    }
    try {
      if (t.assigned_employee_ids) {
        assigned = JSON.parse(t.assigned_employee_ids);
      }
    } catch {
      // ignore
    }
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      polygon,
      assigned_employee_ids: assigned,
    };
  }

  function setTerritoryData() {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("territories") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;
    const features = Array.from(territoriesRef.current.values()).map((t) => ({
      type: "Feature" as const,
      id: t.id,
      properties: { id: t.id, name: t.name, color: t.color },
      geometry: { type: "Polygon" as const, coordinates: [t.polygon] },
    }));
    source.setData({ type: "FeatureCollection", features });
  }

  function ensureTerritoryLayers() {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getSource("territories")) {
      map.addSource("territories", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("territories-fill")) {
      map.addLayer({
        id: "territories-fill",
        type: "fill",
        source: "territories",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.25,
        },
      });
    }
    if (!map.getLayer("territories-line")) {
      map.addLayer({
        id: "territories-line",
        type: "line",
        source: "territories",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
        },
      });
    }
    setTerritoryData();
  }

  function startDrawTerritory() {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    draw.changeMode("draw_polygon");
    drawingTerritoryRef.current = true;
    setDrawingTerritory(true);
  }

  function cancelDrawTerritory() {
    const draw = drawRef.current;
    if (draw) {
      draw.deleteAll();
      draw.changeMode("simple_select");
    }
    drawingTerritoryRef.current = false;
    setDrawingTerritory(false);
  }

  function toggleDrawTerritory() {
    if (drawingTerritoryRef.current) cancelDrawTerritory();
    else {
      if (drawingLassoRef.current) cancelLasso();
      startDrawTerritory();
    }
  }

  function startLasso() {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    draw.changeMode("draw_polygon");
    drawingLassoRef.current = true;
    setDrawingLasso(true);
  }

  function cancelLasso() {
    const draw = drawRef.current;
    if (draw) {
      draw.deleteAll();
      draw.changeMode("simple_select");
    }
    drawingLassoRef.current = false;
    setDrawingLasso(false);
  }

  function toggleLasso() {
    if (drawingLassoRef.current) cancelLasso();
    else {
      if (drawingTerritoryRef.current) cancelDrawTerritory();
      setLassoSelection(null);
      startLasso();
    }
  }

  function pointInPolygon(
    point: [number, number],
    polygon: [number, number][]
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersect =
        yi > point[1] !== yj > point[1] &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function selectCustomersInPolygon(ring: number[][]): LassoCustomer[] {
    const polygon = ring.map((p) => [p[0], p[1]] as [number, number]);
    const out: LassoCustomer[] = [];
    for (const c of customerDataRef.current.values()) {
      if (!isCustomerVisible(c)) continue;
      if (pointInPolygon([c.longitude, c.latitude], polygon)) {
        out.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          has_active_subscription: c.has_active_subscription,
        });
      }
    }
    return out;
  }

  function openPinPopup(id: number) {
    const map = mapRef.current;
    const pin = pinsDataRef.current.get(id);
    if (!map || !pin) return;
    const status = statusOf(pin);
    const meta = PIN_STATUS[status];
    const pill = STATUS_PILL[status];

    const node = document.createElement("div");
    node.style.cssText = "min-width:240px;font-family:inherit;";

    const titleText = pin.address || pinCoordLabel(pin);
    const dateText = formatPinDate(pin.created_at);
    const noteHtml = pin.notes
      ? `<div style="margin-top:8px;font-size:13px;color:#475569;white-space:pre-wrap;">${escapeHtml(
          pin.notes
        )}</div>`
      : "";
    const pinObjections = parseObjections(pin.objections);
    const objectionsHtml =
      pinObjections.length > 0
        ? `<div style="margin-top:6px;display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:start;font-size:13px;">
             <span style="color:#94a3b8;">Objection:</span>
             <span style="color:#0f172a;">${pinObjections
               .map((o) => escapeHtml(o))
               .join(", ")}</span>
           </div>`
        : "";

    node.innerHTML =
      `<div data-pin-title style="font-weight:600;color:#0f172a;font-size:16px;line-height:1.3;padding-right:18px;">${escapeHtml(
        titleText
      )}</div>` +
      `<div style="margin-top:8px;display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;font-size:13px;">
         <span style="color:#94a3b8;">Status:</span>
         <span><span style="display:inline-block;background:${
           pill.bg
         };color:${
           pill.text
         };font-weight:600;border-radius:9999px;padding:2px 10px;font-size:12px;">${escapeHtml(
        meta.label
      )}</span></span>
         <span style="color:#94a3b8;">Date:</span>
         <span style="color:#0f172a;">${escapeHtml(dateText)}</span>
       </div>` +
      objectionsHtml +
      noteHtml +
      `<div style="margin-top:12px;display:flex;gap:6px;">
         <button data-action="edit" style="flex:1;padding:6px 10px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px;background:white;color:#0f172a;cursor:pointer;">Edit</button>
         <button data-action="delete" style="flex:1;padding:6px 10px;font-size:12px;border:1px solid #fecaca;border-radius:6px;background:white;color:#dc2626;cursor:pointer;">Delete</button>
       </div>`;

    const popup = new mapboxgl.Popup({ offset: 18, closeButton: true })
      .setLngLat([pin.lng, pin.lat])
      .setDOMContent(node)
      .addTo(map);
    openSinglePopup(popup);

    if (!pin.address) {
      reverseGeocode(pin.lng, pin.lat).then((addr) => {
        if (!addr) return;
        const titleEl = node.querySelector("[data-pin-title]");
        if (titleEl) titleEl.textContent = addr;
        const updated = { ...pin, address: addr };
        pinsDataRef.current.set(pin.id, updated);
        fetch(`/api/map/pins/${pin.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: addr }),
        }).catch(() => {});
      });
    }

    node
      .querySelector('[data-action="edit"]')
      ?.addEventListener("click", () => {
        popup.remove();
        setModal({
          open: true,
          lng: pin.lng,
          lat: pin.lat,
          address: pin.address ?? null,
          editingId: pin.id,
          initialStatus: statusOf(pin),
          initialNote: pin.notes ?? "",
          initialObjections: parseObjections(pin.objections),
        });
      });

    node
      .querySelector('[data-action="delete"]')
      ?.addEventListener("click", async () => {
        if (!confirm("Delete this pin?")) return;
        const r = await fetch(`/api/map/pins/${pin.id}`, { method: "DELETE" });
        if (r.ok) {
          removeMarker(pin.id);
          popup.remove();
        }
      });
  }

  function openCustomerPopup(id: number) {
    const map = mapRef.current;
    const c = customerDataRef.current.get(id);
    if (!map || !c) return;
    const node = document.createElement("div");
    node.style.cssText = "min-width:220px;font-family:inherit;";
    const addr = c.formatted_address || c.address || "";
    const addrHtml = addr
      ? `<div style="margin-top:4px;font-size:13px;color:#475569;">${escapeHtml(addr)}</div>`
      : "";
    const phoneHtml = c.phone
      ? `<div style="margin-top:2px;font-size:13px;color:#475569;">${escapeHtml(c.phone)}</div>`
      : "";
    node.innerHTML =
      `<div style="font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(c.name)}</div>` +
      addrHtml +
      phoneHtml +
      `<div style="margin-top:10px;">
         <a href="/customers/${c.id}" data-action="view" style="display:inline-block;padding:6px 10px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px;background:white;color:#0f172a;cursor:pointer;text-decoration:none;">View Customer</a>
       </div>`;
    const popup = new mapboxgl.Popup({ offset: 18, closeButton: true })
      .setLngLat([c.longitude, c.latitude])
      .setDOMContent(node)
      .addTo(map);
    openSinglePopup(popup);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: [-98.5795, 39.8283],
      // Lower zoom on mobile so the same geographic area fits a narrow
      // viewport — zoom is independent of viewport, so 3.5 (designed for
      // a wide desktop) looks much closer-in on a phone.
      zoom: window.matchMedia("(max-width: 767px)").matches ? 3 : 3.5,
      // Flat (mercator) projection so map tiles fill the viewport edge to
      // edge at every zoom. Mapbox-gl v3 defaults to a 3D globe, which
      // surrounds the planet with "space" (black) at low zoom — visually
      // reads as a black strip at the bottom of the phone screen.
      projection: { name: "mercator" },
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: "simple_select",
      styles: drawStyles(readAccent().bg),
    });
    map.addControl(draw);
    drawRef.current = draw;

    map.on("draw.create", (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features?.[0];
      const wasLasso = drawingLassoRef.current;
      const wasTerritory = drawingTerritoryRef.current;
      drawingTerritoryRef.current = false;
      drawingLassoRef.current = false;
      setDrawingTerritory(false);
      setDrawingLasso(false);
      draw.deleteAll();
      if (
        feature &&
        feature.geometry &&
        feature.geometry.type === "Polygon"
      ) {
        const ring = feature.geometry.coordinates[0] as number[][];
        if (ring.length >= 4) {
          // mapbox-gl-draw closes the ring by repeating the first point.
          const polygon = ring.slice(0, -1);
          if (wasLasso) {
            const selected = selectCustomersInPolygon(polygon);
            setLassoSelection(selected);
          } else if (wasTerritory) {
            setTerritoryModal({ open: true, draft: { polygon } });
          }
        }
      }
    });

    map.on("load", async () => {
      ensureTerritoryLayers();
      ensureClusterLayers();
      try {
        const [pinsRes, customersRes, territoriesRes, staffRes] =
          await Promise.all([
            fetch("/api/map/pins"),
            fetch("/api/map/customer-pins"),
            fetch("/api/territories"),
            fetch("/api/staff"),
          ]);
        if (pinsRes.ok) {
          const list = (await pinsRes.json()) as ApiPin[];
          for (const p of list) addMarker(p);
        }
        if (customersRes.ok) {
          const list = (await customersRes.json()) as CustomerPin[];
          for (const c of list) addCustomerMarker(c);
        }
        if (territoriesRes.ok) {
          const list = (await territoriesRes.json()) as ApiTerritory[];
          for (const t of list) {
            const parsed = parseTerritory(t);
            territoriesRef.current.set(parsed.id, parsed);
          }
          setTerritoryData();
          setTerritoriesVersion((v) => v + 1);
        }
        if (staffRes.ok) {
          const list = (await staffRes.json()) as TerritoryStaff[];
          setStaff(list);
        }
      } catch {
        // ignore
      }
    });

    map.on("click", "territories-fill", (e) => {
      if (drawingTerritoryRef.current || drawingLassoRef.current) return;
      const feature = e.features?.[0];
      const id = feature?.properties?.id as number | undefined;
      if (id == null) return;
      const t = territoriesRef.current.get(id);
      if (!t) return;
      setTerritoryModal({
        open: true,
        draft: {
          id: t.id,
          name: t.name,
          color: t.color,
          polygon: t.polygon,
          assigned_employee_ids: t.assigned_employee_ids,
        },
      });
    });
    map.on("mouseenter", "territories-fill", () => {
      if (!drawingTerritoryRef.current) {
        map.getCanvas().style.cursor = "pointer";
      }
    });
    map.on("mouseleave", "territories-fill", () => {
      if (!drawingTerritoryRef.current) {
        map.getCanvas().style.cursor = "";
      }
    });

    function onPressDown(
      e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent
    ) {
      if (drawingTerritoryRef.current || drawingLassoRef.current) return;
      // Multi-touch = pinch/rotate gesture, never a long-press.
      const oe = e.originalEvent as TouchEvent | MouseEvent;
      if ("touches" in oe && oe.touches && oe.touches.length > 1) {
        clearHold();
        return;
      }
      const target = e.originalEvent.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === "function" &&
        (target.closest(".mp-pin") || target.closest(".mp-customer-pin"))
      ) {
        return;
      }
      if (map.getLayer("territories-fill")) {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ["territories-fill"],
        });
        if (hits.length > 0) return;
      }
      // Long-pressing a cluster bubble should expand it, not drop a new pin.
      const clusterLayers = [
        "pins-cluster-circle",
        "pins-cluster-count",
        "customers-cluster-circle",
        "customers-cluster-count",
      ].filter((id) => map.getLayer(id));
      if (clusterLayers.length > 0) {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: clusterLayers,
        });
        if (hits.length > 0) return;
      }
      holdStartRef.current = { x: e.point.x, y: e.point.y };
      const point = e.point;
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        const map = mapRef.current;
        if (!map) return;
        const lngLat = map.unproject(point);
        setModal({
          open: true,
          lng: lngLat.lng,
          lat: lngLat.lat,
          address: null,
        });
        reverseGeocode(lngLat.lng, lngLat.lat).then((addr) => {
          if (!addr) return;
          setModal((m) =>
            m.open && m.lng === lngLat.lng && m.lat === lngLat.lat
              ? { ...m, address: addr }
              : m
          );
        });
      }, HOLD_MS);
    }
    function onMove(e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) {
      if (!holdStartRef.current || !holdTimerRef.current) return;
      const dx = e.point.x - holdStartRef.current.x;
      const dy = e.point.y - holdStartRef.current.y;
      if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
        clearHold();
      }
    }
    function onUp() {
      clearHold();
    }

    // Click a cluster to zoom into its expansion zoom — standard Mapbox UX
    // so users can drill into clusters without manually pinch-zooming.
    function onClusterClick(sourceId: "pins-source" | "customers-source") {
      return (e: mapboxgl.MapMouseEvent) => {
        const feature = e.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource(sourceId) as
          | mapboxgl.GeoJSONSource
          | undefined;
        if (!source) return;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const geom = feature?.geometry;
          if (!geom || geom.type !== "Point") return;
          const [lng, lat] = geom.coordinates as [number, number];
          map.easeTo({ center: [lng, lat], zoom });
        });
      };
    }
    function onClusterEnter() {
      map.getCanvas().style.cursor = "pointer";
    }
    function onClusterLeave() {
      map.getCanvas().style.cursor = "";
    }
    map.on("click", "pins-cluster-circle", onClusterClick("pins-source"));
    map.on("click", "pins-cluster-count", onClusterClick("pins-source"));
    map.on(
      "click",
      "customers-cluster-circle",
      onClusterClick("customers-source")
    );
    map.on(
      "click",
      "customers-cluster-count",
      onClusterClick("customers-source")
    );
    for (const layer of [
      "pins-cluster-circle",
      "pins-cluster-count",
      "customers-cluster-circle",
      "customers-cluster-count",
    ]) {
      map.on("mouseenter", layer, onClusterEnter);
      map.on("mouseleave", layer, onClusterLeave);
    }

    // Mapbox re-tiles clusters as the user pans/zooms. Sync DOM marker
    // visibility whenever a relevant cluster source finishes updating, plus
    // after movement settles — those are the moments the leaf-feature set
    // actually changes.
    map.on("sourcedata", (e) => {
      if (e.sourceId !== "pins-source" && e.sourceId !== "customers-source") {
        return;
      }
      if (!e.isSourceLoaded) return;
      syncMarkerVisibility();
    });
    map.on("moveend", syncMarkerVisibility);
    map.on("zoomend", syncMarkerVisibility);

    map.on("mousedown", onPressDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    map.on("touchstart", onPressDown);
    map.on("touchmove", onMove);
    map.on("touchend", onUp);
    map.on("touchcancel", clearHold);
    // Any map-level gesture cancels the long-press. mousemove/touchmove
    // alone don't catch wheel-zoom (no pointer motion) or pinch-zoom
    // (second touch may not fire touchmove on the first finger), so we
    // hook the gesture events Mapbox emits directly.
    map.on("dragstart", clearHold);
    map.on("zoomstart", clearHold);
    map.on("rotatestart", clearHold);
    map.on("pitchstart", clearHold);
    map.on("wheel", clearHold);

    return () => {
      clearHold();
      for (const [, m] of markersRef.current) m.remove();
      markersRef.current.clear();
      pinsDataRef.current.clear();
      for (const [, m] of customerMarkersRef.current) m.remove();
      customerMarkersRef.current.clear();
      customerDataRef.current.clear();
      territoriesRef.current.clear();
      drawRef.current = null;
      currentPopupRef.current?.remove();
      currentPopupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    pinsVisibleRef.current = pinsVisible;
    const map = mapRef.current;
    if (map) {
      for (const layer of ["pins-cluster-circle", "pins-cluster-count"]) {
        if (map.getLayer(layer)) {
          map.setLayoutProperty(
            layer,
            "visibility",
            pinsVisible ? "visible" : "none"
          );
        }
      }
    }
    syncMarkerVisibility();
  }, [pinsVisible]);

  useEffect(() => {
    showCustomerPinsRef.current = showCustomerPins;
    showCustomersFilterRef.current = showCustomersFilter;
    showSubscriptionsFilterRef.current = showSubscriptionsFilter;
    dateRangeRef.current = dateRange;
    selectedEmployeeIdsRef.current = selectedEmployeeIds;
    const map = mapRef.current;
    if (map) {
      for (const layer of [
        "customers-cluster-circle",
        "customers-cluster-count",
      ]) {
        if (map.getLayer(layer)) {
          map.setLayoutProperty(
            layer,
            "visibility",
            showCustomerPins ? "visible" : "none"
          );
        }
      }
    }
    applyCustomerFilters();
  }, [
    showCustomerPins,
    showCustomersFilter,
    showSubscriptionsFilter,
    dateRange,
    selectedEmployeeIds,
  ]);

  function toggleStyle() {
    const next: StyleMode = styleMode === "satellite" ? "streets" : "satellite";
    setStyleMode(next);
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(next === "satellite" ? SATELLITE_STYLE : STREETS_STYLE);
    map.once("style.load", () => {
      ensureTerritoryLayers();
      ensureClusterLayers();
    });
  }

  async function persistPin(
    data: PinSubmitData,
    snap: ModalState
  ): Promise<ApiPin | null> {
    if (snap.editingId != null) {
      const r = await fetch(`/api/map/pins/${snap.editingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: data.status,
          notes: data.note,
          objections: data.objections,
        }),
      });
      if (!r.ok) return null;
      const updated = (await r.json()) as ApiPin;
      removeMarker(updated.id);
      addMarker(updated);
      return updated;
    }
    const address =
      snap.address ?? (await reverseGeocode(snap.lng, snap.lat));
    const r = await fetch("/api/map/pins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: snap.lat,
        lng: snap.lng,
        status: data.status,
        note: data.note,
        objections: data.objections,
        address,
      }),
    });
    if (!r.ok) return null;
    const created = (await r.json()) as ApiPin;
    addMarker(created);
    return created;
  }

  function pinActionUrl(
    action: PinAction,
    pinId: number | null,
    address: string | null
  ): string {
    const q = new URLSearchParams();
    if (address) q.set("address", address);
    if (pinId != null) q.set("attach_pin", String(pinId));
    const qs = q.toString();
    switch (action) {
      case "estimate":
        return `/estimates/new${qs ? `?${qs}` : ""}`;
      case "subscription":
        return `/subscriptions/new${qs ? `?${qs}` : ""}`;
      case "job":
        return `/schedule/new${qs ? `?${qs}` : ""}`;
      case "customer":
        q.set("new", "1");
        return `/customers?${q.toString()}`;
    }
  }

  async function closeAndPersist(data: PinSubmitData) {
    const snap = modal;
    setModal({ open: false, lng: 0, lat: 0 });
    if (!snap.open) return;
    await persistPin(data, snap);
  }

  async function handlePinAction(action: PinAction, data: PinSubmitData) {
    const snap = modal;
    setModal({ open: false, lng: 0, lat: 0 });
    if (!snap.open) return;
    const persisted = await persistPin(data, snap);
    const pinId = persisted?.id ?? snap.editingId ?? null;
    const address = persisted?.address ?? snap.address ?? null;
    router.push(pinActionUrl(action, pinId, address));
  }

  async function handlePinDelete() {
    const id = modal.editingId;
    if (id == null) return;
    setModal({ open: false, lng: 0, lat: 0 });
    const r = await fetch(`/api/map/pins/${id}`, { method: "DELETE" });
    if (r.ok) removeMarker(id);
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        marginLeft: isMobile ? 0 : "240px",
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: 0,
          left: isMobile ? 0 : "240px",
          right: 0,
          bottom: 0,
        }}
      />
      <MapIconStrip
        styleMode={styleMode}
        onToggleStyle={toggleStyle}
        pinsVisible={pinsVisible}
        onTogglePins={() => setPinsVisible((v) => !v)}
        customerPinsVisible={showCustomerPins}
        onToggleCustomerPins={() => setShowCustomerPins((v) => !v)}
        drawingTerritory={drawingTerritory}
        onToggleDrawTerritory={toggleDrawTerritory}
        territoryListOpen={territoryListOpen}
        onToggleTerritoryList={() => setTerritoryListOpen((v) => !v)}
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((v) => !v)}
        drawingLasso={drawingLasso}
        onToggleLasso={toggleLasso}
      />
      {filterOpen && (
        <MapFilterPanel
          showCustomers={showCustomersFilter}
          showSubscriptions={showSubscriptionsFilter}
          dateRange={dateRange}
          selectedEmployeeIds={selectedEmployeeIds}
          staff={staff.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
          }))}
          onChangeShowCustomers={setShowCustomersFilter}
          onChangeShowSubscriptions={setShowSubscriptionsFilter}
          onChangeDateRange={setDateRange}
          onChangeEmployeeIds={setSelectedEmployeeIds}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {territoryListOpen && (
        <TerritoryListPanel
          version={territoriesVersion}
          territoriesRef={territoriesRef}
          staff={staff}
          onClose={() => setTerritoryListOpen(false)}
          onPick={(t) => {
            setTerritoryListOpen(false);
            setTerritoryModal({
              open: true,
              draft: {
                id: t.id,
                name: t.name,
                color: t.color,
                polygon: t.polygon,
                assigned_employee_ids: t.assigned_employee_ids,
              },
            });
          }}
        />
      )}
      {drawingTerritory && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-sm rounded-full px-4 py-2 shadow-md pointer-events-none">
          Click points to outline a territory · double-click to finish
        </div>
      )}
      {drawingLasso && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-sm rounded-full px-4 py-2 shadow-md pointer-events-none">
          Click points to lasso customers · double-click to finish
        </div>
      )}
      {lassoSelection && (
        <MapLassoPanel
          customers={lassoSelection}
          onClose={() => setLassoSelection(null)}
        />
      )}
      <MapPinDropModal
        open={modal.open}
        address={modal.address ?? null}
        lat={modal.lat}
        lng={modal.lng}
        editingId={modal.editingId}
        initialStatus={modal.initialStatus}
        initialNote={modal.initialNote}
        initialObjections={modal.initialObjections}
        onClose={closeAndPersist}
        onAction={handlePinAction}
        onDelete={modal.editingId != null ? handlePinDelete : undefined}
      />
      {territoryModal.open && (
        <MapTerritoryModal
          draft={territoryModal.draft}
          staff={staff}
          onClose={() => setTerritoryModal({ open: false })}
          onSaved={(saved) => {
            const t: Territory = {
              id: saved.id,
              name: saved.name || "",
              color: saved.color || "#3b82f6",
              polygon: saved.polygon,
              assigned_employee_ids: saved.assigned_employee_ids || [],
            };
            territoriesRef.current.set(t.id, t);
            setTerritoryData();
            setTerritoriesVersion((v) => v + 1);
            setTerritoryModal({ open: false });
          }}
          onDelete={async (id) => {
            const r = await fetch(`/api/territories/${id}`, {
              method: "DELETE",
            });
            if (r.ok) {
              territoriesRef.current.delete(id);
              setTerritoryData();
              setTerritoriesVersion((v) => v + 1);
              setTerritoryModal({ open: false });
            }
          }}
        />
      )}
    </div>
  );
}
