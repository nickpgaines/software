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

// Runs before paint to apply the user's saved theme. Inlined to avoid a
// flash of dark-mode on first paint when the user has chosen light mode.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('forge-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
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
