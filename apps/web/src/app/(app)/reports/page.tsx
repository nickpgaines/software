import ReportsClient from "@/components/ReportsClient";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          <span className="text-sky-400">Reports</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Performance overview, sales activity, and subscriptions.
        </p>
      </div>
      <ReportsClient />
    </div>
  );
}
