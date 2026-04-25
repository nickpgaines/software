"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import MapDoorKnockSheet, {
  type SheetPin,
} from "@/components/MapDoorKnockSheet";
import MapFilterPanel, {
  DEFAULT_FILTERS,
  type Filters,
  type Staff,
} from "@/components/MapFilterPanel";
import MapTerritoryModal, {
  type TerritoryDraft,
} from "@/components/MapTerritoryModal";
import { STATUSES, statusByKey, iconSvg } from "@/lib/map-status";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";
const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const GEOCODE_CACHE_KEY = "map.geocode.v1";

type StyleType = "streets" | "satellite";

type MapPinRow = {
  id: number;
  lat: number;
  lng: number;
  address: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
  objections: string | null;
  customer_id: number | null;
  created_by: string | null;
  created_at: string;
};

type TerritoryRow = {
  id: number;
  name: string;
  color: string;
  polygon: string;
  assigned_employee_ids: string | null;
  created_by: string | null;
  created_at: string;
};

function emptyFeatureCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function territoryFeatures(territories: TerritoryRow[]) {
  return {
    type: "FeatureCollection" as const,
    features: territories
      .map((t) => {
        let coords: number[][] = [];
        try {
          coords = JSON.parse(t.polygon);
        } catch {
          return null;
        }
        if (coords.length < 3) return null;
        const ring = [...coords, coords[0]];
        return {
          type: "Feature" as const,
          id: t.id,
          properties: { id: t.id, name: t.name, color: t.color },
          geometry: { type: "Polygon" as const, coordinates: [ring] },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[],
  };
}

function drawFeatures(points: number[][]) {
  if (points.length === 0) return emptyFeatureCollection();
  if (points.length === 1) {
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point" as const, coordinates: points[0] },
        },
      ],
    };
  }
  const lineCoords = [...points];
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: lineCoords },
      },
      ...points.map((pt) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: pt },
      })),
    ],
  };
}

function centroid(coords: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [lng, lat] of coords) {
    x += lng;
    y += lat;
  }
  return [x / coords.length, y / coords.length];
}

type CustomerJob = {
  id: number;
  scheduled_at: string;
  price_cents: number;
  status: string;
  title: string | null;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  jobs: CustomerJob[];
};

type GeocodedCustomer = Customer & { lng: number; lat: number };

function loadGeocodeCache(): Record<string, [number, number]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache: Record<string, [number, number]>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function geocode(
  address: string,
  cache: Record<string, [number, number]>
): Promise<[number, number] | null> {
  const key = address.trim().toLowerCase();
  if (cache[key]) return cache[key];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?limit=1&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features: { center: [number, number] }[];
    };
    const center = data.features[0]?.center;
    if (!center) return null;
    cache[key] = center;
    saveGeocodeCache(cache);
    return center;
  } catch {
    return null;
  }
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function customerPopupHtml(c: GeocodedCustomer): string {
  const name = escapeHtml(c.name);
  const address = c.address ? escapeHtml(c.address) : "";
  const phone = c.phone
    ? `<a href="tel:${escapeHtml(c.phone)}" class="text-cyan-600 hover:underline">${escapeHtml(c.phone)}</a>`
    : `<span class="text-slate-400">—</span>`;
  const email = c.email
    ? `<a href="mailto:${escapeHtml(c.email)}" class="text-cyan-600 hover:underline">${escapeHtml(c.email)}</a>`
    : `<span class="text-slate-400">—</span>`;
  const jobs =
    c.jobs.length === 0
      ? `<p class="text-sm text-slate-400">No jobs yet.</p>`
      : `<ul class="space-y-1.5">${c.jobs
          .slice(0, 5)
          .map(
            (j) => `
              <li class="flex items-center justify-between gap-2 text-sm">
                <div class="min-w-0">
                  <div class="font-medium text-slate-900 truncate">${escapeHtml(j.title || "Window Cleaning")}</div>
                  <div class="text-xs text-slate-500">${escapeHtml(formatDate(j.scheduled_at))}</div>
                </div>
                <div class="font-semibold text-slate-900 tabular-nums whitespace-nowrap">${money(j.price_cents)}</div>
              </li>`
          )
          .join("")}</ul>`;

  return `
    <div class="customer-popup font-sans" style="min-width: 240px; max-width: 280px;">
      <div class="px-4 pt-4 pb-2">
        <h3 class="font-semibold text-slate-900 leading-tight">${name}</h3>
        ${address ? `<p class="text-xs text-slate-500 mt-0.5">${address}</p>` : ""}
      </div>
      <div class="px-4 py-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div class="uppercase tracking-wide text-slate-400 mb-0.5">Phone</div>
          <div class="font-medium text-slate-700">${phone}</div>
        </div>
        <div>
          <div class="uppercase tracking-wide text-slate-400 mb-0.5">Email</div>
          <div class="font-medium text-slate-700 truncate">${email}</div>
        </div>
      </div>
      <div class="px-4 py-2 border-t border-slate-100">
        <div class="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Jobs</div>
        ${jobs}
      </div>
      <div class="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        <a href="/schedule/new?customer_id=${c.id}" class="flex-1 text-center text-xs bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-3 py-1.5 font-medium">Schedule Job</a>
        <button data-action="invoice" class="flex-1 text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full px-3 py-1.5">Create Invoice</button>
      </div>
    </div>
  `;
}

async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features: { place_name: string }[] };
    return data.features[0]?.place_name || null;
  } catch {
    return null;
  }
}

function makeDoorKnockMarkerEl(status: string): HTMLElement {
  const def = statusByKey(status) || STATUSES[1];
  const el = document.createElement("div");
  el.style.cssText = [
    "width: 38px",
    "height: 38px",
    "border-radius: 50%",
    `background: ${def.color}`,
    "color: white",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "border: 2px solid #fff",
    "cursor: pointer",
    `box-shadow: 0 2px 8px rgba(0,0,0,0.25)${def.glow ? ", 0 0 18px rgba(239,68,68,0.6)" : ""}`,
  ].join(";");
  el.innerHTML = iconSvg(def.iconKey, 18);
  return el;
}

function makeCustomerMarkerEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width: 30px; height: 40px; cursor: pointer;`;
  el.innerHTML = `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="mp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path filter="url(#mp-shadow)" d="M15 1c-7.7 0-14 6.3-14 14 0 9.6 12.5 22.5 13.1 23 .5.5 1.3.5 1.8 0 .6-.5 13.1-13.4 13.1-23 0-7.7-6.3-14-14-14z" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="#fff"/>
    </svg>
  `;
  return el;
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [styleType, setStyleType] = useState<StyleType>("streets");
  const [ready, setReady] = useState(false);

  const [customers, setCustomers] = useState<GeocodedCustomer[]>([]);
  const customerMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [pins, setPins] = useState<MapPinRow[]>([]);
  const pinMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const [knockMode, setKnockMode] = useState(false);
  const [sheet, setSheet] = useState<SheetPin | null>(null);
  const knockModeRef = useRef(false);
  useEffect(() => {
    knockModeRef.current = knockMode;
  }, [knockMode]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [staff, setStaff] = useState<Staff[]>([]);
  useEffect(() => {
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then(setStaff);
  }, []);

  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<number[][]>([]);
  const drawModeRef = useRef(false);
  const drawPointsRef = useRef<number[][]>([]);
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);
  useEffect(() => {
    drawPointsRef.current = drawPoints;
  }, [drawPoints]);

  const [territories, setTerritories] = useState<TerritoryRow[]>([]);
  const [territoryDraft, setTerritoryDraft] = useState<TerritoryDraft | null>(null);

  useEffect(() => {
    fetch("/api/territories")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TerritoryRow[]) => setTerritories(rows));
  }, []);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STREETS_STYLE,
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => setReady(true));
    map.on("click", async (e) => {
      if (drawModeRef.current) {
        const { lng, lat } = e.lngLat;
        setDrawPoints((arr) => [...arr, [lng, lat]]);
        return;
      }
      if (!knockModeRef.current) return;
      const { lng, lat } = e.lngLat;
      setSheet({ lat, lng, address: "Looking up address…" });
      const addr = await reverseGeocode(lng, lat);
      setSheet((cur) => (cur && cur.lng === lng && cur.lat === lat ? { ...cur, address: addr } : cur));
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(
      styleType === "satellite" ? SATELLITE_STYLE : STREETS_STYLE
    );
  }, [styleType]);

  // Fetch + geocode customers
  useEffect(() => {
    if (!TOKEN) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/map/customers");
      if (!res.ok) return;
      const list = (await res.json()) as Customer[];
      const cache = loadGeocodeCache();
      const out: GeocodedCustomer[] = [];
      for (const c of list) {
        if (!c.address) continue;
        const center = await geocode(c.address, cache);
        if (cancelled) return;
        if (center) {
          out.push({ ...c, lng: center[0], lat: center[1] });
          if (out.length === 1 && mapRef.current) {
            mapRef.current.flyTo({ center, zoom: 11, duration: 1500 });
          }
        }
      }
      if (!cancelled) setCustomers(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle map cursor for knock / draw modes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = knockMode || drawMode ? "crosshair" : "";
  }, [knockMode, drawMode, ready, styleType]);

  // Install territory + draw layers on map style load
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function install() {
      const m = mapRef.current;
      if (!m) return;
      if (!m.getSource("territories")) {
        m.addSource("territories", {
          type: "geojson",
          data: emptyFeatureCollection(),
        });
        m.addLayer({
          id: "territories-fill",
          type: "fill",
          source: "territories",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 },
        });
        m.addLayer({
          id: "territories-line",
          type: "line",
          source: "territories",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
          },
        });
        m.addLayer({
          id: "territories-label",
          type: "symbol",
          source: "territories",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 13,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-anchor": "center",
          },
          paint: {
            "text-color": ["get", "color"],
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
        m.on("click", "territories-fill", (e) => {
          if (drawModeRef.current || knockModeRef.current) return;
          const f = e.features?.[0];
          if (!f) return;
          const id = f.properties?.id as number;
          const t = territoriesRef.current.find((x) => x.id === id);
          if (!t) return;
          let coords: number[][] = [];
          try {
            coords = JSON.parse(t.polygon);
          } catch {}
          let assigned: number[] = [];
          try {
            assigned = t.assigned_employee_ids
              ? JSON.parse(t.assigned_employee_ids)
              : [];
          } catch {}
          setTerritoryDraft({
            id: t.id,
            name: t.name,
            color: t.color,
            polygon: coords,
            assigned_employee_ids: assigned,
          });
        });
        m.on("mouseenter", "territories-fill", () => {
          if (drawModeRef.current || knockModeRef.current) return;
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "territories-fill", () => {
          if (drawModeRef.current || knockModeRef.current) return;
          m.getCanvas().style.cursor = "";
        });
      }
      if (!m.getSource("draw-active")) {
        m.addSource("draw-active", {
          type: "geojson",
          data: emptyFeatureCollection(),
        });
        m.addLayer({
          id: "draw-line",
          type: "line",
          source: "draw-active",
          paint: {
            "line-color": "#3b82f6",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
          filter: ["==", ["geometry-type"], "LineString"],
        });
        m.addLayer({
          id: "draw-points",
          type: "circle",
          source: "draw-active",
          paint: {
            "circle-radius": 5,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
          filter: ["==", ["geometry-type"], "Point"],
        });
      }
    }
    if (map.isStyleLoaded()) install();
    map.on("style.load", install);
    return () => {
      map.off("style.load", install);
    };
  }, [ready]);

  // Keep territories source in sync
  const territoriesRef = useRef<TerritoryRow[]>([]);
  useEffect(() => {
    territoriesRef.current = territories;
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("territories") as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (src) src.setData(territoryFeatures(territories) as never);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [territories, ready, styleType]);

  // Keep draw-active source in sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("draw-active") as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (src) src.setData(drawFeatures(drawPoints) as never);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [drawPoints, ready, styleType]);

  // Fetch door-knock pins
  useEffect(() => {
    if (!TOKEN) return;
    fetch("/api/map/pins")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MapPinRow[]) => setPins(data));
  }, []);

  // Render door knock markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const refs = pinMarkersRef.current;
    const seen = new Set<number>();
    const allowedStatuses = new Set(filters.statuses);
    const fromMs =
      filters.dateRangeOn && filters.fromDate
        ? new Date(`${filters.fromDate}T00:00:00`).getTime()
        : null;
    const toMs =
      filters.dateRangeOn && filters.toDate
        ? new Date(`${filters.toDate}T23:59:59.999`).getTime()
        : null;
    const selectedNames = filters.staffIds.length
      ? staff
          .filter((s) => filters.staffIds.includes(s.id))
          .map((s) => s.name.trim().toLowerCase())
      : null;
    const visiblePins = pins.filter((p) => {
      if (!allowedStatuses.has(p.status)) return false;
      if (fromMs || toMs) {
        const created = new Date(p.created_at).getTime();
        if (fromMs && created < fromMs) return false;
        if (toMs && created > toMs) return false;
      }
      if (selectedNames) {
        if (!p.created_by) return false;
        if (!selectedNames.includes(p.created_by.trim().toLowerCase()))
          return false;
      }
      return true;
    });
    for (const p of visiblePins) {
      seen.add(p.id);
      const existing = refs.get(p.id);
      if (existing) {
        existing.remove();
      }
      const el = makeDoorKnockMarkerEl(p.status);
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        popupRef.current?.remove();
        setSheet({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          address: p.address,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          status: p.status,
          objections: p.objections ? (JSON.parse(p.objections) as string[]) : [],
          customer_id: p.customer_id,
        });
      });
      refs.set(p.id, marker);
    }
    for (const [id, marker] of refs) {
      if (!seen.has(id)) {
        marker.remove();
        refs.delete(id);
      }
    }
  }, [pins, ready, styleType, filters, staff]);

  // Render customer markers when map ready / customers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    customerMarkersRef.current.forEach((m) => m.remove());
    customerMarkersRef.current = [];
    if (!filters.showCustomers) return;
    for (const c of customers) {
      const el = makeCustomerMarkerEl();
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([c.lng, c.lat])
        .addTo(map);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        popupRef.current?.remove();
        const popup = new mapboxgl.Popup({
          offset: 36,
          closeButton: true,
          maxWidth: "320px",
        })
          .setLngLat([c.lng, c.lat])
          .setHTML(customerPopupHtml(c))
          .addTo(map);
        popupRef.current = popup;
        const node = popup.getElement();
        const invoiceBtn = node?.querySelector('[data-action="invoice"]');
        invoiceBtn?.addEventListener("click", () => {
          alert("Invoicing is coming soon.");
        });
      });
      customerMarkersRef.current.push(marker);
    }
  }, [customers, ready, styleType, filters.showCustomers]);

  function zoomIn() {
    mapRef.current?.zoomIn();
  }
  function zoomOut() {
    mapRef.current?.zoomOut();
  }
  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 1200,
        });
      },
      () => {
        alert("Could not get your location.");
      }
    );
  }

  if (!TOKEN) {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 flex items-center justify-center px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md text-center shadow-sm">
          <h2 className="font-semibold text-slate-900 text-lg">
            Add a Mapbox token
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Set <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
            in <code className="bg-slate-100 px-1 rounded">apps/web/.env</code>{" "}
            to load the map. Free tokens are available at{" "}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-600 hover:underline"
            >
              mapbox.com
            </a>
            . Then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-14 bottom-0">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 bg-slate-50/40">
          Loading map…
        </div>
      )}
      <FloatingControls
        styleType={styleType}
        setStyleType={setStyleType}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        locateMe={locateMe}
        knockMode={knockMode}
        toggleKnock={() => {
          setKnockMode((v) => !v);
          if (drawMode) {
            setDrawMode(false);
            setDrawPoints([]);
          }
        }}
        filterOpen={filterOpen}
        toggleFilter={() => setFilterOpen((v) => !v)}
        drawMode={drawMode}
        toggleDraw={() => {
          setDrawMode((v) => {
            const next = !v;
            if (!next) setDrawPoints([]);
            return next;
          });
          if (knockMode) setKnockMode(false);
        }}
      />
      {filterOpen && (
        <MapFilterPanel
          filters={filters}
          setFilters={setFilters}
          onClose={() => setFilterOpen(false)}
          staff={staff}
        />
      )}
      {knockMode && (
        <div className="absolute top-4 left-4 z-10 bg-cyan-500 text-white text-xs font-medium rounded-full px-3 py-1.5 shadow-md">
          Door knock mode — tap the map to drop a pin
        </div>
      )}
      {drawMode && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="bg-cyan-500 text-white text-xs font-medium rounded-full px-3 py-1.5 shadow-md">
            {drawPoints.length < 3
              ? `Drawing — tap the map to add points (${drawPoints.length}/3 min)`
              : `Drawing — ${drawPoints.length} points`}
          </div>
          {drawPoints.length >= 3 && (
            <button
              onClick={() => {
                setTerritoryDraft({ polygon: drawPoints });
                setDrawMode(false);
              }}
              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-full px-3 py-1.5 shadow-md"
            >
              Finish drawing
            </button>
          )}
          <button
            onClick={() => {
              setDrawMode(false);
              setDrawPoints([]);
            }}
            className="bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 text-xs rounded-full px-3 py-1.5 shadow-md"
          >
            Cancel
          </button>
        </div>
      )}
      <Legend />
      {territoryDraft && (
        <MapTerritoryModal
          draft={territoryDraft}
          staff={staff}
          onClose={() => {
            setTerritoryDraft(null);
            setDrawPoints([]);
          }}
          onSaved={(saved) => {
            setTerritoryDraft(null);
            setDrawPoints([]);
            setTerritories((arr) => {
              const idx = arr.findIndex((t) => t.id === saved.id);
              const row: TerritoryRow = {
                id: saved.id,
                name: saved.name || "",
                color: saved.color || "#3b82f6",
                polygon: JSON.stringify(saved.polygon),
                assigned_employee_ids: saved.assigned_employee_ids
                  ? JSON.stringify(saved.assigned_employee_ids)
                  : null,
                created_by: null,
                created_at: new Date().toISOString(),
              };
              if (idx >= 0) {
                const next = arr.slice();
                next[idx] = row;
                return next;
              }
              return [row, ...arr];
            });
          }}
          onDelete={async (id) => {
            await fetch(`/api/territories/${id}`, { method: "DELETE" });
            setTerritoryDraft(null);
            setTerritories((arr) => arr.filter((t) => t.id !== id));
          }}
        />
      )}
      {sheet && (
        <MapDoorKnockSheet
          pin={sheet}
          onClose={() => setSheet(null)}
          onSaved={(saved) => {
            setSheet(null);
            setPins((arr) => {
              const idx = arr.findIndex((p) => p.id === saved.id);
              const row: MapPinRow = {
                id: saved.id,
                lat: saved.lat,
                lng: saved.lng,
                address: saved.address || null,
                first_name: saved.first_name || null,
                last_name: saved.last_name || null,
                phone: saved.phone || null,
                status: saved.status || "not_home",
                objections: saved.objections
                  ? JSON.stringify(saved.objections)
                  : null,
                customer_id: saved.customer_id || null,
                created_by: null,
                created_at: new Date().toISOString(),
              };
              if (idx >= 0) {
                const next = arr.slice();
                next[idx] = row;
                return next;
              }
              return [row, ...arr];
            });
          }}
          onDelete={async (id) => {
            await fetch(`/api/map/pins/${id}`, { method: "DELETE" });
            setSheet(null);
            setPins((arr) => arr.filter((p) => p.id !== id));
          }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-white rounded-2xl shadow-md p-3 text-xs max-w-[260px]">
      <div className="font-semibold text-slate-700 mb-2">Pin legend</div>
      <div className="grid grid-cols-2 gap-1.5">
        {STATUSES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
        <svg width="14" height="18" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 1c-7.7 0-14 6.3-14 14 0 9.6 12.5 22.5 13.1 23 .5.5 1.3.5 1.8 0 .6-.5 13.1-13.4 13.1-23 0-7.7-6.3-14-14-14z" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
          <circle cx="15" cy="15" r="5" fill="#fff" />
        </svg>
        <span className="text-slate-600">Customer</span>
      </div>
    </div>
  );
}

function FloatingControls({
  styleType,
  setStyleType,
  zoomIn,
  zoomOut,
  locateMe,
  knockMode,
  toggleKnock,
  filterOpen,
  toggleFilter,
  drawMode,
  toggleDraw,
}: {
  styleType: StyleType;
  setStyleType: (s: StyleType) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  locateMe: () => void;
  knockMode: boolean;
  toggleKnock: () => void;
  filterOpen: boolean;
  toggleFilter: () => void;
  drawMode: boolean;
  toggleDraw: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
      <ControlGroup>
        <ControlButton onClick={zoomIn} label="Zoom in">
          <PlusIcon />
        </ControlButton>
        <Divider />
        <ControlButton onClick={zoomOut} label="Zoom out">
          <MinusIcon />
        </ControlButton>
      </ControlGroup>
      <ControlButton
        onClick={() =>
          setStyleType(styleType === "streets" ? "satellite" : "streets")
        }
        label={styleType === "streets" ? "Switch to satellite" : "Switch to streets"}
        active={styleType === "satellite"}
      >
        <LayersIcon />
      </ControlButton>
      <ControlButton onClick={locateMe} label="My location">
        <LocateIcon />
      </ControlButton>
      <ControlButton onClick={toggleFilter} label="Filters" active={filterOpen}>
        <FilterIcon />
      </ControlButton>
      <ControlButton
        onClick={toggleDraw}
        label="Territory draw"
        active={drawMode}
      >
        <PolygonIcon />
      </ControlButton>
      <ControlButton
        onClick={toggleKnock}
        label="Door knock mode"
        active={knockMode}
      >
        <PinIcon />
      </ControlButton>
    </div>
  );
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-full shadow-md flex flex-col items-center overflow-hidden">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="w-6 h-px bg-slate-100" />;
}

function ControlButton({
  onClick,
  label,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={
        "w-10 h-10 rounded-full shadow-md flex items-center justify-center transition " +
        (active
          ? "bg-cyan-500 text-white"
          : "bg-white text-slate-600 hover:bg-slate-50") +
        (disabled ? " opacity-40 cursor-not-allowed" : "")
      }
    >
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function LocateIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function PolygonIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 9 12 3 21 9 18 20 6 20 3 9" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
