import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Forge CRM",
  description: "Simple CRM for door-to-door window cleaning",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
      <body>{children}</body>
    </html>
  );
}
