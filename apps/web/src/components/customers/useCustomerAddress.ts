"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AddressValue } from "@/components/customers/AddressFields";
import { addressFromSearchParams, resolvePinAddress } from "@/lib/customer-address-prefill";

/** Shared by full customer forms and the job/estimate/invoice/subscription quick creates. */
export function useCustomerAddress(initialAddress?: AddressValue, resolvePin = true) {
  const searchParams = useSearchParams();
  const [seed] = useState(() => initialAddress ?? addressFromSearchParams(searchParams));
  const [address, updateAddress] = useState(seed);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const revision = useRef(0);
  const setAddress = useCallback((next: AddressValue) => {
    revision.current++;
    setPrefillMessage(null);
    updateAddress(next);
  }, []);

  useEffect(() => {
    if (!resolvePin || seed.latitude == null || seed.longitude == null) return;
    let cancelled = false;
    const version = revision.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    setPrefillMessage("Looking up the pin address. You can edit the fields now.");
    resolvePinAddress(seed, process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", controller.signal)
      .then(filled => {
        if (!cancelled && revision.current === version) {
          updateAddress(filled);
          setPrefillMessage(null);
        }
      })
      .catch(() => {
        if (!cancelled && revision.current === version) setPrefillMessage("Could not complete the pin address. Enter the remaining fields manually.");
      })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [resolvePin, seed]);

  const locationBias = seed.latitude != null && seed.longitude != null
    ? { lat: seed.latitude, lng: seed.longitude }
    : undefined;
  return { address, setAddress, prefillMessage, locationBias };
}
