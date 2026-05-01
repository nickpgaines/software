"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";

export type LassoCustomer = {
  id: number;
  name: string;
  phone: string | null;
  has_active_subscription: number;
};

type SendResult = {
  total: number;
  sent: number;
  failed: number;
  no_phone: number;
};

export default function MapLassoPanel({
  customers,
  onClose,
}: {
  customers: LassoCustomer[];
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const withPhone = customers.filter((c) => !!(c.phone && c.phone.trim()));
  const withoutPhone = customers.length - withPhone.length;
  const subCount = customers.filter((c) => c.has_active_subscription).length;
  const stdCount = customers.length - subCount;
  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));

  async function send() {
    setError(null);
    if (!body.trim()) {
      setError("Type a message");
      return;
    }
    if (customers.length === 0) {
      setError("No customers selected");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages/blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_ids: customers.map((c) => c.id),
          body: body.trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = "";
        try {
          message = (JSON.parse(text) as { error?: string }).error || "";
        } catch {
          message = text.slice(0, 200);
        }
        setError(message || `Could not send (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as SendResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="absolute top-4 right-16 z-10 w-80 bg-white border border-slate-200 rounded-lg shadow-md">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm">Blast sent</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-2 text-sm">
          <Stat label="Sent" value={result.sent} tone="ok" />
          {result.no_phone > 0 && (
            <Stat
              label="Skipped (no phone)"
              value={result.no_phone}
              tone="muted"
            />
          )}
          {result.failed > 0 && (
            <Stat label="Failed" value={result.failed} tone="bad" />
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-1.5 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-16 z-10 w-80 bg-white border border-slate-200 rounded-lg shadow-md flex flex-col max-h-[80vh]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 text-sm">
          Text blast
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700"
          aria-label="Close"
          disabled={sending}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="text-sm text-slate-700">
          <div className="font-medium">
            {customers.length} customer{customers.length === 1 ? "" : "s"} selected
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stdCount} standard · {subCount} subscription
            {withoutPhone > 0 ? ` · ${withoutPhone} without phone` : ""}
          </div>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Type your message…"
          disabled={sending}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white resize-y"
        />
        <div className="text-xs text-slate-400 flex justify-between">
          <span>
            {charCount} char{charCount === 1 ? "" : "s"}
          </span>
          <span>
            {segments} SMS segment{segments === 1 ? "" : "s"} per recipient
          </span>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
      <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={sending}
          className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={sending || customers.length === 0 || !body.trim()}
          className="inline-flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-4 py-1.5 font-medium"
        >
          <Send className="h-3.5 w-3.5" />
          {sending
            ? "Sending…"
            : `Send to ${withPhone.length} ${
                withPhone.length === 1 ? "person" : "people"
              }`}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "bad" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "bad"
      ? "text-rose-700"
      : "text-slate-500";
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={"font-semibold " + cls}>{value}</span>
    </div>
  );
}
