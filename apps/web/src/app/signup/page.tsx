"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        firstName,
        lastName,
        email,
        password,
        areaCode,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Could not create your account.");
      return;
    }
    router.push("/dashboard?welcome=sms");
    router.refresh();
  }

  const inputCls =
    "w-full h-auto bg-black border-line-strong rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50";
  const labelCls =
    "block text-xs font-bold text-zinc-500 mb-2";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <svg viewBox="0 0 128 128" className="w-20 h-20 text-white" aria-label="Forge">
            <path
              d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z"
              fill="currentColor"
            />
          </svg>
          <p className="text-sm text-zinc-400 mt-4 font-bold">
            Start your free trial. No credit card required.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="bg-card border border-line rounded-2xl p-6 space-y-5"
        >
          <div>
            <Label className={labelCls}>Company name</Label>
            <Input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>First name</Label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className={inputCls}
              />
            </div>
            <div>
              <Label className={labelCls}>Last name</Label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <Label className={labelCls}>Email address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputCls}
            />
          </div>
          <div>
            <Label className={labelCls}>Business area code</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={areaCode}
              onChange={(e) =>
                setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              maxLength={3}
              className={inputCls}
            />
            <p className="text-xs text-zinc-500 mt-2 font-bold">
              We&apos;ll assign you a local phone number in this area code for
              texting and calling your customers.
            </p>
          </div>
          <div>
            <Label className={labelCls}>Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={inputCls + " pr-10"}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
          </div>
          {error && (
            <p className="text-sm font-bold text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            variant="ghost"
            disabled={loading}
            className="w-full h-auto bg-white hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 text-black rounded-lg py-3 text-sm font-extrabold tracking-tight"
          >
            {loading ? "Creating account…" : "Create account →"}
          </Button>
          <p className="text-sm text-zinc-400 font-bold text-center pt-2 font-bold">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Sign in
            </Link>
            .
          </p>
        </form>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
