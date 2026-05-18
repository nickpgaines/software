import type { Viewport } from "next";
import ReportsClient from "@/components/ReportsClient";

export const dynamic = "force-dynamic";

// Lock the viewport on the reports page so mobile users can't pinch-zoom
// past the layout — the dashboards are designed to fit one device width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function ReportsPage() {
  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-page-title text-white">Reports</h1>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Performance overview, sales activity, and subscriptions.
        </p>
      </div>
      <ReportsClient />
    </div>
  );
}
