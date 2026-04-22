import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Window CRM",
  description: "Simple CRM for door-to-door window cleaning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
