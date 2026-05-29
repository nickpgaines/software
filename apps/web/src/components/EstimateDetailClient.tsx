"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/ui/signature-pad";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CustomerCard from "@/components/jobs/CustomerCard";
import EstimateDocumentPreview from "@/components/EstimateDocumentPreview";
import {
  buildPromotionalSmsConsentText,
  buildTransactionalSmsConsentText,
} from "@/lib/sms-consent";
import {
  DEFAULT_CUSTOMIZATIONS,
  type CustomizationConfig,
} from "@/lib/customizations";

type Estimate = {
  id: number;
  customer_id: number;
  notes: string | null;
  status: string;
  total_cents: number;
  lead_source: string | null;
  sold_by_id: number | null;
  sold_by_name: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  accept_token: string | null;
  terms: string | null;
  signature_data: string | null;
  signature_name: string | null;
  signed_at: string | null;
  sms_consent: number;
  sms_transactional_consent: number;
  created_at: string;
  items: {
    id: number;
    title: string;
    description: string | null;
    quantity: number;
    price_cents: number;
  }[];
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Company = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logo_url: string | null;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(s: string | null | undefined): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  };
  if (!s) return new Date().toLocaleDateString("en-US", opts);
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  if (Number.isNaN(d.getTime()))
    return new Date().toLocaleDateString("en-US", opts);
  return d.toLocaleDateString("en-US", opts);
}

export default function EstimateDetailClient({ id }: { id: number }) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [config, setConfig] = useState<CustomizationConfig>(
    DEFAULT_CUSTOMIZATIONS
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [showApprove, setShowApprove] = useState(false);

  const [termsDraft, setTermsDraft] = useState("");
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsSaved, setTermsSaved] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/estimates/${id}`);
    if (!res.ok) {
      setError("Estimate not found");
      setLoading(false);
      return;
    }
    const est = (await res.json()) as Estimate;
    setEstimate(est);

    const [cRes, coRes, cfgRes] = await Promise.all([
      fetch(`/api/customers/${est.customer_id}`),
      fetch("/api/settings/company"),
      fetch("/api/settings/customizations"),
    ]);
    if (cRes.ok) {
      const j = await cRes.json();
      setCustomer(j.customer as Customer);
    }
    if (coRes.ok) {
      const c = (await coRes.json()) as Partial<Company>;
      setCompany({
        name: c.name?.trim() || "Your Company",
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        website: c.website ?? null,
        logo_url: c.logo_url ?? null,
      });
    }
    let cfg = DEFAULT_CUSTOMIZATIONS;
    if (cfgRes.ok) {
      cfg = (await cfgRes.json()) as CustomizationConfig;
      setConfig(cfg);
    }
    setTermsDraft(est.terms ?? cfg.terms.default_terms ?? "");
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this estimate?")) return;
    const res = await fetch(`/api/estimates/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
  }

  async function saveTerms() {
    if (!estimate) return;
    setSavingTerms(true);
    setTermsSaved(false);
    const res = await fetch(`/api/estimates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: estimate.status, terms: termsDraft }),
    });
    setSavingTerms(false);
    if (res.ok) {
      setEstimate((prev) => (prev ? { ...prev, terms: termsDraft } : prev));
      setTermsSaved(true);
    }
  }

  function scheduleJob() {
    if (!estimate) return;
    router.push(`/schedule/new?customer=${estimate.customer_id}`);
  }

  if (loading) {
    return <div className="text-sm text-zinc-400">Loading…</div>;
  }
  if (error || !estimate) {
    return <div className="text-sm text-rose-400">{error || "Not found"}</div>;
  }

  const isAccepted = estimate.status === "accepted";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-white">
            Estimate #{estimate.id}
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-bold capitalize">
            {estimate.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isAccepted && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowSend(true)}
              className="h-auto inline-flex items-center gap-1.5 border border-line bg-card hover:bg-black text-white rounded-full px-5 py-2.5 text-sm font-bold"
            >
              Send Estimate
            </Button>
          )}
          {isAccepted ? (
            <Button
              type="button"
              variant="ghost"
              onClick={scheduleJob}
              className="h-auto inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-5 py-2.5 text-sm font-bold shadow-sm"
            >
              Schedule Job
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowApprove(true)}
              className="h-auto inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-5 py-2.5 text-sm font-bold shadow-sm"
            >
              Approve &amp; Schedule Job
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="h-auto inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 rounded-full px-3 py-2 text-sm font-bold"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          {customer && (
            <CustomerCard
              customer={customer}
              href={`/customers/${customer.id}`}
            />
          )}

          {isAccepted && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Approval
                </h2>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="text-zinc-300">
                  Accepted
                  {estimate.signature_name
                    ? ` by ${estimate.signature_name}`
                    : ""}
                  {estimate.signed_at || estimate.accepted_at
                    ? ` on ${fmtDate(estimate.signed_at || estimate.accepted_at)}`
                    : ""}
                  .
                </div>
                {estimate.signature_data ? (
                  <div className="rounded-xl border border-line bg-black p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={estimate.signature_data}
                      alt="Customer signature"
                      className="h-20 w-auto"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">
                    Approved without a signature.
                  </div>
                )}
                <div className="text-xs text-zinc-500">
                  SMS transactional consent:{" "}
                  {estimate.sms_transactional_consent ? "Granted" : "Not granted"}
                </div>
                <div className="text-xs text-zinc-500">
                  SMS marketing consent:{" "}
                  {estimate.sms_consent ? "Granted" : "Not granted"}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Terms
              </h2>
              <div className="flex items-center gap-3">
                {termsSaved && !savingTerms && (
                  <span className="text-xs text-emerald-600 font-bold">
                    Saved
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={saveTerms}
                  disabled={savingTerms || termsDraft === (estimate.terms ?? "")}
                  className="h-auto bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground rounded-full px-4 py-1.5 text-xs font-bold"
                >
                  {savingTerms ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <Textarea
              value={termsDraft}
              onChange={(e) => {
                setTermsDraft(e.target.value);
                setTermsSaved(false);
              }}
              className="w-full border-line rounded-xl px-3 py-2 text-sm bg-black min-h-[160px]"
              placeholder="Cancellation policy, liability, payment terms…"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Shown on the estimate document and on the page the customer signs.
              Edit the default for all new estimates in Settings → Customizations
              → Terms.
            </p>
          </Card>

          {(estimate.sold_by_name || estimate.lead_source) && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Lead Source
                </h2>
              </CardHeader>
              <div className="space-y-1 text-sm">
                {estimate.sold_by_name && (
                  <div className="text-zinc-200 font-bold">
                    {estimate.sold_by_name}
                  </div>
                )}
                {estimate.lead_source && (
                  <div className="text-zinc-400 font-bold">
                    {estimate.lead_source}
                  </div>
                )}
              </div>
            </Card>
          )}

          {estimate.notes && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Private Notes
                </h2>
              </CardHeader>
              <div className="text-sm text-zinc-200 whitespace-pre-wrap">
                {estimate.notes}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Preview
              </h2>
            </CardHeader>
            <EstimateDocumentPreview
              estimateNumber={estimate.id}
              dateStr={fmtDate(estimate.created_at)}
              company={company ?? { name: "Your Company", email: null, phone: null, address: null, website: null, logo_url: null }}
              sections={config.estimates}
              customer={{
                name: customer?.name ?? "Customer",
                address:
                  customer?.formatted_address ?? customer?.address ?? null,
                email: customer?.email ?? null,
                phone: customer?.phone ?? null,
              }}
              items={estimate.items}
              totalCents={estimate.total_cents}
              terms={termsDraft}
            />
          </Card>
        </div>
      </div>

      {showSend && customer && (
        <SendEstimateDialog
          estimate={estimate}
          customer={customer}
          onClose={() => setShowSend(false)}
          onSent={async () => {
            setShowSend(false);
            await reload();
          }}
        />
      )}

      {showApprove && customer && (
        <ApproveDialog
          estimateId={estimate.id}
          companyName={company?.name ?? "this business"}
          onClose={() => setShowApprove(false)}
          onApproved={() => {
            setShowApprove(false);
            scheduleJob();
          }}
        />
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-5 shadow-sm">
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      {children}
    </div>
  );
}

function ApproveDialog({
  estimateId,
  companyName,
  onClose,
  onApproved,
}: {
  estimateId: number;
  companyName: string;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [transactionalConsent, setTransactionalConsent] = useState(false);
  const [promoConsent, setPromoConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(opts: { bypass: boolean }) {
    setErr(null);
    if (!opts.bypass) {
      if (!name.trim()) {
        setErr("Type the customer's name to sign.");
        return;
      }
      if (!signature) {
        setErr("Have the customer sign in the box above.");
        return;
      }
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      status: "accepted",
      sms_consent: promoConsent,
      sms_transactional_consent: transactionalConsent,
    };
    if (!opts.bypass) {
      body.signature_data = signature;
      body.signature_name = name.trim();
    }
    const res = await fetch(`/api/estimates/${estimateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not approve the estimate. Please try again.");
      return;
    }
    onApproved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve &amp; Schedule Job</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">
          Hand the device to the customer to sign and approve this estimate.
        </p>

        <div className="mt-4">
          <Label htmlFor="approve-name" className="text-sm font-bold text-white">
            Customer name
          </Label>
          <Input
            id="approve-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="mt-1.5"
          />
        </div>

        <div className="mt-4">
          <Label className="text-sm font-bold text-white">Signature</Label>
          <SignaturePad className="mt-1.5" onChange={setSignature} />
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="approve-consent-transactional"
                checked={transactionalConsent}
                onCheckedChange={(v) => setTransactionalConsent(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="approve-consent-transactional"
                className="cursor-pointer text-xs font-bold leading-relaxed text-zinc-300"
              >
                {buildTransactionalSmsConsentText(companyName)}
              </Label>
            </div>
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="approve-consent-promo"
                checked={promoConsent}
                onCheckedChange={(v) => setPromoConsent(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="approve-consent-promo"
                className="cursor-pointer text-xs font-bold leading-relaxed text-zinc-300"
              >
                {buildPromotionalSmsConsentText(companyName)}
              </Label>
            </div>
          </div>
          <p className="text-xs font-bold text-zinc-500">
            Both checkboxes are optional and independent. The customer can
            leave either or both unchecked — consent is never a condition of
            approval.
          </p>
        </div>

        {err && <p className="mt-4 text-sm font-bold text-rose-400">{err}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit({ bypass: false })}
            disabled={submitting}
            className="h-auto w-full rounded-full bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? "Approving…" : "Approve & Schedule Job"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit({ bypass: true })}
            disabled={submitting}
            className="h-auto w-full rounded-full border border-line bg-card hover:bg-black px-5 py-2.5 text-xs font-bold text-zinc-300 disabled:opacity-50"
          >
            Approve without signature
          </Button>
        </div>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Use &ldquo;without signature&rdquo; only when the customer approved
          remotely (e.g. by text or email).
        </p>
      </DialogContent>
    </Dialog>
  );
}

function SendEstimateDialog({
  estimate,
  customer,
  onClose,
  onSent,
}: {
  estimate: Estimate;
  customer: Customer;
  onClose: () => void;
  onSent: () => void | Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setErr(null);
    const res = await fetch(`/api/estimates/${estimate.id}/send`, {
      method: "POST",
    });
    setSending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not send estimate");
      return;
    }
    await onSent();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Estimate</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">
          We&rsquo;ll text {customer.name} a link to review and sign this
          estimate online.
        </p>
        <div className="rounded-xl border border-line bg-black p-5 max-h-[50vh] overflow-y-auto mt-2">
          <div className="text-sm font-bold text-white">{customer.name}</div>
          {customer.phone && (
            <div className="text-xs text-zinc-400">{customer.phone}</div>
          )}
          {customer.email && (
            <div className="text-xs text-zinc-400">{customer.email}</div>
          )}

          <div className="mt-5 border-t border-line pt-3">
            <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-xs font-bold text-zinc-500 pb-2 border-b border-line">
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div className="text-right">Amount</div>
            </div>
            {estimate.items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-sm py-2 border-b border-line/40"
              >
                <div>
                  <div className="text-white font-bold">{it.title}</div>
                  {it.description && (
                    <div className="text-xs text-zinc-400">{it.description}</div>
                  )}
                </div>
                <div className="text-right text-zinc-200">{it.quantity}</div>
                <div className="text-right text-zinc-200">
                  {formatPrice(it.price_cents)}
                </div>
                <div className="text-right text-white font-bold">
                  {formatPrice(Math.round(it.quantity * it.price_cents))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-zinc-400">Total</div>
              <div className="text-sm font-extrabold text-white">
                {formatPrice(estimate.total_cents)}
              </div>
            </div>
          </div>
        </div>
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-auto border border-line bg-card hover:bg-black text-white rounded-full px-5 py-2 text-sm font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={send}
            disabled={sending}
            className="h-auto bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 text-sm font-bold"
          >
            {sending ? "Sending…" : "Send Estimate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
