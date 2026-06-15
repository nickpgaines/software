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

const FIELDS = [
  "customer_name",
  "plan_name",
  "amount",
  "interval",
  "start_date",
  "status",
  "sold_by",
] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  customer_name: "Customer",
  plan_name: "Plan name",
  amount: "Amount ($)",
  interval: "Frequency",
  start_date: "Start date",
  status: "Status (source CRM)",
  sold_by: "Sold by",
};

type SubscriptionInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "triannually"
  | "semiannually"
  | "yearly";

type Mapping = Record<string, Field | "">;
type Step = "upload" | "mapping" | "preview" | "importing" | "result";

type Result = {
  batch: string;
  inserted: number;
  skipped: number;
  skippedReasons: { row: number; reason: string }[];
  errors: { row: number; reason: string }[];
};

function suggestField(header: string): Field | null {
  const h = header.trim().toLowerCase();
  if (/^(customer|client|account)$/i.test(h)) return "customer_name";
  if (/^(name|plan|membership|service|product)$/i.test(h)) return "plan_name";
  if (/^(amount|total|price)$/i.test(h)) return "amount";
  if (/frequency|interval|cadence|recurr/i.test(h)) return "interval";
  if (/start.?date|begin|since/i.test(h)) return "start_date";
  if (/status|state/i.test(h)) return "status";
  if (/sold.?by|rep\b|salesperson|seller/i.test(h)) return "sold_by";
  return null;
}

function dollarsToCents(raw: string): number {
  const n = parseFloat((raw || "").replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

// Map Homebase360's frequency labels (and variants from other CRMs) onto
// Forge's SubscriptionInterval enum. Anything we can't recognize returns
// null and the server records that as a skipped row.
function mapInterval(raw: string): SubscriptionInterval | null {
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  if (s === "weekly" || s === "every week" || s === "1 week") return "weekly";
  if (
    s.includes("2 week") ||
    s.includes("two week") ||
    s.includes("biweek") ||
    s.includes("bi-week")
  )
    return "biweekly";
  if (
    s === "monthly" ||
    s === "every month" ||
    s === "1 month" ||
    s === "month"
  )
    return "monthly";
  if (
    s === "quarterly" ||
    s === "every quarter" ||
    s === "3 month" ||
    s === "3 months" ||
    s === "quarter"
  )
    return "quarterly";
  if (
    s === "4 month" ||
    s === "4 months" ||
    s.includes("triannual") ||
    s.includes("tri-annual")
  )
    return "triannually";
  if (
    s === "6 month" ||
    s === "6 months" ||
    s.includes("semiannual") ||
    s.includes("semi-annual") ||
    s.includes("biannual") ||
    s.includes("bi-annual") ||
    s.includes("bi-yearly")
  )
    return "semiannually";
  if (s === "yearly" || s === "annual" || s === "annually" || s === "year")
    return "yearly";
  return null;
}

function parseDateLoose(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

type ApiRow = {
  customer_name: string;
  plan_name: string;
  amount_cents: number;
  interval: SubscriptionInterval | null;
  start_date: string | null;
  status: string;
  sold_by: string;
};

function buildMapped(
  rows: Record<string, string>[],
  mapping: Mapping
): ApiRow[] {
  return rows.map((row) => {
    const get = (f: Field): string => {
      for (const [header, mapped] of Object.entries(mapping)) {
        if (mapped === f) {
          const v = (row[header] ?? "").toString().trim();
          if (v) return v;
        }
      }
      return "";
    };
    return {
      customer_name: get("customer_name"),
      plan_name: get("plan_name"),
      amount_cents: dollarsToCents(get("amount")),
      interval: mapInterval(get("interval")),
      start_date: parseDateLoose(get("start_date")),
      status: get("status"),
      sold_by: get("sold_by"),
    };
  });
}

export default function SubscriptionCsvImportModal({
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
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    batch: number;
    totalBatches: number;
    rowsDone: number;
    rowsTotal: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
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

  const customerMapped = useMemo(
    () => Object.values(mapping).includes("customer_name"),
    [mapping]
  );
  const intervalMapped = useMemo(
    () => Object.values(mapping).includes("interval"),
    [mapping]
  );
  const amountMapped = useMemo(
    () => Object.values(mapping).includes("amount"),
    [mapping]
  );

  const previewRows = useMemo(
    () => buildMapped(csvRows.slice(0, 5), mapping),
    [csvRows, mapping]
  );

  async function doImport() {
    setStep("importing");
    setError(null);
    const rows = buildMapped(csvRows, mapping);
    const CHUNK = 100;
    const total: Result = {
      batch: "",
      inserted: 0,
      skipped: 0,
      skippedReasons: [],
      errors: [],
    };
    let batchIndex = 0;
    for (let offset = 0; offset < rows.length; offset += CHUNK) {
      batchIndex++;
      const slice = rows.slice(offset, offset + CHUNK);
      setImportProgress({
        batch: batchIndex,
        totalBatches: Math.ceil(rows.length / CHUNK),
        rowsDone: offset,
        rowsTotal: rows.length,
      });
      const res = await fetch("/api/customer-subscriptions/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: slice }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(
          (j.error || j.message
            ? `${j.error || "Import failed"}${j.message ? `: ${j.message}` : ""}`
            : "Import failed") +
            ` (failed on rows ${offset + 1}–${offset + slice.length} of ${rows.length}; ${total.inserted} subscriptions imported before this)`
        );
        setStep("preview");
        setImportProgress(null);
        return;
      }
      const data = (await res.json()) as Result;
      total.batch = data.batch;
      total.inserted += data.inserted;
      total.skipped += data.skipped;
      for (const e of data.errors) {
        total.errors.push({ row: offset + e.row, reason: e.reason });
      }
      for (const s of data.skippedReasons) {
        total.skippedReasons.push({ row: offset + s.row, reason: s.reason });
      }
    }
    setImportProgress(null);
    setResult(total);
    setStep("result");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div>
            <h3 className="font-bold">Import subscriptions from CSV</h3>
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
                Upload your subscriptions export as a CSV. Each row becomes a
                pending Forge subscription with the next visit on the
                calendar — collect the card at that visit via the accept
                link.
              </p>
              <p className="text-xs text-zinc-500">
                Customers are matched by name. Run the customer import first
                so every plan has somewhere to land. Source-status of
                &ldquo;canceled&rdquo; is skipped automatically.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-line bg-black/40 hover:bg-black py-10 text-center cursor-pointer transition"
              >
                <div className="text-3xl text-zinc-500">⤴</div>
                <p className="mt-2 text-xs font-bold text-zinc-500">
                  Click to choose your subscriptions .csv
                </p>
              </div>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400 font-bold">
                Match each CSV column to a Forge field.{" "}
                <strong>Customer</strong>, <strong>Frequency</strong>, and{" "}
                <strong>Amount</strong> are required.
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
                      <TableRow
                        key={h}
                        className="border-0 hover:bg-transparent"
                      >
                        <TableCell className="px-3 py-2 font-bold text-white tracking-tight">
                          {h}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-400 truncate max-w-[220px]">
                          {(csvRows[0]?.[h] ?? "").toString() || (
                            <span className="italic text-zinc-500">empty</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {/* Native <select> kept: empty-string "ignore" sentinel forbidden by Radix. */}
                          <select
                            value={mapping[h] ?? ""}
                            onChange={(e) =>
                              setMapping({
                                ...mapping,
                                [h]: e.target.value as Field | "",
                              })
                            }
                            className="border border-line-strong rounded px-2 py-1 text-sm bg-card"
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
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400 font-bold">
                Preview of the first {previewRows.length} of {csvRows.length}{" "}
                rows. Click <strong>Import</strong> to commit. Each becomes a
                pending Forge subscription; cards get collected at the next
                visit via the accept link.
              </p>
              <div className="border border-line rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-black">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Customer
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Plan
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Amount
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Frequency
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Start
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-line">
                    {previewRows.map((r, i) => (
                      <TableRow
                        key={i}
                        className="border-0 hover:bg-transparent"
                      >
                        <TableCell className="px-3 py-2 text-white font-bold">
                          {r.customer_name || (
                            <span className="italic text-zinc-500">
                              (missing)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-300">
                          {r.plan_name}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-300 tabular-nums">
                          ${(r.amount_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-400">
                          {r.interval || (
                            <span className="italic text-rose-400">
                              unmapped
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-400">
                          {r.start_date
                            ? new Date(r.start_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="text-sm text-zinc-400 space-y-1">
              <p>
                Importing
                {importProgress
                  ? ` batch ${importProgress.batch} of ${importProgress.totalBatches}…`
                  : "…"}
              </p>
              {importProgress && (
                <p className="text-xs text-zinc-500">
                  {importProgress.rowsDone.toLocaleString()} of{" "}
                  {importProgress.rowsTotal.toLocaleString()} rows processed
                </p>
              )}
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-3">
              <div className="bg-black border border-line rounded-lg p-4 grid grid-cols-3 gap-3 text-center">
                <Stat
                  label="Subscriptions imported"
                  value={result.inserted}
                  accent="text-emerald-400"
                />
                <Stat
                  label="Skipped"
                  value={result.skipped}
                  accent="text-amber-400"
                />
                <Stat
                  label="Errors"
                  value={result.errors.length}
                  accent="text-rose-400"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Each imported plan is <strong>pending</strong> until a card is
                saved via the accept link. Send the link from the customer
                detail page (or have the tech open it during the next visit).
              </p>
              {(result.skipped > 0 || result.errors.length > 0) && (
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => setShowSkipped(!showSkipped)}
                    className="text-xs text-zinc-400 hover:text-white hover:bg-transparent h-auto p-0"
                  >
                    {showSkipped ? "Hide" : "Show"} skipped rows
                  </Button>
                  {showSkipped && (
                    <ul className="mt-2 text-xs text-zinc-400 space-y-1 max-h-48 overflow-y-auto">
                      {result.errors.map((e, i) => (
                        <li key={`e${i}`}>
                          <span className="text-rose-400">Row {e.row}:</span>{" "}
                          {e.reason}
                        </li>
                      ))}
                      {result.skippedReasons.map((s, i) => (
                        <li key={`s${i}`}>
                          <span className="text-amber-400">Row {s.row}:</span>{" "}
                          {s.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
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
                onClick={() => setStep("preview")}
                disabled={!customerMapped || !intervalMapped || !amountMapped}
                className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded px-3 py-2 font-bold"
              >
                Next: preview
              </Button>
            </>
          )}
          {step === "preview" && (
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
                onClick={doImport}
                className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded px-3 py-2 font-bold"
              >
                Import {csvRows.length}{" "}
                {csvRows.length === 1 ? "row" : "rows"}
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
    { key: "mapping", label: "Map" },
    { key: "preview", label: "Preview" },
    { key: "result", label: "Done" },
  ];
  const activeIdx = labels.findIndex(
    (l) => l.key === step || (step === "importing" && l.key === "preview")
  );
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
