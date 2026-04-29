import { getDb, type JobWithCustomer } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import RevenueChart from "@/components/RevenueChart";
import TodaySchedule from "@/components/TodaySchedule";

export const dynamic = "force-dynamic";

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default async function DashboardPage() {
  const db = await getDb();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayJobs = (await db
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
    .all(today.toISOString(), tomorrow.toISOString())) as JobWithCustomer[];

  const user = getSessionUser() || "there";
  const name = capitalize(user);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            {greeting(now.getHours())},{" "}
            <span className="text-sky-400">{name}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Welcome to your dashboard</p>
        </div>
        <div className="relative">
          <input
            type="search"
            placeholder="Search"
            className="bg-white border border-slate-200 rounded-full pl-10 pr-16 py-2.5 text-sm w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      <RevenueChart />

      <TodaySchedule initialJobs={todayJobs} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InboxCard />
        <TasksCard />
      </div>
    </div>
  );
}

function InboxCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Inbox</h3>
        <svg
          className="w-5 h-5 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div className="py-10 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="mt-3 font-medium text-slate-900">No recent conversations</p>
        <p className="text-sm text-slate-400 mt-1">
          New conversations will appear here.
        </p>
      </div>
    </div>
  );
}

function TasksCard() {
  const tabs = ["Upcoming", "Team", "Completed"];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Tasks</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            {tabs.map((t, i) => (
              <span
                key={t}
                className={
                  "px-2 py-1 " +
                  (i === 0 ? "text-slate-900 font-medium" : "text-slate-400")
                }
              >
                {t}
              </span>
            ))}
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-lg leading-none">
            +
          </button>
        </div>
      </div>
      <div className="py-10 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="mt-3 font-medium text-slate-900">No tasks found</p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          Tasks help your team stay organized. Create one to get started.
        </p>
      </div>
    </div>
  );
}
