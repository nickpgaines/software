"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const STATUS_COLORS: Record<string, string> = {
  sale: "#22c55e",
  not_home: "#f97316",
  not_interested: "#ef4444",
  do_not_contact: "#78350f",
  not_qualified: "#a855f7",
  revisit: "#06b6d4",
  referral: "#ec4899",
  quote: "#3b82f6",
};

type Pin = {
  id: number;
  lat: number;
  lng: number;
  status: string;
};

function makeMarkerEl(status: string): HTMLElement {
  const color = STATUS_COLORS[status] ?? "#64748b";
  const el = document.createElement("div");
  el.style.cssText = [
    "width: 22px",
    "height: 22px",
    "border-radius: 50%",
    `background: ${color}`,
    "border: 2px solid #fff",
    "box-shadow: 0 1px 4px rgba(0,0,0,0.35)",
    "cursor: pointer",
  ].join(";");
  return el;
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283],
      zoom: 3.5,
    });
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    fetch("/api/map/pins")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Pin[]) => setPins(data))
      .catch(() => setPins([]));
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const p of pins) {
      const el = makeMarkerEl(p.status);
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [pins, ready]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: "56px",
        left: 0,
        right: 0,
        bottom: 0,
      }}
    />
  );
}
