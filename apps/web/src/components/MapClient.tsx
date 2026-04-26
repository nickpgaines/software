"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283],
      zoom: 3.5,
    });
    return () => map.remove();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", top: "56px", left: 0, right: 0, bottom: 0 }}
    />
  );
}
