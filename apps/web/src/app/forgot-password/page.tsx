"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError(
          "Too many password reset requests. Please wait a bit and try again."
        );
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Reset your password
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            We'll email you a link to choose a new one.
          </p>
        </div>
        {submitted ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            <p className="text-sm text-slate-700">
              If that email matches an account, we've sent a link to reset the
              password. The link expires in 30 minutes.
            </p>
            <p className="text-sm text-slate-500">
              Didn't get an email? Check your spam folder, or try again with a
              different address.
            </p>
            <Link
              href="/login"
              className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white rounded py-2 text-sm font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded py-2 text-sm font-medium"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-xs text-slate-500 text-center">
              Remembered it?{" "}
              <Link
                href="/login"
                className="text-slate-700 underline hover:text-slate-900"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
