"use client";

import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";

const FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "address",
] as const;

type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  first_name: "First name",
  last_name: "Last name",
  phone: "Phone",
  email: "Email",
  address: "Address",
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
  return null;
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
      <div className="bg-[#0f0f12] rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f24] shrink-0">
          <div>
            <h3 className="font-medium">Import customers</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              <Stepper step={step} />
            </p>
          </div>
          <button
            onClick={close}
            className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
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
            <div className="py-12 text-center text-sm text-zinc-400">
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

        <div className="px-4 py-3 border-t border-[#1f1f24] flex items-center justify-between gap-2 shrink-0">
          {step === "upload" && (
            <>
              <button
                type="button"
                onClick={close}
                className="text-sm border border-[#2a2a32] bg-[#0f0f12] hover:bg-black rounded px-3 py-2"
              >
                Cancel
              </button>
              <span />
            </>
          )}

          {step === "mapping" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setError(null);
                }}
                className="text-sm border border-[#2a2a32] bg-[#0f0f12] hover:bg-black rounded px-3 py-2"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("preview")}
                disabled={!firstNameMapped}
                className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded px-3 py-2"
              >
                Next: preview
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                type="button"
                onClick={() => setStep("mapping")}
                className="text-sm border border-[#2a2a32] bg-[#0f0f12] hover:bg-black rounded px-3 py-2"
              >
                Back
              </button>
              <button
                type="button"
                onClick={doImport}
                className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded px-3 py-2"
              >
                Import {csvRows.length} {csvRows.length === 1 ? "row" : "rows"}
              </button>
            </>
          )}

          {step === "importing" && (
            <>
              <span />
              <button
                type="button"
                disabled
                className="text-sm bg-slate-400 text-white rounded px-3 py-2"
              >
                Importing…
              </button>
            </>
          )}

          {step === "result" && (
            <>
              <span />
              <button
                type="button"
                onClick={finishAndRefresh}
                className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded px-3 py-2"
              >
                Close
              </button>
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
                ? "text-zinc-300 font-medium"
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
      <p className="text-sm text-zinc-400">
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
            : "border-[#1f1f24] bg-black/40 hover:bg-black")
        }
      >
        <div className="text-3xl text-zinc-500">⤴</div>
        <p className="mt-2 text-sm font-medium text-zinc-300">
          Click to choose or drag & drop a CSV file
        </p>
        <p className="text-xs text-zinc-500">.csv files only</p>
      </div>
      <input
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
      <p className="text-sm text-zinc-400">
        Match each CSV column to a Nick360 field. <strong>First name</strong>{" "}
        is required; the others are optional. If you map a single &ldquo;Full
        Name&rdquo; column to First name, we&rsquo;ll auto-split it.
      </p>
      <div className="border border-[#1f1f24] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black text-zinc-400">
            <tr>
              <th className="text-left px-3 py-2 font-medium">CSV column</th>
              <th className="text-left px-3 py-2 font-medium">Sample</th>
              <th className="text-left px-3 py-2 font-medium">
                Nick360 field
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f24]">
            {headers.map((h) => (
              <tr key={h}>
                <td className="px-3 py-2 font-medium text-white">{h}</td>
                <td className="px-3 py-2 text-zinc-400 truncate max-w-[200px]">
                  {(firstSample[h] ?? "").toString() || (
                    <span className="italic text-zinc-500">empty</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) =>
                      setField(h, e.target.value as Field | "")
                    }
                    className="border border-[#2a2a32] rounded px-2 py-1 text-sm"
                  >
                    <option value="">— ignore —</option>
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <p className="text-sm text-zinc-400">
        Showing the first {previewRows.length} of {totalRows} rows after mapping.
        Review for accuracy before importing.
      </p>
      <div className="border border-[#1f1f24] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black text-zinc-400">
            <tr>
              {FIELDS.map((f) => (
                <th key={f} className="text-left px-3 py-2 font-medium">
                  {FIELD_LABELS[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f24]">
            {previewRows.map((row, i) => (
              <tr key={i}>
                {FIELDS.map((f) => (
                  <td
                    key={f}
                    className="px-3 py-2 text-zinc-300 truncate max-w-[160px]"
                  >
                    {row[f] || (
                      <span className="italic text-zinc-500">empty</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
      <div className="bg-black border border-[#1f1f24] rounded-lg p-4 text-center">
        <div className="text-2xl font-semibold text-white">
          Imported {result.inserted} {result.inserted === 1 ? "customer" : "customers"}
        </div>
        <div className="text-sm text-zinc-400 mt-1">
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
          <button
            type="button"
            onClick={() => setShowSkipped(!showSkipped)}
            className="text-sm text-zinc-400 hover:text-white"
          >
            {showSkipped ? "▾" : "▸"} Show details (
            {result.skippedReasons.length + result.errors.length})
          </button>
          {showSkipped && (
            <div className="mt-2 border border-[#1f1f24] rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-black text-zinc-400 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-16">
                      Row
                    </th>
                    <th className="text-left px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f24]">
                  {result.errors.map((e, i) => (
                    <tr key={`e-${i}`}>
                      <td className="px-3 py-2 text-zinc-300 tabular-nums">
                        {e.row}
                      </td>
                      <td className="px-3 py-2 text-red-600">{e.reason}</td>
                    </tr>
                  ))}
                  {result.skippedReasons.map((s, i) => (
                    <tr key={`s-${i}`}>
                      <td className="px-3 py-2 text-zinc-300 tabular-nums">
                        {s.row}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
