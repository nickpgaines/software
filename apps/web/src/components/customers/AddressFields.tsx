"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const BIAS_CENTER = { lat: 32.7765, lng: -79.9311 };
const BIAS_RADIUS_M = 80_000;

export type AddressValue = {
  address_line1: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string;
};

export const EMPTY_ADDRESS: AddressValue = {
  address_line1: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  latitude: null,
  longitude: null,
  formatted_address: "",
};

export default function AddressFields({
  value,
  onChange,
  inputClassName,
  label = true,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  inputClassName?: string;
  label?: boolean;
}) {
  if (!KEY) {
    return (
      <ManualFields
        value={value}
        onChange={onChange}
        inputClassName={inputClassName}
        label={label}
        autocompleteAvailable={false}
      />
    );
  }
  return (
    <APIProvider apiKey={KEY} libraries={["places"]}>
      <AddressFieldsInner
        value={value}
        onChange={onChange}
        inputClassName={inputClassName}
        label={label}
      />
    </APIProvider>
  );
}

function AddressFieldsInner({
  value,
  onChange,
  inputClassName,
  label,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  inputClassName?: string;
  label: boolean;
}) {
  const places = useMapsLibrary("places");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<unknown>(null);

  const ready = !!places;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!ready || !value.address_line1) {
      setPredictions([]);
      return;
    }
    const q = value.address_line1.trim();
    if (!q) {
      setPredictions([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const fetched = await fetchSuggestions(places!, q, sessionTokenRef);
        if (!cancelled) {
          setPredictions(fetched);
          setOpen(fetched.length > 0);
          setHighlight(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value.address_line1, ready, places]);

  async function pick(prediction: Prediction) {
    setOpen(false);
    setPredictions([]);
    const filled = await resolvePlace(places!, prediction);
    if (!filled) return;
    onChange({ ...value, ...filled });
    sessionTokenRef.current = null;
  }

  const showInputDropdown = open && predictions.length > 0;

  return (
    <div ref={containerRef} className="space-y-3">
      <Field show={label} label="Address" required>
        <div className="relative">
          <input
            type="text"
            value={value.address_line1}
            onChange={(e) =>
              onChange({ ...value, address_line1: e.target.value })
            }
            onFocus={() => {
              if (predictions.length > 0) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!showInputDropdown) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, predictions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const p = predictions[highlight];
                if (p) pick(p);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Start typing an address…"
            className={
              inputClassName ||
              "w-full border border-slate-300 rounded px-3 py-2 text-sm"
            }
            autoComplete="off"
            required
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              …
            </span>
          )}
          {showInputDropdown && (
            <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {predictions.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={
                      "w-full text-left px-3 py-2 text-sm " +
                      (i === highlight
                        ? "bg-cyan-50 text-cyan-900"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    <div className="font-medium truncate">{p.mainText}</div>
                    {p.secondaryText && (
                      <div className="text-xs text-slate-500 truncate">
                        {p.secondaryText}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <ManualFields
        value={value}
        onChange={onChange}
        inputClassName={inputClassName}
        label={label}
        skipLine1
        autocompleteAvailable
      />
    </div>
  );
}

function ManualFields({
  value,
  onChange,
  inputClassName,
  label,
  skipLine1,
  autocompleteAvailable,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  inputClassName?: string;
  label: boolean;
  skipLine1?: boolean;
  autocompleteAvailable?: boolean;
}) {
  const cls =
    inputClassName ||
    "w-full border border-slate-300 rounded px-3 py-2 text-sm";
  return (
    <>
      {!skipLine1 && (
        <Field show={label} label="Address">
          <input
            type="text"
            value={value.address_line1}
            onChange={(e) =>
              onChange({
                ...value,
                address_line1: e.target.value,
                formatted_address: "",
                latitude: null,
                longitude: null,
              })
            }
            placeholder={
              autocompleteAvailable
                ? "Start typing an address…"
                : "123 Main St"
            }
            className={cls}
            autoComplete="off"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field show={label} label="Unit">
          <input
            type="text"
            value={value.unit}
            onChange={(e) =>
              onChange({
                ...value,
                unit: e.target.value,
                formatted_address: "",
              })
            }
            placeholder="Apt 4B"
            className={cls}
            autoComplete="off"
          />
        </Field>
        <Field show={label} label="Zip">
          <input
            type="text"
            value={value.zip}
            onChange={(e) =>
              onChange({ ...value, zip: e.target.value, formatted_address: "" })
            }
            inputMode="numeric"
            className={cls}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Field show={label} label="City">
          <input
            type="text"
            value={value.city}
            onChange={(e) =>
              onChange({ ...value, city: e.target.value, formatted_address: "" })
            }
            className={cls}
            autoComplete="off"
          />
        </Field>
        <Field show={label} label="State">
          <input
            type="text"
            value={value.state}
            onChange={(e) =>
              onChange({
                ...value,
                state: e.target.value.toUpperCase().slice(0, 2),
                formatted_address: "",
              })
            }
            maxLength={2}
            className={cls + " uppercase"}
            autoComplete="off"
          />
        </Field>
      </div>
    </>
  );
}

function Field({
  show,
  label,
  required,
  children,
}: {
  show: boolean;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

type Prediction = {
  id: string;
  mainText: string;
  secondaryText: string;
  raw: PlacePrediction;
};

type PlacePrediction = {
  toPlace(): Place;
};

type Place = {
  fetchFields(opts: { fields: string[] }): Promise<unknown>;
  formattedAddress?: string | null;
  addressComponents?: AddressComponent[];
  location?: { lat(): number; lng(): number } | null;
};

type AddressComponent = {
  longText?: string | null;
  shortText?: string | null;
  types: string[];
};

type PlacesNamespace = {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(req: object): Promise<{
      suggestions: Array<{ placePrediction: PlacePrediction & PredictionInfo }>;
    }>;
  };
  AutocompleteSessionToken: new () => unknown;
};

type PredictionInfo = {
  placeId: string;
  text: { text: string; toString(): string };
  mainText?: { text: string };
  secondaryText?: { text: string };
};

async function fetchSuggestions(
  places: unknown,
  input: string,
  sessionTokenRef: React.MutableRefObject<unknown>
): Promise<Prediction[]> {
  try {
    const ns = places as PlacesNamespace;
    if (!ns?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      return [];
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new ns.AutocompleteSessionToken();
    }
    const result = await ns.AutocompleteSuggestion.fetchAutocompleteSuggestions(
      {
        input,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ["us"],
        locationBias: {
          center: BIAS_CENTER,
          radius: BIAS_RADIUS_M,
        },
      } as object
    );
    return result.suggestions
      .map((s, idx) => {
        const info = s.placePrediction as PlacePrediction & PredictionInfo;
        return {
          id: info.placeId || String(idx),
          mainText: info.mainText?.text || info.text?.toString() || "",
          secondaryText: info.secondaryText?.text || "",
          raw: s.placePrediction,
        };
      })
      .filter((p) => p.mainText);
  } catch {
    return [];
  }
}

async function resolvePlace(
  places: unknown,
  prediction: Prediction
): Promise<Partial<AddressValue> | null> {
  try {
    const place = prediction.raw.toPlace();
    await place.fetchFields({
      fields: [
        "displayName",
        "formattedAddress",
        "addressComponents",
        "location",
      ],
    });
    const components = place.addressComponents || [];
    const get = (type: string, useShort = false) => {
      const c = components.find((cmp) => cmp.types.includes(type));
      if (!c) return "";
      return (useShort ? c.shortText : c.longText) || "";
    };
    const streetNumber = get("street_number");
    const route = get("route");
    const city =
      get("locality") ||
      get("postal_town") ||
      get("sublocality_level_1") ||
      get("administrative_area_level_3");
    const state = get("administrative_area_level_1", true);
    const zip = get("postal_code");
    const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
    const lat = place.location?.lat?.() ?? null;
    const lng = place.location?.lng?.() ?? null;
    return {
      address_line1: line1,
      city,
      state,
      zip,
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lng === "number" ? lng : null,
      formatted_address: place.formattedAddress || "",
    };
  } catch {
    return null;
  }
}
