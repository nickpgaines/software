import ReportsClient from "@/components/ReportsClient";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">
          Performance overview, sales activity, and subscriptions.
        </p>
      </div>
      <ReportsClient />
    </div>
  );
}
