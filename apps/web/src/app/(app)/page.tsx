import db, { type JobWithCustomer } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DashboardPage() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const todayJobs = db
    .prepare(
      `SELECT j.*, c.name AS customer_name, c.address AS customer_address, c.phone AS customer_phone
       FROM jobs j JOIN customers c ON c.id = j.customer_id
       WHERE j.scheduled_at >= ? AND j.scheduled_at < ?
       ORDER BY j.scheduled_at ASC`
    )
    .all(today.toISOString(), tomorrow.toISOString()) as JobWithCustomer[];

  const weekCount = db
    .prepare(
      "SELECT COUNT(*) AS n FROM jobs WHERE scheduled_at >= ? AND scheduled_at < ?"
    )
    .get(today.toISOString(), endOfWeek.toISOString()) as { n: number };

  const customerCount = db
    .prepare("SELECT COUNT(*) AS n FROM customers")
    .get() as { n: number };

  const weekRevenue = db
    .prepare(
      "SELECT COALESCE(SUM(price_cents), 0) AS cents FROM jobs WHERE scheduled_at >= ? AND scheduled_at < ?"
    )
    .get(today.toISOString(), endOfWeek.toISOString()) as { cents: number };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of your window cleaning business.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Jobs today" value={todayJobs.length} />
        <Stat label="Jobs this week" value={weekCount.n} />
        <Stat label="Customers" value={customerCount.n} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat
          label="Projected revenue (7 days)"
          value={`$${(weekRevenue.cents / 100).toFixed(2)}`}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium">Today's schedule</h2>
          <Link
            href="/schedule"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Full schedule →
          </Link>
        </div>
        {todayJobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No jobs scheduled for today.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {todayJobs.map((j) => (
              <li key={j.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    {j.customer_name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {j.customer_address || "No address"}
                    {j.customer_phone ? ` · ${j.customer_phone}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-900">
                    {formatLocal(new Date(j.scheduled_at))}
                  </div>
                  <div className="text-xs text-slate-500">
                    {j.duration_minutes} min · ${(j.price_cents / 100).toFixed(2)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
