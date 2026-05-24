"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setDevResetUrl(null);
    const res = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      devResetUrl?: string;
    };
    setMessage(
      data.message ||
        "If that email matches an account, we just sent reset instructions to it."
    );
    if (data.devResetUrl) {
      setDevResetUrl(data.devResetUrl);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <svg viewBox="0 0 128 128" className="w-12 h-12 text-white" aria-label="Forge">
            <path
              d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z"
              fill="currentColor"
            />
          </svg>
          <p className="text-sm text-zinc-400 mt-4 font-bold">
            Reset your password
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="bg-card border border-line rounded-2xl p-6 space-y-5"
        >
          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-2">
              Email
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@example.com"
              autoComplete="email"
              required
              className="w-full h-auto bg-black border-line-strong rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
              autoFocus
            />
          </div>
          {message && (
            <p className="text-sm font-bold text-zinc-300">{message}</p>
          )}
          {devResetUrl && (
            <div className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 break-all">
              Dev mode: email sending isn&apos;t configured. Use this link to
              continue:{" "}
              <a
                href={devResetUrl}
                className="underline text-amber-300"
              >
                {devResetUrl}
              </a>
            </div>
          )}
          <Button
            type="submit"
            variant="ghost"
            disabled={loading}
            className="w-full h-auto bg-white hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 text-black rounded-lg py-2.5 text-sm font-extrabold tracking-tight"
          >
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="text-sm text-zinc-400 font-bold text-center mt-6">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-violet-400 hover:text-violet-300 font-extrabold"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
