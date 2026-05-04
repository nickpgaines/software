"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
          <h1 className="text-2xl font-semibold text-white">Nick360</h1>
          <p className="text-sm text-zinc-400 mt-1">Sign in to continue</p>
        </div>
        <div className="space-y-3 mb-4">
          <a
            href="/api/auth/google/start"
            className="flex items-center justify-center gap-3 w-full bg-[#0f0f12] border border-[#1f1f24] rounded-lg py-2.5 text-sm font-medium text-white hover:bg-black shadow-sm"
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
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <div className="flex-1 h-px bg-[#1f1f24]" />
            <span>or</span>
            <div className="flex-1 h-px bg-[#1f1f24]" />
          </div>
        </div>
        {oauthError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            {oauthError}
          </div>
        )}
        <form
          onSubmit={onSubmit}
          className="bg-[#0f0f12] border border-[#1f1f24] rounded-lg p-6 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Email or username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="employee@example.com"
              autoComplete="username"
              className="w-full border border-[#2a2a32] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#2a2a32] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded py-2 text-sm font-medium"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-zinc-400 text-center">
            {process.env.NODE_ENV === "production" ? (
              <>Employees sign in with their email + password.</>
            ) : (
              <>
                Admin default: <span className="font-mono">admin / admin</span>.
                Employees sign in with their email + password.
              </>
            )}
          </p>
        </form>
        <p className="text-sm text-zinc-400 text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            Sign up
          </Link>{" "}
          for a free trial.
        </p>
      </div>
    </div>
  );
}
