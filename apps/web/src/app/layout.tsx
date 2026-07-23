import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { MobileZoomLock } from "@/components/MobileZoomLock";
import { NativeChrome } from "@/components/NativeChrome";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Forge",
  description: "Simple CRM for door-to-door window cleaning",
  manifest: "/manifest.json",
  applicationName: "Forge",
  appleWebApp: {
    capable: true,
    title: "Forge",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

// Splash screen background is set in manifest.json and stays dark.
// Pinch-zoom and side-scroll are disabled app-wide so every screen
// stays sized-to-fit on mobile (multi-tab pages get a locally-scrollable
// tab strip per DESIGN_SYSTEM §9.6).
export const viewport: Viewport = {
  // themeColor is static metadata rendered on the server, so it can only key
  // off the OS-level `prefers-color-scheme`; it cannot read the per-device
  // `forge-theme` localStorage choice that the inline script below applies.
  // Result: the browser UI/status-bar tint follows the OS preference, which
  // may differ from the in-app theme (e.g. OS dark + app light). This is a
  // known, cosmetic limitation — the in-app surfaces themselves always honor
  // the localStorage choice via `data-theme`. Do not try to "fix" it by
  // moving theme state into auth/session or the manifest.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Runs before paint to apply the user's saved theme + accent color. Inlined
// to avoid a flash of defaults on first paint when the user has chosen
// light mode and/or a custom accent.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('forge-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    var a = localStorage.getItem('forge-accent');
    // One-shot migration: #8b5cf6 was the app's original default accent, so
    // long-time devices have it persisted even though the default is now
    // white — clear it once. The marker keeps deliberate Violet picks made
    // after this migration sticky (AccentPicker also sets the marker).
    if (!localStorage.getItem('forge-accent-migrated')) {
      localStorage.setItem('forge-accent-migrated', '1');
      if (a === '#8b5cf6') {
        localStorage.removeItem('forge-accent');
        a = null;
      }
    }
    if (a && /^#[0-9a-fA-F]{6}$/.test(a)) {
      var r = parseInt(a.slice(1, 3), 16);
      var g = parseInt(a.slice(3, 5), 16);
      var b = parseInt(a.slice(5, 7), 16);
      var yiq = (r * 299 + g * 587 + b * 114) / 1000;
      var fg = yiq >= 160 ? '#0a0a0a' : '#ffffff';
      var s = document.documentElement.style;
      s.setProperty('--color-violet', a);
      s.setProperty('--color-violet-soft', a);
      s.setProperty('--color-violet-foreground', fg);
      s.setProperty('--color-violet-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.25)');
    }
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <MobileZoomLock />
        <NativeChrome />
        {children}
      </body>
    </html>
  );
}
