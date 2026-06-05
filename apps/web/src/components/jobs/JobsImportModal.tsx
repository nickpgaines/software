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

// Fields the import endpoint accepts. Customer + scheduled date are
// required to land a useful row; everything else is enrichment.
const FIELDS = [
  "customer_name",
  "scheduled_at",
  "date_added",
  "status",
  "payment_method",
  "amount",
  "tip",
  "lead_source",
  "dispatched_to",
  "recurrence",
] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  customer_name: "Customer",
  scheduled_at: "Job date",
  date_added: "Date added",
  status: "Status",
  payment_method: "Payment method",
  amount: "Total ($)",
  tip: "Tip ($)",
  lead_source: "Lead source",
  dispatched_to: "Dispatched to",
  recurrence: "Recurrence",
};

type Mapping = Record<string, Field | "">;
type Step = "upload" | "mapping" | "preview" | "importing" | "result";

type Result = {
  inserted_jobs: number;
  inserted_payments: number;
  skipped: number;
  skippedReasons: { row: number; reason: string }[];
  errors: { row: number; reason: string }[];
};

function suggestField(header: string): Field | null {
  const h = header.trim().toLowerCase();
  if (/^(customer|client|account)$/i.test(h)) return "customer_name";
  if (/start.?date|scheduled|job.?date|service.?date/i.test(h))
    return "scheduled_at";
  if (/date.?added|created/i.test(h)) return "date_added";
  if (/status|state/i.test(h)) return "status";
  if (/payment.?method/i.test(h)) return "payment_method";
  if (/^(total|amount|price|cost|charged)$/i.test(h)) return "amount";
  if (/^tip$/i.test(h)) return "tip";
  if (/lead.?source|source/i.test(h)) return "lead_source";
  if (/dispatch|technician|assigned/i.test(h)) return "dispatched_to";
  if (/recurr|cadence|frequency/i.test(h)) return "recurrence";
  return null;
}

function dollarsToCents(raw: string): number {
  const n = parseFloat((raw || "").replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
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
  scheduled_at: string | null;
  date_added: string | null;
  status: string;
  payment_method: string;
  amount_cents: number;
  tip_cents: number;
  lead_source: string;
  dispatched_to: string;
  recurrence: string;
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
      scheduled_at: parseDateLoose(get("scheduled_at")),
      date_added: parseDateLoose(get("date_added")),
      status: get("status"),
      payment_method: get("payment_method"),
      amount_cents: dollarsToCents(get("amount")),
      tip_cents: dollarsToCents(get("tip")),
      lead_source: get("lead_source"),
      dispatched_to: get("dispatched_to"),
      recurrence: get("recurrence"),
    };
  });
}

export default function JobsImportModal({
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
  const dateMapped = useMemo(
    () => Object.values(mapping).includes("scheduled_at"),
    [mapping]
  );

  const previewRows = useMemo(
    () => buildMapped(csvRows.slice(0, 5), mapping),
    [csvRows, mapping]
  );

  // Chunked import — see ImportModal for the rationale. A real Homebase360
  // jobs export can run into the tens of thousands of rows; one big POST
  // times out Vercel's serverless function. Batch and accumulate.
  async function doImport() {
    setStep("importing");
    setError(null);
    const rows = buildMapped(csvRows, mapping);
    const CHUNK = 200;
    const total: Result = {
      inserted_jobs: 0,
      inserted_payments: 0,
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
      const res = await fetch("/api/jobs/import", {
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
            ` (failed on rows ${offset + 1}–${offset + slice.length} of ${rows.length}; ${total.inserted_jobs} jobs imported before this)`
        );
        setStep("preview");
        setImportProgress(null);
        return;
      }
      const data = (await res.json()) as Result;
      total.inserted_jobs += data.inserted_jobs;
      total.inserted_payments += data.inserted_payments;
      total.skipped += data.skipped;
      for (const e of data.errors) {
        total.errors.push({ row: offset + e.row, reason: e.reason });
      }
      for (const s of data.skippedReasons) {
        total.skippedReasons.push({
          row: offset + s.row,
          reason: s.reason,
        });
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
            <h3 className="font-bold">Import jobs</h3>
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
                Upload a jobs export from your old CRM (Homebase360, etc.).
                Each row becomes a Job on the matching Forge customer&apos;s
                detail page. Rows marked Paid also create a Payment record.
              </p>
              <p className="text-xs text-zinc-500">
                Customers are matched by name. Run the customer import first
                so every job has somewhere to land.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-line bg-black/40 hover:bg-black py-10 text-center cursor-pointer transition"
              >
                <div className="text-3xl text-zinc-500">⤴</div>
                <p className="mt-2 text-xs font-bold text-zinc-500">
                  Click to choose your jobs .csv
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
                <strong>Customer</strong> and <strong>Job date</strong> are
                required.
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
                rows. Click <strong>Import</strong> to commit.
              </p>
              <div className="border border-line rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-black">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Customer
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Date
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Status
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Amount
                      </TableHead>
                      <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                        Method
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
                          {r.scheduled_at
                            ? new Date(r.scheduled_at).toLocaleDateString()
                            : (
                                <span className="italic text-zinc-500">—</span>
                              )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-400">
                          {r.status || "—"}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-300 tabular-nums">
                          ${(r.amount_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-zinc-400">
                          {r.payment_method || "—"}
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
                  : `…`}
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
                  label="Jobs imported"
                  value={result.inserted_jobs}
                  accent="text-emerald-400"
                />
                <Stat
                  label="Payments recorded"
                  value={result.inserted_payments}
                  accent="text-emerald-400"
                />
                <Stat
                  label="Skipped"
                  value={result.skipped + result.errors.length}
                  accent="text-zinc-400"
                />
              </div>
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
                disabled={!customerMapped || !dateMapped}
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
                Import {csvRows.length} {csvRows.length === 1 ? "row" : "rows"}
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
