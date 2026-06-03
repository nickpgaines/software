"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// One Stripe Subscription row returned by GET /api/customer-subscriptions/import.
// Mirrors the API shape — keep in sync if the endpoint changes.
type StripeSubRow = {
  stripe_subscription_id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  amount_cents: number;
  currency: string;
  interval:
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "triannually"
    | "semiannually"
    | "yearly"
    | null;
  interval_raw: string | null;
  name: string;
  stripe_customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  matched_forge_customer_id: number | null;
  matched_by: "email" | "phone" | "name" | null;
  already_imported: boolean;
};

type ForgeCustomer = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type ListResponse = {
  stripe_subscriptions: StripeSubRow[];
  forge_customers: ForgeCustomer[];
};

type LinkResult =
  | { ok: true; stripe_subscription_id: string; row_id: number }
  | { ok: false; stripe_subscription_id: string; error: string };

type CommitResponse = {
  batch: string;
  imported: number;
  failed: number;
  results: LinkResult[];
};

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function intervalLabel(i: StripeSubRow["interval"]): string {
  switch (i) {
    case "weekly":
      return "weekly";
    case "biweekly":
      return "every 2 weeks";
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "triannually":
      return "every 4 months";
    case "semiannually":
      return "every 6 months";
    case "yearly":
      return "yearly";
    case null:
      return "unsupported";
  }
}

export default function SubscriptionImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse | null>(null);
  // subId → forgeCustomerId (or 0 for "skip this row")
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommitResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/customer-subscriptions/import", {
          method: "GET",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Could not load Stripe subscriptions");
        }
        const json = (await res.json()) as ListResponse;
        if (cancelled) return;
        setData(json);
        const initialPicks: Record<string, number> = {};
        for (const s of json.stripe_subscriptions) {
          initialPicks[s.stripe_subscription_id] =
            s.matched_forge_customer_id ?? 0;
        }
        setPicks(initialPicks);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.stripe_subscriptions;
    return data.stripe_subscriptions.filter((s) =>
      [s.customer_name, s.customer_email, s.name, s.stripe_subscription_id]
        .filter(Boolean)
        .some((v) => v!.toString().toLowerCase().includes(q))
    );
  }, [data, filter]);

  const importable = useMemo(
    () =>
      filtered.filter(
        (s) =>
          !s.already_imported &&
          s.interval !== null &&
          s.amount_cents > 0 &&
          (picks[s.stripe_subscription_id] ?? 0) > 0
      ),
    [filtered, picks]
  );

  async function commit() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const links = importable.map((s) => ({
        stripe_subscription_id: s.stripe_subscription_id,
        customer_id: picks[s.stripe_subscription_id]!,
      }));
      const res = await fetch("/api/customer-subscriptions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || "Import failed");
        return;
      }
      const json = (await res.json()) as CommitResponse;
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div>
            <h3 className="font-bold">Import subscriptions from Stripe</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Link each existing Stripe Subscription to the Forge customer
              that owns it. Stripe keeps charging on its schedule — Forge just
              starts tracking the relationship.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent text-xl leading-none"
            aria-label="Close"
          >
            ×
          </Button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading && (
            <p className="text-sm text-zinc-400">
              Loading subscriptions from Stripe…
            </p>
          )}

          {error && !result && (
            <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-3 text-sm text-red-300 font-bold">
              {error}
            </div>
          )}

          {result && (
            <ResultView result={result} />
          )}

          {!loading && !result && data && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Input
                  placeholder="Filter by name, email, or Stripe ID"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-xs"
                />
                <div className="text-xs text-zinc-500 font-bold">
                  {data.stripe_subscriptions.length} Stripe subs •{" "}
                  <span className="text-emerald-400">
                    {importable.length} ready to link
                  </span>
                </div>
              </div>

              {data.stripe_subscriptions.length === 0 && (
                <p className="text-sm text-zinc-400">
                  No Stripe Subscriptions found on this connected account.
                </p>
              )}

              {data.stripe_subscriptions.length > 0 && (
                <div className="border border-line rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-line">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                          Stripe customer
                        </TableHead>
                        <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                          Plan
                        </TableHead>
                        <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                          Card
                        </TableHead>
                        <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                          Link to Forge customer
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-line">
                      {filtered.map((s) => {
                        const disabled =
                          s.already_imported ||
                          s.interval === null ||
                          s.amount_cents <= 0;
                        return (
                          <TableRow
                            key={s.stripe_subscription_id}
                            className="border-0 hover:bg-transparent align-top"
                          >
                            <TableCell className="px-3 py-2">
                              <div className="text-white font-bold">
                                {s.customer_name || (
                                  <span className="italic text-zinc-500">
                                    no name
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {s.customer_email || s.customer_phone || ""}
                              </div>
                              <div className="text-[10px] text-zinc-600 mt-0.5">
                                {s.stripe_subscription_id}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="text-zinc-200">{s.name}</div>
                              <div className="text-[11px] text-zinc-500">
                                {fmt(s.amount_cents)} {intervalLabel(s.interval)}{" "}
                                <span className="text-zinc-600">
                                  · {s.status}
                                </span>
                              </div>
                              {s.interval === null && (
                                <div className="text-[11px] text-amber-400 font-bold mt-0.5">
                                  unsupported interval ({s.interval_raw})
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-zinc-400 tabular-nums">
                              {s.payment_method_brand &&
                              s.payment_method_last4 ? (
                                <>
                                  {s.payment_method_brand} ••
                                  {s.payment_method_last4}
                                </>
                              ) : (
                                <span className="italic text-zinc-600">—</span>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              {s.already_imported ? (
                                <span className="text-[11px] text-zinc-500 font-bold">
                                  already linked
                                </span>
                              ) : (
                                <CustomerPicker
                                  customers={data.forge_customers}
                                  value={picks[s.stripe_subscription_id] ?? 0}
                                  onChange={(id) =>
                                    setPicks((p) => ({
                                      ...p,
                                      [s.stripe_subscription_id]: id,
                                    }))
                                  }
                                  disabled={disabled}
                                  matchedBy={s.matched_by}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2 shrink-0">
          {result ? (
            <>
              <span />
              <Button
                type="button"
                onClick={() => {
                  onImported();
                  onClose();
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={commit}
                disabled={busy || loading || importable.length === 0}
              >
                {busy
                  ? "Importing…"
                  : `Import ${importable.length} ${importable.length === 1 ? "subscription" : "subscriptions"}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerPicker({
  customers,
  value,
  onChange,
  disabled,
  matchedBy,
}: {
  customers: ForgeCustomer[];
  value: number;
  onChange: (id: number) => void;
  disabled: boolean;
  matchedBy: StripeSubRow["matched_by"];
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Native <select> kept: matches the rest of Forge — empty-string "skip" sentinel forbidden by Radix Select. */}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="border border-line-strong rounded px-2 py-1 text-sm bg-card disabled:opacity-40 max-w-[260px]"
      >
        <option value={0}>— skip / don&rsquo;t link —</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || c.email || c.phone || `Customer #${c.id}`}
          </option>
        ))}
      </select>
      {value > 0 && matchedBy && (
        <span className="text-[10px] text-emerald-400 font-bold">
          auto-matched by {matchedBy}
        </span>
      )}
    </div>
  );
}

function ResultView({ result }: { result: CommitResponse }) {
  return (
    <div className="space-y-3">
      <div className="bg-black border border-line rounded-lg p-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Imported" value={result.imported} accent="text-emerald-400" />
        <Stat label="Failed" value={result.failed} accent="text-red-400" />
        <Stat
          label="Total"
          value={result.imported + result.failed}
          accent="text-zinc-400"
        />
      </div>
      {result.failed > 0 && (
        <div className="border border-line rounded-lg overflow-hidden max-h-[42vh] overflow-y-auto">
          <Table>
            <TableHeader className="bg-black sticky top-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                  Stripe sub
                </TableHead>
                <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                  Result
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-line">
              {result.results.map((r, i) => (
                <TableRow
                  key={`${r.stripe_subscription_id}-${i}`}
                  className="border-0 hover:bg-transparent align-top"
                >
                  <TableCell className="px-3 py-2 text-zinc-300 tabular-nums">
                    {r.stripe_subscription_id}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {r.ok ? (
                      <span className="text-emerald-400 font-bold">
                        imported (row #{r.row_id})
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold">{r.error}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-zinc-500 font-bold mt-1">{label}</div>
    </div>
  );
}
