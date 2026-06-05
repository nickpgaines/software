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
  "first_name",
  "last_name",
  "phone",
  "email",
  "address",
  "created_at",
] as const;

type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  first_name: "First name",
  last_name: "Last name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  created_at: "Date added",
};

type Step = "upload" | "mapping" | "preview" | "importing" | "result";

type Result = {
  inserted: number;
  skipped: number;
  skippedReasons: { row: number; reason: string }[];
  errors: { row: number; reason: string }[];
};

type Mapping = Record<string, Field | "">;

function suggestField(header: string): Field | null {
  const h = header.trim().toLowerCase();
  if (/^(first.?name|fname|given.?name)$/i.test(h)) return "first_name";
  if (/^(last.?name|lname|surname|family.?name)$/i.test(h)) return "last_name";
  if (/^(full.?name|name|customer.?name|contact.?name)$/i.test(h)) return "first_name";
  if (/email/i.test(h)) return "email";
  if (/phone|mobile|cell|telephone|tel\b/i.test(h)) return "phone";
  if (/address|street|location/i.test(h)) return "address";
  if (/^(date.?added|created.?at|created.?on|signed.?up|since|customer.?since|join.?date|added.?on)$/i.test(h))
    return "created_at";
  return null;
}

// Parse common Homebase360 / CRM export date formats to ISO so we can store
// it in the SQLite TEXT column. Accepts "Sep 28, 2023", "2023-09-28",
// "9/28/2023", etc. Returns null on anything we can't parse so the API
// falls back to the row's default created_at.
function parseDateLoose(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  // Strip the time portion since most CRM exports are date-only and we
  // don't want phantom timezone shifts to push the date back a day.
  return d.toISOString();
}

function autoSplitFirst(first: string, last: string) {
  if (last) return { first, last };
  if (!first.includes(" ")) return { first, last: "" };
  const idx = first.indexOf(" ");
  return {
    first: first.slice(0, idx).trim(),
    last: first.slice(idx + 1).trim(),
  };
}

function buildMapped(
  rows: Record<string, string>[],
  mapping: Mapping
): Record<Field, string>[] {
  return rows.map((row) => {
    const out: Record<Field, string> = {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      address: "",
      created_at: "",
    };
    for (const [header, field] of Object.entries(mapping)) {
      if (field) {
        const v = (row[header] ?? "").toString().trim();
        if (v && !out[field]) out[field] = v;
      }
    }
    const split = autoSplitFirst(out.first_name, out.last_name);
    out.first_name = split.first;
    out.last_name = split.last;
    // Normalize the date so the server doesn't have to guess at the format.
    // Bad parses become empty so the API falls back to "now".
    if (out.created_at) {
      out.created_at = parseDateLoose(out.created_at) || "";
    }
    return out;
  });
}

export default function ImportModal({
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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const firstNameMapped = useMemo(
    () => Object.values(mapping).includes("first_name"),
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
    const res = await fetch("/api/customers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      setError("Import failed");
      setStep("preview");
      return;
    }
    const data = (await res.json()) as Result;
    setResult(data);
    setStep("result");
  }

  function close() {
    onClose();
  }

  function finishAndRefresh() {
    onImported();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div>
            <h3 className="font-bold">Import customers</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              <Stepper step={step} />
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={close}
            className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent text-xl leading-none"
            aria-label="Close"
          >
            ×
          </Button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {step === "upload" && (
            <UploadStep
              dragActive={dragActive}
              setDragActive={setDragActive}
              fileInputRef={fileInputRef}
              onFile={handleFile}
              error={error}
            />
          )}

          {step === "mapping" && (
            <MappingStep
              headers={headers}
              csvRows={csvRows}
              mapping={mapping}
              setMapping={setMapping}
            />
          )}

          {step === "preview" && (
            <PreviewStep
              previewRows={previewRows}
              totalRows={csvRows.length}
              error={error}
            />
          )}

          {step === "importing" && (
            <div className="py-12 text-center text-sm text-zinc-400 font-bold">
              Importing…
            </div>
          )}

          {step === "result" && result && (
            <ResultStep
              result={result}
              showSkipped={showSkipped}
              setShowSkipped={setShowSkipped}
            />
          )}
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2 shrink-0">
          {step === "upload" && (
            <>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <span />
            </>
          )}

          {step === "mapping" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setStep("preview")}
                disabled={!firstNameMapped}
              >
                Next: preview
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("mapping")}
              >
                Back
              </Button>
              <Button type="button" onClick={doImport}>
                Import {csvRows.length} {csvRows.length === 1 ? "row" : "rows"}
              </Button>
            </>
          )}

          {step === "importing" && (
            <>
              <span />
              <Button type="button" disabled>
                Importing…
              </Button>
            </>
          )}

          {step === "result" && (
            <>
              <span />
              <Button type="button" onClick={finishAndRefresh}>
                Close
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
    { key: "preview", label: "Preview" },
    { key: "result", label: "Result" },
  ];
  const activeIdx = labels.findIndex((l) => l.key === step);
  return (
    <span>
      {labels.map((l, i) => (
        <span key={l.key}>
          <span
            className={
              i === activeIdx ||
              (step === "importing" && l.key === "preview")
                ? "text-zinc-300 font-bold"
                : ""
            }
          >
            {l.label}
          </span>
          {i < labels.length - 1 && <span className="mx-1.5">›</span>}
        </span>
      ))}
    </span>
  );
}

function UploadStep({
  dragActive,
  setDragActive,
  fileInputRef,
  onFile,
  error,
}: {
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File | null) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 font-bold">
        Upload a CSV file. The first row should be column headers.
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={
          "rounded-lg border-2 border-dashed py-12 text-center cursor-pointer transition " +
          (dragActive
            ? "border-slate-400 bg-black"
            : "border-line bg-black/40 hover:bg-black")
        }
      >
        <div className="text-3xl text-zinc-500">⤴</div>
        <p className="mt-2 text-xs font-bold text-zinc-500">
          Click to choose or drag & drop a CSV file
        </p>
        <p className="text-xs font-bold text-zinc-500">.csv files only</p>
      </div>
      <Input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
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
  function setField(header: string, value: Field | "") {
    setMapping({ ...mapping, [header]: value });
  }
  const firstSample = csvRows[0] ?? {};
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 font-bold">
        Match each CSV column to a Forge CRM field. <strong>First name</strong>{" "}
        is required; the others are optional. If you map a single &ldquo;Full
        Name&rdquo; column to First name, we&rsquo;ll auto-split it.
      </p>
      <div className="border border-line rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-line">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">CSV column</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Sample</TableHead>
              <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">
                Forge CRM field
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-line">
            {headers.map((h) => (
              <TableRow key={h} className="border-0 hover:bg-transparent">
                <TableCell className="px-3 py-2 font-bold text-white tracking-tight">{h}</TableCell>
                <TableCell className="px-3 py-2 text-zinc-400 truncate max-w-[200px]">
                  {(firstSample[h] ?? "").toString() || (
                    <span className="italic text-zinc-500">empty</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2">
                  {/* Native <select> kept: deferred Select migration (empty-string "ignore" sentinel forbidden by Radix). */}
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) =>
                      setField(h, e.target.value as Field | "")
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

function PreviewStep({
  previewRows,
  totalRows,
  error,
}: {
  previewRows: Record<Field, string>[];
  totalRows: number;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 font-bold">
        Showing the first {previewRows.length} of {totalRows} rows after mapping.
        Review for accuracy before importing.
      </p>
      <div className="border border-line rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-line">
            <TableRow className="hover:bg-transparent">
              {FIELDS.map((f) => (
                <TableHead key={f} className="h-auto text-left px-3 py-2 font-bold">
                  {FIELD_LABELS[f]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-line">
            {previewRows.map((row, i) => (
              <TableRow key={i} className="border-0 hover:bg-transparent">
                {FIELDS.map((f) => (
                  <TableCell
                    key={f}
                    className="px-3 py-2 text-zinc-300 truncate max-w-[160px]"
                  >
                    {row[f] || (
                      <span className="italic text-zinc-500">empty</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ResultStep({
  result,
  showSkipped,
  setShowSkipped,
}: {
  result: Result;
  showSkipped: boolean;
  setShowSkipped: (v: boolean) => void;
}) {
  const total =
    result.inserted + result.skipped + result.errors.length;
  return (
    <div className="space-y-4">
      <div className="bg-black border border-line rounded-lg p-4 text-center">
        <div className="text-page-title text-white">
          Imported {result.inserted} {result.inserted === 1 ? "customer" : "customers"}
        </div>
        <div className="text-sm text-zinc-400 mt-3 font-bold">
          {result.skipped > 0 && (
            <>
              Skipped {result.skipped} duplicate
              {result.skipped === 1 ? "" : "s"}
              {result.errors.length > 0 ? ", " : ""}
            </>
          )}
          {result.errors.length > 0 && (
            <>
              {result.errors.length}{" "}
              {result.errors.length === 1 ? "error" : "errors"}
            </>
          )}
          {result.skipped === 0 && result.errors.length === 0 && (
            <>{total} of {total} rows imported.</>
          )}
        </div>
      </div>

      {(result.skippedReasons.length > 0 || result.errors.length > 0) && (
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowSkipped(!showSkipped)}
            className="h-auto p-0 text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
          >
            {showSkipped ? "▾" : "▸"} Show details (
            {result.skippedReasons.length + result.errors.length})
          </Button>
          {showSkipped && (
            <div className="mt-2 border border-line rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <Table>
                <TableHeader className="bg-black text-zinc-400 sticky top-0">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-auto text-left px-3 py-2 font-bold w-16">
                      Row
                    </TableHead>
                    <TableHead className="h-auto text-left px-3 py-2 text-xs font-bold text-zinc-500">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-line">
                  {result.errors.map((e, i) => (
                    <TableRow key={`e-${i}`} className="border-0 hover:bg-transparent">
                      <TableCell className="px-3 py-2 text-zinc-300 tabular-nums">
                        {e.row}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-red-600">{e.reason}</TableCell>
                    </TableRow>
                  ))}
                  {result.skippedReasons.map((s, i) => (
                    <TableRow key={`s-${i}`} className="border-0 hover:bg-transparent">
                      <TableCell className="px-3 py-2 text-zinc-300 tabular-nums">
                        {s.row}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-zinc-400">{s.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
