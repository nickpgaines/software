"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured on this server.",
  oauth_state_mismatch: "Sign-in session expired. Please try again.",
  oauth_state_invalid: "Sign-in session expired. Please try again.",
  google_token_exchange_failed: "Could not complete Google sign-in.",
  google_userinfo_failed: "Could not read your Google profile.",
  google_email_unverified: "Your Google email address isn't verified.",
  no_matching_staff:
    "No account matches that Google email. Ask your admin to add you first.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthErrorCode = searchParams.get("error");
  const oauthError = oauthErrorCode
    ? OAUTH_ERROR_MESSAGES[oauthErrorCode] || "Sign-in failed. Please try again."
    : null;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-page-title text-white">
            Forge CRM
          </h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Sign in to continue
          </p>
        </div>
        <div className="space-y-3 mb-4">
          <a
            href="/api/auth/google/start"
            className="flex items-center justify-center gap-3 w-full bg-card border border-line rounded-lg py-2.5 text-sm font-extrabold text-white tracking-tight hover:bg-black"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
              />
            </svg>
            Sign in with Google
          </a>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] font-extrabold text-zinc-500">
            <div className="flex-1 h-px bg-line" />
            <span>or</span>
            <div className="flex-1 h-px bg-line" />
          </div>
        </div>
        {oauthError && (
          <div className="mb-4 text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {oauthError}
          </div>
        )}
        <form
          onSubmit={onSubmit}
          className="bg-card border border-line rounded-2xl p-6 space-y-5"
        >
          <div>
            <Label className="block text-eyebrow uppercase text-zinc-500 mb-2">
              Email or username
            </Label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="employee@example.com"
              autoComplete="username"
              className="w-full h-auto bg-black border-line-strong rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
              autoFocus
            />
          </div>
          <div>
            <Label className="block text-eyebrow uppercase text-zinc-500 mb-2">
              Password
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-auto bg-black border-line-strong rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            />
          </div>
          {error && (
            <p className="text-sm font-bold text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            variant="ghost"
            disabled={loading}
            className="w-full h-auto bg-white hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 text-black rounded-lg py-2.5 text-sm font-extrabold tracking-tight"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-[11px] text-zinc-500 text-center font-bold">
            {process.env.NODE_ENV === "production" ? (
              <>Employees sign in with their email + password.</>
            ) : (
              <>
                Admin default: <span className="font-mono text-zinc-400">admin / admin</span>.
                Employees sign in with their email + password.
              </>
            )}
          </p>
        </form>
        <p className="text-sm text-zinc-400 font-bold text-center mt-6 font-bold">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-violet-400 hover:text-violet-300 font-extrabold"
          >
            Sign up
          </Link>{" "}
          for a free trial.
        </p>
      </div>
    </div>
  );
}
