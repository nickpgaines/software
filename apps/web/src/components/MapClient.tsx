"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { createElement, useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MapIconStrip from "./MapIconStrip";
import MapPinDropModal from "./MapPinDropModal";
import MapTerritoryModal, {
  type Staff as TerritoryStaff,
  type TerritoryDraft,
} from "./MapTerritoryModal";
import TerritoryListPanel from "./MapTerritoryListPanel";
import MapFilterPanel, { type DateRange } from "./MapFilterPanel";
import MapLassoPanel, { type LassoCustomer } from "./MapLassoPanel";
import {
  PIN_STATUS,
  isPinStatus,
  type PinStatus,
} from "@/lib/map-pin-colors";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";

// Long-press to drop a pin: ~750ms feels intentional without being sluggish.
// OS defaults are ~500ms (iOS/Android) but those fire on top of native
// scroll/zoom suppression — on a map canvas we need a longer threshold so
// pan/zoom gestures don't race the timer.
const HOLD_MS = 750;
// Touch fingers wiggle; 5px was firing during normal taps. 12px matches the
// slop most native gesture recognizers use to distinguish a press from a drag.
const MOVE_THRESHOLD_PX = 12;

const CUSTOMER_PIN_COLOR = "#dc2626";
const SUBSCRIPTION_PIN_COLOR = "#22c55e";

type StyleMode = "satellite" | "streets";

type ApiPin = {
  id: number;
  lat: number;
  lng: number;
  status: string;
  notes: string | null;
  objections: string | null;
  address: string | null;
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
  editingId?: number;
  initialStatus?: PinStatus;
  initialNote?: string;
  initialObjections?: string[];
};

const STATUS_PILL: Record<PinStatus, { bg: string; text: string }> = {
  sale: { bg: "#dcfce7", text: "#166534" },
  not_home: { bg: "#fef9c3", text: "#854d0e" },
  not_interested: { bg: "#fee2e2", text: "#991b1b" },
  come_back: { bg: "#dbeafe", text: "#1e40af" },
  quote_sent: { bg: "#ffedd5", text: "#9a3412" },
  do_not_return: { bg: "#e2e8f0", text: "#0f172a" },
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
  return isPinStatus(pin.status) ? pin.status : "not_home";
}

function makeMarkerElement(status: PinStatus): HTMLElement {
  const meta = PIN_STATUS[status];
  const el = document.createElement("div");
  el.className = "mp-pin";
  el.style.cssText =
    "width:28px;height:28px;border-radius:50%;" +
    `background:${meta.color};color:${meta.textColor};` +
    "border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;";
  el.innerHTML = renderToStaticMarkup(
    createElement(meta.icon, {
      width: 14,
      height: 14,
      color: meta.textColor,
    })
  );
  return el;
}

function customerPinColor(c: CustomerPin): string {
  return c.has_active_subscription
    ? SUBSCRIPTION_PIN_COLOR
    : CUSTOMER_PIN_COLOR;
}

function makeCustomerMarkerElement(c: CustomerPin): HTMLElement {
  const el = document.createElement("div");
  el.className = "mp-customer-pin";
  el.style.cssText =
    "width:28px;height:36px;cursor:pointer;" +
    "filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));" +
    "transform:translateY(-4px);";
  el.innerHTML = `
    <svg viewBox="0 0 24 32" width="28" height="36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
            fill="${customerPinColor(c)}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `;
  const tooltip = c.name + (c.formatted_address ? ` — ${c.formatted_address}` : c.address ? ` — ${c.address}` : "");
  el.title = tooltip;
  return el;
}

export default function MapClient() {
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
  }

  function addCustomerMarker(c: CustomerPin) {
    const map = mapRef.current;
    if (!map) return;
    const el = makeCustomerMarkerElement(c);
    if (!isCustomerVisible(c)) el.style.display = "none";
    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([c.longitude, c.latitude])
      .addTo(map);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openCustomerPopup(c.id);
    });
    customerMarkersRef.current.set(c.id, marker);
    customerDataRef.current.set(c.id, c);
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
    for (const [id, marker] of customerMarkersRef.current) {
      const c = customerDataRef.current.get(id);
      if (!c) continue;
      marker.getElement().style.display = isCustomerVisible(c) ? "" : "none";
    }
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
    const popup = new mapboxgl.Popup({ offset: 28, closeButton: true })
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
      holdStartRef.current = { x: e.point.x, y: e.point.y };
      const point = e.point;
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        const map = mapRef.current;
        if (!map) return;
        const lngLat = map.unproject(point);
        setModal({ open: true, lng: lngLat.lng, lat: lngLat.lat });
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
    for (const [, marker] of markersRef.current) {
      marker.getElement().style.display = pinsVisible ? "flex" : "none";
    }
  }, [pinsVisible]);

  useEffect(() => {
    showCustomerPinsRef.current = showCustomerPins;
    showCustomersFilterRef.current = showCustomersFilter;
    showSubscriptionsFilterRef.current = showSubscriptionsFilter;
    dateRangeRef.current = dateRange;
    selectedEmployeeIdsRef.current = selectedEmployeeIds;
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
    });
  }

  async function submitModal(
    status: PinStatus,
    note: string,
    objections: string[]
  ) {
    if (modal.editingId != null) {
      const r = await fetch(`/api/map/pins/${modal.editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note, objections }),
      });
      if (r.ok) {
        const updated = (await r.json()) as ApiPin;
        removeMarker(updated.id);
        addMarker(updated);
      }
    } else {
      const address = await reverseGeocode(modal.lng, modal.lat);
      const r = await fetch("/api/map/pins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: modal.lat,
          lng: modal.lng,
          status,
          note,
          objections,
          address,
        }),
      });
      if (r.ok) {
        const created = (await r.json()) as ApiPin;
        addMarker(created);
      }
    }
    setModal({ open: false, lng: 0, lat: 0 });
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
        initialStatus={modal.initialStatus}
        initialNote={modal.initialNote}
        initialObjections={modal.initialObjections}
        onCancel={() => setModal({ open: false, lng: 0, lat: 0 })}
        onSubmit={submitModal}
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
