"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const STATUSES = [
  { key: "sale", label: "Sale", color: "#22c55e" },
  { key: "not_home", label: "Not Home", color: "#f97316" },
  { key: "not_interested", label: "Not Interested", color: "#ef4444" },
  { key: "do_not_contact", label: "Do Not Contact", color: "#78350f" },
  { key: "not_qualified", label: "Not Qualified", color: "#a855f7" },
  { key: "revisit", label: "Revisit", color: "#06b6d4" },
  { key: "referral", label: "Referral", color: "#ec4899" },
  { key: "quote", label: "Quote", color: "#3b82f6" },
] as const;

type StatusKey = (typeof STATUSES)[number]["key"];

const STATUS_COLORS: Record<string, string> = STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.color }),
  {} as Record<string, string>
);

type Pin = {
  id: number;
  lat: number;
  lng: number;
  status: string;
};

type Sheet = {
  lat: number;
  lng: number;
  address: string | null;
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

async function reverseGeocode(
  lng: number,
  lat: number
): Promise<string | null> {
  if (!TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&access_token=${TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features: { place_name: string }[] };
    return data.features[0]?.place_name ?? null;
  } catch {
    return null;
  }
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pins, setPins] = useState<Pin[]>([]);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function startPressTimer(lng: number, lat: number) {
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      if (tempMarkerRef.current) tempMarkerRef.current.remove();
      const el = makeMarkerEl("not_home");
      tempMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([lng, lat])
        .addTo(map);
      setSheet({ lat, lng, address: null });
      reverseGeocode(lng, lat).then((address) => {
        setSheet((cur) =>
          cur && cur.lat === lat && cur.lng === lng
            ? { ...cur, address }
            : cur
        );
      });
    }, 500);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283],
      zoom: 3.5,
    });
    mapRef.current = map;
    map.on("load", () => setReady(true));

    map.on("mousedown", (e) => {
      startPressTimer(e.lngLat.lng, e.lngLat.lat);
    });
    map.on("touchstart", (e) => {
      const lngLat = e.lngLat;
      if (lngLat) startPressTimer(lngLat.lng, lngLat.lat);
    });
    map.on("mouseup", clearPressTimer);
    map.on("touchend", clearPressTimer);
    map.on("dragstart", clearPressTimer);

    return () => {
      clearPressTimer();
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

  function closeSheet() {
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
    setSheet(null);
  }

  async function refreshPins() {
    const data = await fetch("/api/map/pins")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    setPins(data);
  }

  return (
    <>
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
      {sheet && (
        <DoorKnockSheet
          sheet={sheet}
          onCancel={closeSheet}
          onSaved={async () => {
            closeSheet();
            await refreshPins();
          }}
        />
      )}
    </>
  );
}

function DoorKnockSheet({
  sheet,
  onCancel,
  onSaved,
}: {
  sheet: Sheet;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<StatusKey>("not_home");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(sheet.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sheet.address && !address) setAddress(sheet.address);
  }, [sheet.address]);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/map/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: sheet.lat,
        lng: sheet.lng,
        status,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        address: address || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save pin");
      return;
    }
    onSaved();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "white",
          width: "100%",
          maxWidth: 520,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.15)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#cbd5e1",
            borderRadius: 2,
            margin: "0 auto 12px",
          }}
        />
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#0f172a",
            margin: "0 0 4px",
          }}
        >
          New door knock
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
          {sheet.lat.toFixed(5)}, {sheet.lng.toFixed(5)}
        </p>

        <Field label="Status">
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
              marginRight: -20,
              marginLeft: -20,
              padding: "0 20px 6px",
            }}
          >
            {STATUSES.map((s) => {
              const active = status === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  style={{
                    flex: "0 0 auto",
                    border: active
                      ? `2px solid ${s.color}`
                      : "1px solid #e2e8f0",
                    background: active ? "#f8fafc" : "white",
                    borderRadius: 999,
                    padding: "6px 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: s.color,
                    }}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="First name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Last name">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            style={inputStyle}
          />
        </Field>

        <Field label="Address">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={sheet.address === null ? "Looking up address…" : ""}
            style={inputStyle}
          />
        </Field>

        {error && (
          <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 8px" }}>
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "1px solid #e2e8f0",
              background: "white",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              border: "none",
              background: saving ? "#67e8f9" : "#06b6d4",
              color: "white",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 14,
  outline: "none",
  background: "white",
  color: "#0f172a",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#94a3b8",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
