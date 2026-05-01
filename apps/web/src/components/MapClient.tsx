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
import {
  PIN_STATUS,
  isPinStatus,
  type PinStatus,
} from "@/lib/map-pin-colors";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";

const HOLD_MS = 600;
const MOVE_THRESHOLD_PX = 5;

const CUSTOMER_PIN_COLOR = "#dc2626";
const SUBSCRIPTION_PIN_COLOR = "#22c55e";

type StyleMode = "satellite" | "streets";

type ApiPin = {
  id: number;
  lat: number;
  lng: number;
  status: string;
  notes: string | null;
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
};

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
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef<{ x: number; y: number } | null>(null);

  const [styleMode, setStyleMode] = useState<StyleMode>("satellite");
  const [pinsVisible, setPinsVisible] = useState(true);
  const pinsVisibleRef = useRef(true);
  const [showCustomerPins, setShowCustomerPins] = useState(true);
  const showCustomerPinsRef = useRef(true);
  const [staff, setStaff] = useState<TerritoryStaff[]>([]);
  const [drawingTerritory, setDrawingTerritory] = useState(false);
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
    else startDrawTerritory();
  }

  function openPinPopup(id: number) {
    const map = mapRef.current;
    const pin = pinsDataRef.current.get(id);
    if (!map || !pin) return;
    const meta = PIN_STATUS[statusOf(pin)];

    const node = document.createElement("div");
    node.style.cssText = "min-width:200px;font-family:inherit;";
    const noteHtml = pin.notes
      ? `<div style="margin-top:6px;font-size:13px;color:#475569;white-space:pre-wrap;">${escapeHtml(
          pin.notes
        )}</div>`
      : "";
    node.innerHTML =
      `<div style="font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(
        meta.label
      )}</div>` +
      noteHtml +
      `<div style="margin-top:10px;display:flex;gap:6px;">
         <button data-action="edit" style="flex:1;padding:6px 10px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px;background:white;color:#0f172a;cursor:pointer;">Edit</button>
         <button data-action="delete" style="flex:1;padding:6px 10px;font-size:12px;border:1px solid #fecaca;border-radius:6px;background:white;color:#dc2626;cursor:pointer;">Delete</button>
       </div>`;

    const popup = new mapboxgl.Popup({ offset: 18, closeButton: true })
      .setLngLat([pin.lng, pin.lat])
      .setDOMContent(node)
      .addTo(map);

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
    new mapboxgl.Popup({ offset: 28, closeButton: true })
      .setLngLat([c.longitude, c.latitude])
      .setDOMContent(node)
      .addTo(map);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: [-98.5795, 39.8283],
      zoom: 3.5,
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
      drawingTerritoryRef.current = false;
      setDrawingTerritory(false);
      draw.deleteAll();
      if (
        feature &&
        feature.geometry &&
        feature.geometry.type === "Polygon"
      ) {
        const ring = feature.geometry.coordinates[0] as number[][];
        if (ring.length >= 4) {
          // mapbox-gl-draw closes the ring by repeating the first point;
          // strip the duplicate before persisting.
          const polygon = ring.slice(0, -1);
          setTerritoryModal({ open: true, draft: { polygon } });
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
      if (drawingTerritoryRef.current) return;
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
      if (drawingTerritoryRef.current) return;
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

  async function submitModal(status: PinStatus, note: string) {
    if (modal.editingId != null) {
      const r = await fetch(`/api/map/pins/${modal.editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (r.ok) {
        const updated = (await r.json()) as ApiPin;
        removeMarker(updated.id);
        addMarker(updated);
      }
    } else {
      const r = await fetch("/api/map/pins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: modal.lat,
          lng: modal.lng,
          status,
          note,
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
    <div style={{ position: "relative", height: "100vh", marginLeft: "240px" }}>
      <div
        ref={containerRef}
        style={{ position: "fixed", top: 0, left: "240px", right: 0, bottom: 0 }}
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
      <MapPinDropModal
        open={modal.open}
        initialStatus={modal.initialStatus}
        initialNote={modal.initialNote}
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
