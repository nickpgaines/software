"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const BIAS_RADIUS_M = 50_000;

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
  locationBias,
  prefillMessage,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  inputClassName?: string;
  label?: boolean;
  locationBias?: { lat: number; lng: number };
  prefillMessage?: string | null;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  if (!KEY || loadFailed) {
    return (
      <ManualFields
        value={value}
        onChange={onChange}
        inputClassName={inputClassName}
        label={label}
        autocompleteAvailable={false}
        message={prefillMessage || "Address suggestions are unavailable. Enter the address manually."}
      />
    );
  }
  return (
    <APIProvider apiKey={KEY} libraries={["places"]} onError={() => setLoadFailed(true)}>
      <AddressFieldsInner
        value={value}
        onChange={onChange}
        inputClassName={inputClassName}
        label={label}
        locationBias={locationBias}
        prefillMessage={prefillMessage}
      />
    </APIProvider>
  );
}

function AddressFieldsInner({
  value,
  onChange,
  inputClassName,
  label,
  locationBias,
  prefillMessage,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  inputClassName?: string;
  label: boolean;
  locationBias?: { lat: number; lng: number };
  prefillMessage?: string | null;
}) {
  const places = useMapsLibrary("places");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [queryActive, setQueryActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<unknown>(null);
  const requestRef = useRef(0);
  const listId = useId();

  const ready = !!places;

  useEffect(() => () => { requestRef.current++; }, []);

  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => setMessage("Address suggestions are unavailable. Enter the address manually."), 8000);
    return () => clearTimeout(timeout);
  }, [ready]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!ready || !queryActive || !value.address_line1) {
      setPredictions([]);
      setLoading(false);
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
        const fetched = await fetchSuggestions(places!, q, sessionTokenRef, locationBias);
        if (!cancelled) {
          setPredictions(fetched);
          setOpen(fetched.length > 0);
          setHighlight(0);
          setMessage(fetched.length ? null : "No matching addresses. You can enter the address manually.");
        }
      } catch {
        if (!cancelled) {
          setPredictions([]);
          setOpen(false);
          setMessage("Address suggestions are unavailable. Enter the address manually.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value.address_line1, ready, places, queryActive, locationBias?.lat, locationBias?.lng]);

  async function pick(prediction: Prediction) {
    const request = ++requestRef.current;
    setQueryActive(false);
    setOpen(false);
    setPredictions([]);
    setLoading(true);
    setMessage(null);
    try {
      const filled = await resolvePlace(prediction);
      if (request === requestRef.current) onChange({ ...value, ...filled });
    } catch {
      if (request === requestRef.current) setMessage("Could not fill this address. Enter the address manually or try another suggestion.");
    } finally {
      if (request === requestRef.current) setLoading(false);
      sessionTokenRef.current = null;
    }
  }

  const showInputDropdown = open && predictions.length > 0;

  return (
    <div ref={containerRef} className="space-y-3">
      <Field show={label} label="Address">
        <div className="relative">
          <Input
            type="text"
            value={value.address_line1}
            onChange={(e) => {
              requestRef.current++;
              setPredictions([]);
              setOpen(false);
              setMessage(null);
              setQueryActive(true);
              onChange({ ...value, address_line1: e.target.value, formatted_address: "", latitude: null, longitude: null });
            }}
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
            aria-label="Address"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showInputDropdown}
            aria-controls={listId}
            aria-activedescendant={showInputDropdown ? `${listId}-${highlight}` : undefined}
            className={
              inputClassName ||
              "w-full h-auto border-line-strong rounded px-3 py-2 text-sm"
            }
            autoComplete="off"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
              …
            </span>
          )}
          {showInputDropdown && (
            <ul id={listId} role="listbox" aria-label="Address suggestions" className="absolute z-30 left-0 right-0 mt-1 bg-card border border-line rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {predictions.map((p, i) => (
                <li key={p.id} role="presentation">
                  <Button
                    type="button"
                    variant="ghost"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(p)}
                    onMouseEnter={() => setHighlight(i)}
                    className={
                      "w-full h-auto justify-start flex-col items-start gap-0 text-left whitespace-normal px-3 py-2 text-sm rounded-none " +
                      (i === highlight
                        ? "bg-black text-white"
                        : "text-zinc-300 hover:bg-black")
                    }
                  >
                    <div className="font-bold truncate w-full">{p.mainText}</div>
                    {p.secondaryText && (
                      <div className="text-xs text-zinc-400 truncate w-full font-normal">
                        {p.secondaryText}
                      </div>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {(message || prefillMessage || !ready) && (
        <p role="status" className="text-xs text-zinc-400">
          {message || prefillMessage || "Loading address suggestions. You can also enter the address manually."}
        </p>
      )}

      <ManualFields
        value={value}
        onChange={(next) => { requestRef.current++; onChange(next); }}
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
  message,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  inputClassName?: string;
  label: boolean;
  skipLine1?: boolean;
  autocompleteAvailable?: boolean;
  message?: string | null;
}) {
  const cls =
    inputClassName ||
    "w-full h-auto border-line-strong rounded px-3 py-2 text-sm";
  return (
    <>
      {message && <p role="status" className="text-xs text-zinc-400">{message}</p>}
      {!skipLine1 && (
        <Field show={label} label="Address">
          <Input
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
            aria-label="Address"
            className={cls}
            autoComplete="off"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field show={label} label="Unit">
          <Input
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
            aria-label="Unit"
            className={cls}
            autoComplete="off"
          />
        </Field>
        <Field show={label} label="Zip">
          <Input
            type="text"
            value={value.zip}
            onChange={(e) =>
              onChange({ ...value, zip: e.target.value, formatted_address: "", latitude: null, longitude: null })
            }
            inputMode="numeric"
            placeholder="ZIP"
            aria-label="ZIP"
            className={cls}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Field show={label} label="City">
          <Input
            type="text"
            value={value.city}
            onChange={(e) =>
              onChange({ ...value, city: e.target.value, formatted_address: "", latitude: null, longitude: null })
            }
            placeholder="City"
            aria-label="City"
            className={cls}
            autoComplete="off"
          />
        </Field>
        <Field show={label} label="State">
          <Input
            type="text"
            value={value.state}
            onChange={(e) =>
              onChange({
                ...value,
                state: e.target.value.toUpperCase().slice(0, 2),
                formatted_address: "",
                latitude: null,
                longitude: null,
              })
            }
            maxLength={2}
            placeholder="State"
            aria-label="State"
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
      <Label className="block text-xs font-bold text-zinc-500 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
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
  sessionTokenRef: React.MutableRefObject<unknown>,
  locationBias?: { lat: number; lng: number }
): Promise<Prediction[]> {
  const ns = places as PlacesNamespace;
  if (!ns?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    throw new Error("Address suggestions are unavailable");
  }
  if (!sessionTokenRef.current) {
    sessionTokenRef.current = new ns.AutocompleteSessionToken();
  }
  const result = await ns.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken: sessionTokenRef.current,
    includedRegionCodes: ["us"],
    ...(locationBias ? {
      locationBias: { center: locationBias, radius: BIAS_RADIUS_M },
    } : {}),
  });
  return result.suggestions
    .filter((s) => s.placePrediction)
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
}

async function resolvePlace(
  prediction: Prediction
): Promise<Partial<AddressValue>> {
  const place = prediction.raw.toPlace();
  await place.fetchFields({
    fields: ["displayName", "formattedAddress", "addressComponents", "location"],
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
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim() || prediction.mainText;
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
}
