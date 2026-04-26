"use client";

import { useEffect, useRef } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MB_VERSION = "v3.7.0";

declare global {
  interface Window {
    mapboxgl?: {
      accessToken: string;
      Map: new (opts: {
        container: HTMLElement;
        style: string;
        center: [number, number];
        zoom: number;
      }) => { remove(): void };
    };
  }
}

function loadMapbox(): Promise<NonNullable<Window["mapboxgl"]>> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if (window.mapboxgl) return resolve(window.mapboxgl);

    if (!document.getElementById("mapbox-gl-css")) {
      const link = document.createElement("link");
      link.id = "mapbox-gl-css";
      link.rel = "stylesheet";
      link.href = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.css`;
      document.head.appendChild(link);
    }

    const existing = document.getElementById(
      "mapbox-gl-js"
    ) as HTMLScriptElement | null;
    const finish = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error("mapbox-gl loaded but window.mapboxgl missing"));
    };
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () =>
        reject(new Error("mapbox-gl failed to load"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "mapbox-gl-js";
    script.src = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.js`;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("mapbox-gl failed to load"));
    document.head.appendChild(script);
  });
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let map: { remove(): void } | null = null;
    let cancelled = false;

    loadMapbox().then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-98.5795, 39.8283],
        zoom: 3,
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
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
