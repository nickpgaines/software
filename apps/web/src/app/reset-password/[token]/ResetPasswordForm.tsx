"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MIN_LENGTH = 10;

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= MIN_LENGTH && password === confirm && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      // Send them back to sign-in after a beat. router.push is enough since
      // they're not authed yet — middleware will allow /login through.
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <p className="text-sm text-slate-700">
          Password updated. Redirecting you to sign in…
        </p>
        <Link
          href="/login"
          className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white rounded py-2 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          required
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          autoFocus
        />
        {tooShort && (
          <p className="text-xs text-slate-500 mt-1">
            Must be at least {MIN_LENGTH} characters.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Confirm new password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {mismatch && (
          <p className="text-xs text-red-600 mt-1">Passwords don't match.</p>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded py-2 text-sm font-medium"
      >
        {submitting ? "Updating…" : "Update password"}
      </button>
      <p className="text-xs text-slate-500 text-center">
        <Link
          href="/login"
          className="text-slate-700 underline hover:text-slate-900"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
