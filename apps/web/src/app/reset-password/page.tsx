"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not reset your password.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1500);
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center">
            <svg viewBox="0 0 128 128" className="w-20 h-20 text-white" aria-label="Forge">
              <path
                d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <p className="text-sm font-bold text-red-400 mt-6">
            This reset link is missing its token. Request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block mt-6 text-violet-400 hover:text-violet-300 font-extrabold"
          >
            Get a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <svg viewBox="0 0 128 128" className="w-20 h-20 text-white" aria-label="Forge">
            <path
              d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z"
              fill="currentColor"
            />
          </svg>
          <p className="text-sm text-zinc-400 mt-4 font-bold">
            Choose a new password
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="bg-card border border-line rounded-2xl p-6 space-y-5"
        >
          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-2">
              New password
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full h-auto bg-black border-line-strong rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
              autoFocus
            />
          </div>
          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-2">
              Confirm new password
            </Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full h-auto bg-black border-line-strong rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            />
          </div>
          {error && (
            <p className="text-sm font-bold text-red-400">{error}</p>
          )}
          {done && (
            <p className="text-sm font-bold text-emerald-400">
              Password updated. Redirecting to sign in…
            </p>
          )}
          <Button
            type="submit"
            variant="ghost"
            disabled={loading || done}
            className="w-full h-auto bg-white hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 text-black rounded-lg py-2.5 text-sm font-extrabold tracking-tight"
          >
            {loading ? "Saving…" : done ? "Saved" : "Set new password"}
          </Button>
        </form>
        <p className="text-sm text-zinc-400 font-bold text-center mt-6">
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
