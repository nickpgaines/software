"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

// Inside the Capacitor shell the marketing site is dead weight — the app's
// entry point is /login. If a native session ever lands on a marketing route
// (e.g. a logo link or a stale deep link), send it straight to /login;
// middleware bounces an already-authenticated request on to /dashboard. No-op
// in any browser, so the public marketing site is unaffected. (Phase 4.)
export function NativeMarketingRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isNativeApp()) router.replace("/login");
  }, [router]);

  return null;
}
