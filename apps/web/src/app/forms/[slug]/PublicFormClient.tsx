"use client";

import { useState } from "react";

export type FieldDef = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
};

export default function PublicFormClient({
  slug,
  formName,
  companyName,
  fields,
}: {
  slug: string;
  formName: string;
  companyName: string;
  fields: FieldDef[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/lead-forms/submit/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website: honeypot }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-fg flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {companyName && (
            <p className="text-sm font-bold text-fg-subtle uppercase tracking-wider">
              {companyName}
            </p>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight mt-2">
            {formName}
          </h1>
        </div>

        {done ? (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <h2 className="text-lg font-extrabold tracking-tight">Thanks!</h2>
            <p className="text-sm font-bold text-fg-muted mt-2">
              We&apos;ve got your details and will be in touch shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-line bg-card p-6 space-y-4"
          >
            {fields.length === 0 ? (
              <p className="text-sm font-bold text-fg-muted text-center py-4">
                This form has no fields yet.
              </p>
            ) : (
              fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label
                    htmlFor={`f-${f.key}`}
                    className="block text-sm font-bold"
                  >
                    {f.label}
                    {f.required && (
                      <span className="text-rose-500 ml-0.5">*</span>
                    )}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      id={`f-${f.key}`}
                      required={f.required}
                      value={values[f.key] || ""}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      rows={4}
                      className="flex w-full rounded-md border border-line bg-card px-3 py-2 text-sm font-bold"
                    />
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      type={
                        f.type === "email"
                          ? "email"
                          : f.type === "tel"
                          ? "tel"
                          : "text"
                      }
                      required={f.required}
                      value={values[f.key] || ""}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      className="flex h-10 w-full rounded-md border border-line bg-card px-3 py-2 text-sm font-bold"
                    />
                  )}
                </div>
              ))
            )}

            {/* Honeypot: visually hidden, ignored by users, often filled by
                naive bots. Server treats any non-empty value as spam. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm font-bold text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || fields.length === 0}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Submit"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
