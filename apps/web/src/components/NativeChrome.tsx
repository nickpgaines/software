"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

// One-time native UX chrome setup for the Capacitor shell (Phase 3). No-op in
// any browser. Plugins are imported dynamically so they never load during SSR
// or in the browser bundle. Keeps the status bar styled for the dark UI and
// hides the launch splash once the hosted app has painted.
export function NativeChrome() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Style.Dark = light text/icons, which reads on Forge's black UI.
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // StatusBar isn't available on every platform; ignore.
      }

      if (cancelled) return;

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // No splash plugin / already hidden; ignore.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
