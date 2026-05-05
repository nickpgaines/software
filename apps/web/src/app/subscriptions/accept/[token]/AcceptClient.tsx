"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerSubscription } from "@/lib/db";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateLabel(dateInput: string | null) {
  if (!dateInput) return "today";
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? (() => {
        const [y, m, d] = dateInput.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      })()
    : new Date(dateInput);
  if (isNaN(dt.getTime())) return dateInput;
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AcceptClient({
  subscription,
  customerName,
  serviceAddress,
  companyName,
  visitsPerYear,
  monthlyEquivalentCents,
  intervalLabel,
  servicePeriod,
  billingPeriod,
}: {
  subscription: CustomerSubscription;
  customerName: string;
  serviceAddress: string | null;
  companyName: string;
  visitsPerYear: number;
  monthlyEquivalentCents: number;
  intervalLabel: string;
  servicePeriod: string;
  billingPeriod: string;
}) {
  const router = useRouter();
  const requireSignature = subscription.require_signature === 1;
  const isPending = subscription.status === "pending";

  const [signatureData, setSignatureData] = useState<string | null>(
    subscription.signature_data
  );
  const [signatureName, setSignatureName] = useState(
    subscription.signature_name || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(subscription.status === "active");

  async function accept() {
    if (requireSignature && !signatureData) {
      setError("Please sign before accepting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(
      `/api/subscriptions/accept/${subscription.accept_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_data: signatureData,
          signature_name: signatureName.trim() || null,
        }),
      }
    );
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not accept the subscription.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  const billedMonthly =
    subscription.interval === "monthly" &&
    subscription.service_interval !== "monthly";
  const billingSummary = billedMonthly
    ? `${formatPrice(subscription.price_cents)} per ${servicePeriod}, billed monthly at ~${formatPrice(monthlyEquivalentCents)}/mo`
    : `${formatPrice(subscription.price_cents)} per ${servicePeriod}, billed every ${billingPeriod}`;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
            {companyName}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {subscription.name}
          </h1>
          <p className="text-sm text-zinc-400 font-bold">
            Hi {customerName.split(" ")[0]}, here&apos;s the subscription
            agreement to review and sign.
          </p>
        </header>

        {subscription.description && (
          <section className="rounded-2xl border border-[#1f1f24] bg-[#0f0f12] p-5">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">
              {subscription.description}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-[#1f1f24] bg-[#0f0f12] p-5 space-y-3">
          <h2 className="text-base font-extrabold tracking-tight">
            Plan summary
          </h2>
          <dl className="divide-y divide-[#1f1f24] rounded-xl border border-[#1f1f24] text-sm">
            <SummaryRow
              label="Service"
              value={`${intervalLabel} (${visitsPerYear} visits per year)`}
            />
            <SummaryRow
              label="Duration"
              value={`Starting ${formatDateLabel(
                subscription.start_date
              )} · ongoing until canceled`}
            />
            {serviceAddress && (
              <SummaryRow label="Service address" value={serviceAddress} />
            )}
            <SummaryRow label="Billing" value={billingSummary} />
          </dl>
          <p className="text-xs text-zinc-500">
            Per-visit price:{" "}
            <span className="font-bold text-zinc-300">
              {formatPrice(subscription.price_cents)}
            </span>{" "}
            · this is the value of each visit, regardless of billing cadence.
          </p>
        </section>

        {subscription.terms_snapshot && (
          <section className="rounded-2xl border border-[#1f1f24] bg-[#0f0f12] p-5">
            <h2 className="text-base font-extrabold tracking-tight mb-2">
              Terms
            </h2>
            <div className="text-xs text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-wrap">
              {subscription.terms_snapshot}
            </div>
          </section>
        )}

        {requireSignature && !done && (
          <section className="rounded-2xl border border-[#1f1f24] bg-[#0f0f12] p-5 space-y-3">
            <h2 className="text-base font-extrabold tracking-tight">
              Signature
            </h2>
            <SignaturePad value={signatureData} onChange={setSignatureData} />
            <Label className="block text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
              Printed name
            </Label>
            <Input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder={customerName}
              className="w-full border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12] h-auto"
            />
          </section>
        )}

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <strong className="font-bold tracking-tight">
            Payment setup pending.
          </strong>{" "}
          Card collection will be available shortly. Once you accept, your
          service provider will reach out to finalize payment details.
        </section>

        {error && (
          <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {done ? (
            <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex-1">
              Thanks {customerName.split(" ")[0]} — your subscription is
              active. {companyName} will be in touch.
            </p>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={accept}
              disabled={submitting || !isPending}
              className="flex-1 h-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-full px-5 py-3 text-sm font-bold"
            >
              {submitting
                ? "Accepting…"
                : !isPending
                  ? "Already accepted"
                  : "Accept subscription"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 shrink-0">
        {label}
      </dt>
      <dd className="text-xs text-zinc-300 text-right">{value}</dd>
    </div>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * ratio);
    c.height = Math.round(h * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    const last = lastRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastRef.current = p;
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    const c = canvasRef.current;
    if (!c) return;
    onChange(c.toDataURL("image/png"));
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="border border-[#2a2a32] rounded-xl bg-[#0f0f12]">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="w-full h-32 touch-none cursor-crosshair"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={clear}
        className="text-xs text-zinc-400 hover:text-white hover:bg-transparent h-auto p-0"
      >
        Clear
      </Button>
      {value && (
        <p className="text-[11px] text-zinc-500">
          Signature captured. Tap clear to redo.
        </p>
      )}
    </div>
  );
}
