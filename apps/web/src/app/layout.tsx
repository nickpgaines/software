import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Forge CRM",
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

// Status bar color follows the device's system light/dark preference.
// Splash screen background is set in manifest.json and stays dark.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before paint to apply the user's saved theme + accent color. Inlined
// to avoid a flash of defaults on first paint when the user has chosen
// something other than the default white-on-dark / black-on-light accent.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('forge-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    var a = localStorage.getItem('forge-accent');
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
        {children}
      </body>
    </html>
  );
}
