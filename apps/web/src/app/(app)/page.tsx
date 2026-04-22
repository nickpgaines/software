import { getDb, type JobWithCustomer } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LeaderRow = {
  id: number;
  name: string;
  revenue_cents: number;
  job_count: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLocal(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const db = getDb();
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = startOfMonth(now);
  const monthEnd = startOfNextMonth(now);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const monthRevenue = db
    .prepare(
      "SELECT COALESCE(SUM(price_cents), 0) AS cents, COUNT(*) AS n FROM jobs WHERE scheduled_at >= ? AND scheduled_at < ?"
    )
    .get(monthStart.toISOString(), monthEnd.toISOString()) as {
    cents: number;
    n: number;
  };

  const todayJobs = db
    .prepare(
      `SELECT j.*,
              c.name AS customer_name,
              c.address AS customer_address,
              c.phone AS customer_phone,
              sp.name AS salesperson_name,
              tc.name AS technician_name
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN staff sp ON sp.id = j.salesperson_id
       LEFT JOIN staff tc ON tc.id = j.technician_id
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

  const salespeople = db
    .prepare(
      `SELECT s.id, s.name,
              COALESCE(SUM(j.price_cents), 0) AS revenue_cents,
              COUNT(j.id) AS job_count
       FROM staff s
       LEFT JOIN jobs j ON j.salesperson_id = s.id
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       GROUP BY s.id
       HAVING job_count > 0
       ORDER BY revenue_cents DESC, s.name COLLATE NOCASE ASC`
    )
    .all(monthStart.toISOString(), monthEnd.toISOString()) as LeaderRow[];

  const technicians = db
    .prepare(
      `SELECT s.id, s.name,
              COALESCE(SUM(j.price_cents), 0) AS revenue_cents,
              COUNT(j.id) AS job_count
       FROM staff s
       LEFT JOIN jobs j ON j.technician_id = s.id
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       GROUP BY s.id
       HAVING job_count > 0
       ORDER BY revenue_cents DESC, s.name COLLATE NOCASE ASC`
    )
    .all(monthStart.toISOString(), monthEnd.toISOString()) as LeaderRow[];

  const monthLabel = now.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl text-white px-6 py-12 sm:py-16 text-center shadow-lg">
        <p className="uppercase tracking-wider text-xs sm:text-sm text-blue-100">
          Monthly Revenue · {monthLabel}
        </p>
        <div className="mt-3 text-5xl sm:text-7xl font-bold tabular-nums tracking-tight">
          {formatMoney(monthRevenue.cents)}
        </div>
        <p className="mt-3 text-sm sm:text-base text-blue-100">
          {monthRevenue.n} {monthRevenue.n === 1 ? "job" : "jobs"} this month
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Leaderboard title="Salespeople" rows={salespeople} emptyHint="Assign a salesperson when creating a job." />
        <Leaderboard title="Technicians" rows={technicians} emptyHint="Assign a technician when creating a job." />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Jobs today" value={todayJobs.length} />
        <Stat label="Jobs this week" value={weekCount.n} />
        <Stat label="Customers" value={customerCount.n} />
      </section>

      <section className="bg-white border border-slate-200 rounded-lg">
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
                  {(j.salesperson_name || j.technician_name) && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {j.salesperson_name && <>Sold by {j.salesperson_name}</>}
                      {j.salesperson_name && j.technician_name && " · "}
                      {j.technician_name && <>Tech: {j.technician_name}</>}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-900">
                    {formatLocal(new Date(j.scheduled_at))}
                  </div>
                  <div className="text-xs text-slate-500">
                    {j.duration_minutes} min · {formatMoney(j.price_cents)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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

function Leaderboard({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: LeaderRow[];
  emptyHint: string;
}) {
  const max = rows[0]?.revenue_cents ?? 0;
  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <span className="text-xs text-slate-500">This month</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          No data yet. {emptyHint}
        </div>
      ) : (
        <ol className="divide-y divide-slate-200">
          {rows.map((r, i) => {
            const pct = max > 0 ? Math.round((r.revenue_cents / max) * 100) : 0;
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "w-6 text-center text-sm font-semibold " +
                      (i === 0
                        ? "text-yellow-500"
                        : i === 1
                        ? "text-slate-400"
                        : i === 2
                        ? "text-amber-700"
                        : "text-slate-400")
                    }
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900 truncate">
                        {r.name}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatMoney(r.revenue_cents)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {r.job_count} {r.job_count === 1 ? "job" : "jobs"}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
