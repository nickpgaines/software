"use client";

import { useState } from "react";

export default function PayClient({
  token,
  cancelled,
}: {
  token: string;
  cancelled: boolean;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/invoices/pay/${token}/checkout-session`,
        { method: "POST" }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || `Could not start payment (HTTP ${res.status})`);
        setWorking(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment");
      setWorking(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {cancelled && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Payment was cancelled. Try again whenever you&apos;re ready.
        </div>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={working}
        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-3 text-sm font-medium"
      >
        {working ? "Opening checkout…" : "Pay with card"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
