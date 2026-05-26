"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";

type Item = {
  id: number;
  title: string;
  description: string | null;
  quantity: number;
  price_cents: number;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AcceptClient({
  token,
  companyName,
  terms,
  consentText,
  total,
  items,
}: {
  token: string;
  companyName: string;
  terms: string | null;
  consentText: string;
  total: number;
  items: Item[];
}) {
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    setErr(null);
    if (!name.trim()) {
      setErr("Please type your name to sign.");
      return;
    }
    if (!signature) {
      setErr("Please sign in the box above.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/estimates/accept/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature_data: signature,
        signature_name: name.trim(),
        sms_consent: consent,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not accept the estimate. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mb-2 text-2xl text-emerald-500">✓</div>
        <h1 className="text-page-title text-white">Estimate accepted</h1>
        <p className="mt-3 text-sm font-bold text-zinc-400">
          Thanks, {name.trim()} — {companyName} has been notified.
        </p>
      </div>
    );
  }

  const hasTerms = !!(terms && terms.trim());

  return (
    <div>
      <p className="text-xs font-bold text-zinc-500">
        Estimate from {companyName}
      </p>
      <h1 className="text-page-title text-white mt-1">Review &amp; accept</h1>

      <div className="mt-6 space-y-2 border-t border-line pt-4">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div className="min-w-0">
              <div className="font-bold text-white">{it.title}</div>
              {it.description && (
                <div className="text-xs text-zinc-400">{it.description}</div>
              )}
              <div className="text-xs text-zinc-500">
                {it.quantity} × {money(it.price_cents)}
              </div>
            </div>
            <div className="font-bold text-white tabular-nums">
              {money(Math.round(it.quantity * it.price_cents))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-bold text-zinc-400">Total</span>
          <span className="text-page-title text-white tabular-nums">
            {money(total)}
          </span>
        </div>
      </div>

      {hasTerms && (
        <div className="mt-6">
          <h2 className="text-sm font-extrabold tracking-tight text-white">
            Terms
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
            {terms}
          </p>
        </div>
      )}

      {/* Separate, optional SMS opt-in — affirmative and never a condition of
          acceptance. The signature below accepts the estimate; this box is its
          own choice. */}
      <div className="mt-6 rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="sms-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="sms-consent"
            className="cursor-pointer text-xs font-bold leading-relaxed text-zinc-300"
          >
            {consentText}
          </Label>
        </div>
      </div>

      <div className="mt-6">
        <Label htmlFor="sig-name" className="text-sm font-bold text-white">
          Your name
        </Label>
        <Input
          id="sig-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="mt-1.5"
        />
      </div>

      <div className="mt-4">
        <Label className="text-sm font-bold text-white">Signature</Label>
        <SignaturePad className="mt-1.5" onChange={setSignature} />
        <p className="mt-1 text-xs font-bold text-zinc-500">
          By signing you agree to this estimate
          {hasTerms ? " and the terms above" : ""}.
        </p>
      </div>

      {err && <p className="mt-4 text-sm font-bold text-rose-400">{err}</p>}

      <Button
        type="button"
        variant="ghost"
        onClick={accept}
        disabled={submitting}
        className="mt-5 h-auto w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Accept estimate"}
      </Button>
    </div>
  );
}
