"use client";

import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { isNativeApp } from "@/lib/native";

// One-time native UX chrome setup for the Capacitor shell (Phase 3/4). No-op in
// any browser. Plugins are imported dynamically so they never load during SSR
// or in the browser bundle. Keeps the status bar styled for the dark UI, hides
// the launch splash once the hosted app has painted, and wires the Android
// hardware back button to webview history (Phase 4).
export function NativeChrome() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const handles: PluginListenerHandle[] = [];
    let themeObserver: MutationObserver | null = null;

    // Native-app text behavior: long-press must not pop the iOS text-selection
    // loupe / Copy–Look Up callout on labels and headings (it fights chart
    // scrubbing and feels web-y). globals.css scopes user-select/touch-callout
    // off under this class, while keeping inputs/textareas selectable.
    document.documentElement.classList.add("native-app");

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // The status bar icons must contrast with the app's theme. Capacitor's
        // Style is inverted from its name: Style.Light = dark icons (for light
        // backgrounds), Style.Dark = light icons (for dark backgrounds). The
        // active theme lives in <html>'s `data-theme` attribute — "light" for
        // light mode, absent/"dark" for the default dark UI (set pre-paint by
        // the inline script in layout.tsx, toggled at runtime by ThemeToggle).
        const applyStatusBarStyle = () => {
          const isLight =
            document.documentElement.getAttribute("data-theme") === "light";
          return StatusBar.setStyle({
            style: isLight ? Style.Light : Style.Dark,
          });
        };

        await applyStatusBarStyle();

        if (cancelled) return;

        // Re-apply whenever ThemeToggle flips `data-theme` at runtime, so the
        // status bar icons stay legible after a theme switch.
        themeObserver = new MutationObserver(() => {
          void applyStatusBarStyle().catch(() => {
            // Style set can fail transiently; ignore.
          });
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
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

      if (cancelled) return;

      try {
        const { App } = await import("@capacitor/app");

        // Universal Links / App Links: an emailed or web link on our own domain
        // (e.g. /invoices/pay/<token>, /estimates/accept/*, /subscriptions/
        // accept/* — see the AASA route) is handed to the app instead of the
        // browser. Navigate the webview to the link's path. Same-origin only,
        // so OAuth/custom-scheme callbacks are ignored. Device-verifiable only
        // once the Associated Domains entitlement + IOS_APP_ID land (Team ID).
        const openDeepLink = (url: string) => {
          try {
            const u = new URL(url);
            if (!u.hostname.endsWith("forgecrm.app")) return;
            const target = u.pathname + u.search + u.hash;
            const current =
              window.location.pathname +
              window.location.search +
              window.location.hash;
            if (target && target !== current) window.location.assign(target);
          } catch {
            // Non-URL payload (custom scheme, etc.) — ignore.
          }
        };

        // Cold start: the app was launched by tapping a link.
        try {
          const launch = await App.getLaunchUrl();
          if (!cancelled && launch?.url) openDeepLink(launch.url);
        } catch {
          // getLaunchUrl isn't available on every platform; ignore.
        }

        // Warm: a link tapped while the app is already running.
        const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
          openDeepLink(url);
        });

        // Android hardware back button: step back through webview history, and
        // exit the app at the history root instead of leaving a blank webview.
        // iOS never fires this event, so the listener is inert there.
        const backHandle = await App.addListener(
          "backButton",
          ({ canGoBack }) => {
            if (canGoBack) {
              window.history.back();
            } else {
              App.exitApp();
            }
          }
        );

        if (cancelled) {
          urlHandle.remove();
          backHandle.remove();
        } else {
          handles.push(urlHandle, backHandle);
        }
      } catch {
        // No App plugin (e.g. web); ignore.
      }
    })();

    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      for (const h of handles) h.remove();
    };
  }, []);

  return null;
}
