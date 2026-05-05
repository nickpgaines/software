"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

const MAX_LEN = 400;

const DEFAULT_MESSAGE =
  "Hey {first_name}, we're running a special this month — would you like us to service your house again?";

const MERGE_TAGS: { token: string; label: string }[] = [
  { token: "{first_name}", label: "First name" },
  { token: "{last_name}", label: "Last name" },
];

export default function MapLassoPanel({
  customers: initialCustomers,
  onClose,
}: {
  customers: LassoCustomer[];
  onClose: () => void;
}) {
  const [customers, setCustomers] = useState<LassoCustomer[]>(initialCustomers);
  const [body, setBody] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state if the parent re-opens with a new selection.
  useEffect(() => {
    setCustomers(initialCustomers);
    setBody(DEFAULT_MESSAGE);
    setError(null);
    setResult(null);
  }, [initialCustomers]);

  const withPhone = useMemo(
    () => customers.filter((c) => !!(c.phone && c.phone.trim())),
    [customers]
  );
  const withoutPhone = customers.length - withPhone.length;
  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));

  function removeCustomer(id: number) {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  function insertTag(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    if (next.length > MAX_LEN) return;
    setBody(next);
    requestAnimationFrame(() => {
      const cursor = start + token.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function send() {
    setError(null);
    if (!body.trim()) {
      setError("Type a message");
      return;
    }
    if (withPhone.length === 0) {
      setError("None of the selected customers have a phone number.");
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
      <div className="absolute top-4 right-16 z-10 w-80 bg-[#0f0f12] border border-[#1f1f24] rounded-lg shadow-md">
        <div className="px-4 py-3 border-b border-[#1f1f24] flex items-center justify-between">
          <h3 className="font-extrabold text-white tracking-tight text-sm">Blast sent</h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
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
        <div className="px-4 py-3 border-t border-[#1f1f24] flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-1.5 font-bold"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-16 z-10 w-80 bg-[#0f0f12] border border-[#1f1f24] rounded-lg shadow-md flex flex-col max-h-[80vh]">
      <div className="px-4 py-3 border-b border-[#1f1f24] flex items-center justify-between">
        <h3 className="font-extrabold text-white tracking-tight text-sm">
          Selected customers
        </h3>
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          aria-label="Close"
          disabled={sending}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 pt-3 pb-2 text-xs text-zinc-400">
        {customers.length} selected
        {", "}
        {withPhone.length} with a mobile phone number
        {withoutPhone > 0 && (
          <span className="text-zinc-500"> · {withoutPhone} without</span>
        )}
      </div>

      <div className="px-4 pb-3">
        <ul className="border border-[#1f1f24] rounded-lg max-h-44 overflow-y-auto divide-y divide-[#1f1f24]">
          {customers.length === 0 ? (
            <li className="px-3 py-6 text-center text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
              No customers selected.
            </li>
          ) : (
            customers.map((c) => {
              const hasPhone = !!(c.phone && c.phone.trim());
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeCustomer(c.id)}
                    disabled={sending}
                    className="h-auto w-auto p-0 text-rose-500 hover:text-rose-700 hover:bg-transparent shrink-0"
                    aria-label={`Remove ${c.name}`}
                    title="Remove from blast"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <span className="flex-1 truncate text-white">
                    {c.name || "Unnamed"}
                  </span>
                  {hasPhone ? (
                    <Phone
                      className="h-3.5 w-3.5 text-zinc-500 shrink-0"
                      aria-label="Has phone"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      no phone
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="px-4 pt-1 pb-2">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
          Message
        </div>
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) =>
            setBody(e.target.value.slice(0, MAX_LEN))
          }
          rows={5}
          maxLength={MAX_LEN}
          placeholder="Hey {first_name}, we're running a special this month — interested?"
          disabled={sending}
          className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm bg-[#0f0f12] resize-y"
        />
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {MERGE_TAGS.map((t) => (
            <Button
              key={t.token}
              type="button"
              variant="ghost"
              onClick={() => insertTag(t.token)}
              disabled={sending}
              className="h-auto text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-full px-2.5 py-1 font-bold"
              title={`Insert ${t.token}`}
            >
              {t.label} +
            </Button>
          ))}
          <span className="ml-auto text-[11px] text-zinc-500">
            {charCount}/{MAX_LEN} · {segments} SMS
          </span>
        </div>

        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      </div>

      <div className="px-4 py-3 border-t border-[#1f1f24] flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={sending}
          className="h-auto text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          onClick={send}
          disabled={sending || withPhone.length === 0 || !body.trim()}
          className="h-auto gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-4 py-1.5 font-bold"
        >
          <Send className="h-3.5 w-3.5" />
          {sending
            ? "Sending…"
            : `Send to ${withPhone.length} ${
                withPhone.length === 1 ? "person" : "people"
              }`}
        </Button>
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
      : "text-zinc-400";
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={"font-semibold " + cls}>{value}</span>
    </div>
  );
}
