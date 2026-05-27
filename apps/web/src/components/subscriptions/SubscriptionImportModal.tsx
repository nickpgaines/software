"use client";

import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
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

// Columns we map a subscriptions export onto. customer_name + plan_name +
// amount + interval are what actually matter; the rest enrich matching.
const FIELDS = [
  "customer_name",
  "plan_name",
  "amount",
  "interval",
  "status",
  "start_date",
  "address",
  "sold_by",
] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  customer_name: "Customer name",
  plan_name: "Plan name",
  amount: "Amount",
  interval: "Frequency",
  status: "Status",
  start_date: "Start date",
  address: "Address",
  sold_by: "Sold by",
};

type Step = "upload" | "mapping" | "reconcile" | "result";

type Mapping = Record<string, Field | "">;

type ReportRow = {
  row: number;
  customer_name: string;
  plan_name: string;
  amount_cents: number;
  interval: string;
  status: string;
  billing_status: string;
  needs_card: boolean;
  customer_id: number | null;
  customer_will_be_created: boolean;
  stripe_customer_id: string | null;
  payment_method_id: string | null;
  card: { brand: string | null; last4: string | null } | null;
  next_charge_at: string | null;
  confidence: "auto" | "review" | "none";
  issues: string[];
  skipped?: string;
  created_subscription_id?: number;
};

type ApiResponse = {
  mode: "reconcile" | "commit";
  batch_id: string | null;
  stripe_ready: boolean;
  summary: {
    total: number;
    auto: number;
    review: number;
    none: number;
    created: number;
    skipped: number;
  };
  rows: ReportRow[];
};

function suggestField(header: string): Field | null {
  const h = header.trim().toLowerCase();
  if (/customer|client|account holder/.test(h)) return "customer_name";
  if (/plan|membership|service|product|^name$|item/.test(h)) return "plan_name";
  if (/amount|price|total|cost|charge/.test(h)) return "amount";
  if (/frequency|interval|billing cycle|cycle|cadence|recurr/.test(h))
    return "interval";
  if (/status|state/.test(h)) return "status";
  if (/start|begin|signed|created|since/.test(h)) return "start_date";
  if (/address|street|location/.test(h)) return "address";
  if (/sold|rep\b|salesperson|sales rep|seller|closer/.test(h)) return "sold_by";
  return null;
}

function dollarsToCents(raw: string): number {
  const n = parseFloat((raw || "").replace(/[^0-9.]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Build the row payload sent to the reconcile/commit API.
function buildRows(
  csvRows: Record<string, string>[],
  mapping: Mapping,
  emailByName: Map<string, { email: string; phone: string }>
) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return csvRows.map((row) => {
    const pick = (field: Field): string => {
      for (const [header, f] of Object.entries(mapping)) {
        if (f === field) {
          const v = (row[header] ?? "").toString().trim();
          if (v) return v;
        }
      }
      return "";
    };
    const customerName = pick("customer_name");
    const enrich = emailByName.get(norm(customerName));
    return {
      customer_name: customerName,
      address: pick("address"),
      plan_name: pick("plan_name"),
      amount_cents: dollarsToCents(pick("amount")),
      interval: pick("interval"),
      status: pick("status"),
      start_date: pick("start_date"),
      sold_by: pick("sold_by"),
      email: enrich?.email || "",
      phone: enrich?.phone || "",
    };
  });
}

const CONFIDENCE_STYLE: Record<ReportRow["confidence"], string> = {
  auto: "text-emerald-400",
  review: "text-amber-400",
  none: "text-zinc-500",
};

export default function SubscriptionImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [emailByName, setEmailByName] = useState<
    Map<string, { email: string; phone: string }>
  >(new Map());
  const [customersFileName, setCustomersFileName] = useState<string | null>(null);
  const [report, setReport] = useState<ApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subFileRef = useRef<HTMLInputElement>(null);
  const custFileRef = useRef<HTMLInputElement>(null);

  function handleSubFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError("Please pick a .csv file");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const fields = (res.meta.fields || []).filter((f) => f && f.trim());
        if (fields.length === 0) {
          setError("CSV has no header row");
          return;
        }
        const data = res.data.filter((r) =>
          Object.values(r).some((v) => typeof v === "string" && v.trim())
        );
        setHeaders(fields);
        setCsvRows(data);
        const initial: Mapping = {};
        const used = new Set<Field>();
        for (const h of fields) {
          const f = suggestField(h);
          if (f && !used.has(f)) {
            initial[h] = f;
            used.add(f);
          } else {
            initial[h] = "";
          }
        }
        setMapping(initial);
        setStep("mapping");
      },
      error: (err) => setError(err.message || "Could not parse CSV"),
    });
  }

  // Optional: a customers export supplies emails/phones (often missing from a
  // subscriptions export) which sharpen Stripe matching. Joined by name.
  function handleCustomersFile(file: File | null) {
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const fields = res.meta.fields || [];
        const find = (re: RegExp) =>
          fields.find((f) => re.test(f.trim().toLowerCase()));
        const firstH = find(/^(first.?name|fname|given)/);
        const lastH = find(/^(last.?name|lname|surname)/);
        const nameH = find(/^(full.?name|name|customer)/);
        const emailH = find(/email/);
        const phoneH = find(/phone|mobile|cell|tel/);
        const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
        const map = new Map<string, { email: string; phone: string }>();
        for (const r of res.data) {
          const name =
            firstH || lastH
              ? `${(r[firstH || ""] ?? "").trim()} ${(r[lastH || ""] ?? "").trim()}`.trim()
              : (r[nameH || ""] ?? "").trim();
          if (!name) continue;
          map.set(norm(name), {
            email: (r[emailH || ""] ?? "").trim(),
            phone: (r[phoneH || ""] ?? "").trim(),
          });
        }
        setEmailByName(map);
        setCustomersFileName(file.name);
      },
    });
  }

  const customerNameMapped = useMemo(
    () => Object.values(mapping).includes("customer_name"),
    [mapping]
  );
  const planMapped = useMemo(
    () => Object.values(mapping).includes("plan_name"),
    [mapping]
  );

  async function run(mode: "reconcile" | "commit") {
    setBusy(true);
    setError(null);
    try {
      const rows = buildRows(csvRows, mapping, emailByName);
      const res = await fetch("/api/customer-subscriptions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, rows }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || `${mode === "commit" ? "Import" : "Reconcile"} failed`);
        return;
      }
      const data = (await res.json()) as ApiResponse;
      setReport(data);
      setStep(mode === "commit" ? "result" : "reconcile");
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
            <h3 className="font-bold">Import subscriptions</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              <Stepper step={step} />
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
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400 font-bold">
                Upload your subscriptions export (CSV). Optionally add a customers
                export too — it supplies emails/phones that help us find each
                saved card in Stripe.
              </p>
              <div
                onClick={() => subFileRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-line bg-black/40 hover:bg-black py-10 text-center cursor-pointer transition"
              >
                <div className="text-3xl text-zinc-500">⤴</div>
                <p className="mt-2 text-xs font-bold text-zinc-500">
                  Click to choose your subscriptions .csv (required)
                </p>
              </div>
              <Input
                ref={subFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleSubFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => custFileRef.current?.click()}
                  className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold"
                >
                  {customersFileName
                    ? `Customers file: ${customersFileName}`
                    : "Add customers CSV (optional)"}
                </Button>
                {customersFileName && (
                  <span className="text-xs text-emerald-400 font-bold">
                    {emailByName.size} contacts loaded
                  </span>
                )}
              </div>
              <Input
                ref={custFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleCustomersFile(e.target.files?.[0] ?? null)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {step === "mapping" && (
            <MappingStep
              headers={headers}
              csvRows={csvRows}
              mapping={mapping}
              setMapping={setMapping}
            />
          )}

          {step === "reconcile" && report && (
            <ReportView report={report} committed={false} />
          )}

          {step === "result" && report && (
            <ReportView report={report} committed={true} />
          )}
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2 shrink-0">
          {step === "upload" && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold"
              >
                Cancel
              </Button>
              <span />
            </>
          )}

          {step === "mapping" && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("upload")}
                className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => run("reconcile")}
                disabled={!customerNameMapped || !planMapped || busy}
                className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded px-3 py-2 font-bold"
              >
                {busy ? "Matching…" : "Match against Stripe"}
              </Button>
            </>
          )}

          {step === "reconcile" && report && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("mapping")}
                className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => run("commit")}
                disabled={busy || report.summary.auto === 0}
                className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded px-3 py-2 font-bold"
              >
                {busy
                  ? "Importing…"
                  : `Import ${report.summary.auto} ready ${report.summary.auto === 1 ? "subscription" : "subscriptions"}`}
              </Button>
            </>
          )}

          {step === "result" && (
            <>
              <span />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onImported();
                  onClose();
                }}
                className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded px-3 py-2 font-bold"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Map columns" },
    { key: "reconcile", label: "Review matches" },
    { key: "result", label: "Done" },
  ];
  const activeIdx = labels.findIndex((l) => l.key === step);
  return (
    <span>
      {labels.map((l, i) => (
        <span key={l.key}>
          <span className={i === activeIdx ? "text-zinc-300 font-bold" : ""}>
            {l.label}
          </span>
          {i < labels.length - 1 && <span className="mx-1.5">›</span>}
        </span>
      ))}
    </span>
  );
}

function MappingStep({
  headers,
  csvRows,
  mapping,
  setMapping,
}: {
  headers: string[];
  csvRows: Record<string, string>[];
  mapping: Mapping;
  setMapping: (m: Mapping) => void;
}) {
  const firstSample = csvRows[0] ?? {};
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 font-bold">
        Match each CSV column to a Forge field. <strong>Customer name</strong> and{" "}
        <strong>Plan name</strong> are required.
      </p>
      <div className="border border-line rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-line">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                CSV column
              </TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                Sample
              </TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                Forge field
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-line">
            {headers.map((h) => (
              <TableRow key={h} className="border-0 hover:bg-transparent">
                <TableCell className="px-3 py-2 font-bold text-white tracking-tight">
                  {h}
                </TableCell>
                <TableCell className="px-3 py-2 text-zinc-400 truncate max-w-[220px]">
                  {(firstSample[h] ?? "").toString() || (
                    <span className="italic text-zinc-500">empty</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2">
                  {/* Native <select> kept: matches the customer importer; empty-string "ignore" sentinel forbidden by Radix Select. */}
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [h]: e.target.value as Field | "" })
                    }
                    className="border border-line-strong rounded px-2 py-1 text-sm"
                  >
                    <option value="">— ignore —</option>
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReportView({
  report,
  committed,
}: {
  report: ApiResponse;
  committed: boolean;
}) {
  const s = report.summary;
  return (
    <div className="space-y-4">
      {!report.stripe_ready && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-sm text-amber-300 font-bold">
          Stripe isn&rsquo;t connected yet, so saved cards can&rsquo;t be matched.
          Connect your Stripe account in Settings → Payments, then re-run — active
          subscriptions need a card to auto-bill.
        </div>
      )}
      <div className="bg-black border border-line rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Stat label={committed ? "Imported" : "Ready to import"} value={committed ? s.created : s.auto} accent="text-emerald-400" />
        <Stat label="Needs review" value={s.review} accent="text-amber-400" />
        <Stat label="No match / card" value={s.none} accent="text-zinc-400" />
        <Stat label={committed ? "Skipped" : "Total rows"} value={committed ? s.skipped : s.total} accent="text-zinc-400" />
      </div>

      <div className="border border-line rounded-lg overflow-hidden max-h-[42vh] overflow-y-auto">
        <Table>
          <TableHeader className="bg-black sticky top-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Customer</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Plan</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Amount</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Status</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Card</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                {committed ? "Result" : "Match"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-line">
            {report.rows.map((r) => (
              <TableRow key={r.row} className="border-0 hover:bg-transparent align-top">
                <TableCell className="px-3 py-2 text-white font-bold">
                  {r.customer_name || <span className="italic text-zinc-500">—</span>}
                  {r.customer_will_be_created && (
                    <span className="ml-1 text-[10px] text-sky-400 font-bold">NEW</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-zinc-300">
                  {r.plan_name}
                  <span className="block text-[11px] text-zinc-500">{r.interval}</span>
                </TableCell>
                <TableCell className="px-3 py-2 text-zinc-300 tabular-nums">
                  {fmt(r.amount_cents)}
                </TableCell>
                <TableCell className="px-3 py-2 text-zinc-400">
                  {r.status}
                  {r.billing_status === "past_due" && (
                    <span className="block text-[11px] text-amber-400 font-bold">past due</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-zinc-400">
                  {r.card ? (
                    <span className="tabular-nums">
                      {r.card.brand} ••{r.card.last4}
                    </span>
                  ) : r.needs_card ? (
                    <span className="italic text-zinc-600">none</span>
                  ) : (
                    <span className="text-zinc-600">n/a</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2">
                  {committed ? (
                    r.created_subscription_id ? (
                      <span className="text-emerald-400 font-bold">imported</span>
                    ) : (
                      <span className="text-zinc-500">{r.skipped || "skipped"}</span>
                    )
                  ) : (
                    <span className={`font-bold ${CONFIDENCE_STYLE[r.confidence]}`}>
                      {r.confidence}
                    </span>
                  )}
                  {r.issues.length > 0 && (
                    <span className="block text-[11px] text-zinc-500">
                      {r.issues.join("; ")}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!committed && (
        <p className="text-xs text-zinc-500 font-bold">
          Only the {report.summary.auto} <span className="text-emerald-400">ready</span> rows import now.
          Review and no-match rows are skipped — handle those by hand or fix the data and re-run.
        </p>
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
