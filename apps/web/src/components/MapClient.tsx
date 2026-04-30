"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createElement, useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MapIconStrip from "./MapIconStrip";
import MapPinDropModal from "./MapPinDropModal";
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
};

type ModalState = {
  open: boolean;
  lng: number;
  lat: number;
  editingId?: number;
  initialStatus?: PinStatus;
  initialNote?: string;
};

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
            fill="${CUSTOMER_PIN_COLOR}" stroke="white" stroke-width="2"/>
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
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef<{ x: number; y: number } | null>(null);

  const [styleMode, setStyleMode] = useState<StyleMode>("satellite");
  const [pinsVisible, setPinsVisible] = useState(true);
  const pinsVisibleRef = useRef(true);
  const [showCustomerPins, setShowCustomerPins] = useState(true);
  const showCustomerPinsRef = useRef(true);
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
    if (!showCustomerPinsRef.current) el.style.display = "none";
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

    map.on("load", async () => {
      try {
        const [pinsRes, customersRes] = await Promise.all([
          fetch("/api/map/pins"),
          fetch("/api/map/customer-pins"),
        ]);
        if (pinsRes.ok) {
          const list = (await pinsRes.json()) as ApiPin[];
          for (const p of list) addMarker(p);
        }
        if (customersRes.ok) {
          const list = (await customersRes.json()) as CustomerPin[];
          for (const c of list) addCustomerMarker(c);
        }
      } catch {
        // ignore
      }
    });

    function onPressDown(
      e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent
    ) {
      const target = e.originalEvent.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === "function" &&
        (target.closest(".mp-pin") || target.closest(".mp-customer-pin"))
      ) {
        return;
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
    for (const [, marker] of customerMarkersRef.current) {
      marker.getElement().style.display = showCustomerPins ? "" : "none";
    }
  }, [showCustomerPins]);

  function toggleStyle() {
    const next: StyleMode = styleMode === "satellite" ? "streets" : "satellite";
    setStyleMode(next);
    const map = mapRef.current;
    if (!map) return;
    // TODO: when adding pin/territory layers later, re-add them in the 'style.load' event handler after setStyle so they persist across style changes.
    map.setStyle(next === "satellite" ? SATELLITE_STYLE : STREETS_STYLE);
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
      />
      <MapPinDropModal
        open={modal.open}
        initialStatus={modal.initialStatus}
        initialNote={modal.initialNote}
        onCancel={() => setModal({ open: false, lng: 0, lat: 0 })}
        onSubmit={submitModal}
      />
    </div>
  );
}
