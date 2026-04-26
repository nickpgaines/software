"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283],
      zoom: 3,
    });
    return () => {
      map.remove();
    };
  }, []);

  if (!TOKEN) {
    return (
      <div
        style={{ height: "calc(100vh - 3.5rem)" }}
        className="flex items-center justify-center text-sm text-slate-500"
      >
        Set NEXT_PUBLIC_MAPBOX_TOKEN in apps/web/.env to load the map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "calc(100vh - 3.5rem)" }}
    />
  );
}
