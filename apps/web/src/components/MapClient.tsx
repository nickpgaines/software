"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import MapIconStrip from "./MapIconStrip";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";

type StyleMode = "satellite" | "streets";

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [styleMode, setStyleMode] = useState<StyleMode>("satellite");

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
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function toggleStyle() {
    const next: StyleMode = styleMode === "satellite" ? "streets" : "satellite";
    setStyleMode(next);
    const map = mapRef.current;
    if (!map) return;
    // TODO: when adding pin/territory layers later, re-add them in the 'style.load' event handler after setStyle so they persist across style changes.
    map.setStyle(next === "satellite" ? SATELLITE_STYLE : STREETS_STYLE);
  }

  return (
    <div style={{ position: "relative", height: "100vh", marginLeft: "240px" }}>
      <div
        ref={containerRef}
        style={{ position: "fixed", top: 0, left: "240px", right: 0, bottom: 0 }}
      />
      <MapIconStrip styleMode={styleMode} onToggleStyle={toggleStyle} />
    </div>
  );
}
