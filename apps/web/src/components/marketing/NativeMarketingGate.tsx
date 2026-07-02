"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

// Inside the Capacitor shell the marketing site is dead weight — the app's
// entry point is /login. If a native session ever lands on a marketing route
// (e.g. a logo link or a stale deep link), send it straight to /login;
// middleware bounces an already-authenticated request on to /dashboard.
//
// This is a remote-URL Capacitor app: the hosted page is SSR'd (it can't know
// it's native) and the webview paints that HTML before any JS runs, so a brief
// flash of marketing chrome at the very first paint is unavoidable. What we can
// kill is the *hydrated* marketing page lingering while the navigation to /login
// resolves — the instant we detect the native shell we swap the whole tree for a
// blank, app-colored screen. SSR and the first client render both produce
// `children`, so there's no hydration mismatch; the mask swaps in right after
// mount. No-op in any browser, so the public marketing site is unaffected.
// (Phase 4.)
export function NativeMarketingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isNativeApp()) {
      setRedirecting(true);
      router.replace("/login");
    }
  }, [router]);

  if (redirecting) {
    return <div className="min-h-screen bg-canvas" aria-hidden />;
  }

  return <>{children}</>;
}
