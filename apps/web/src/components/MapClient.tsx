"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";
const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

type StyleType = "streets" | "satellite";

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [styleType, setStyleType] = useState<StyleType>("streets");
  const [ready, setReady] = useState(false);

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
      />
    </div>
  );
}

function FloatingControls({
  styleType,
  setStyleType,
  zoomIn,
  zoomOut,
  locateMe,
}: {
  styleType: StyleType;
  setStyleType: (s: StyleType) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  locateMe: () => void;
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
      <ControlButton onClick={() => {}} label="Filters" disabled>
        <FilterIcon />
      </ControlButton>
      <ControlButton onClick={() => {}} label="Territory draw" disabled>
        <PolygonIcon />
      </ControlButton>
      <ControlButton onClick={() => {}} label="Door knock mode" disabled>
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
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function LocateIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function PolygonIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="3 9 12 3 21 9 18 20 6 20 3 9" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
