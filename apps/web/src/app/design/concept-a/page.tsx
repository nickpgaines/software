import Link from "next/link";

export default function ConceptAPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <PreviewBar concept="A" name="Linear" />
      <div className="grid grid-cols-[220px_1fr] min-h-[calc(100vh-44px)]">
        <Sidebar />
        <main className="bg-white border-l border-zinc-200">
          <TopBar />
          <div className="px-8 py-6 space-y-6">
            <Header />
            <KpiStrip />
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <RevenueChart />
                <Schedule />
              </div>
              <div className="space-y-6">
                <Pipeline />
                <Activity />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  const sections = [
    {
      label: "Workspace",
      items: [
        { name: "Dashboard", active: true, count: null },
        { name: "Schedule", count: 12 },
        { name: "Map", count: null },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { name: "Leads", count: 38 },
        { name: "Estimates", count: 9 },
        { name: "Jobs", count: 24 },
        { name: "Invoices", count: 6 },
      ],
    },
    {
      label: "Inbox",
      items: [
        { name: "Messages", count: 4 },
        { name: "Calls", count: null },
        { name: "Email", count: 2 },
      ],
    },
    {
      label: "Team",
      items: [
        { name: "Customers", count: null },
        { name: "Employees", count: null },
        { name: "Leaderboard", count: null },
      ],
    },
  ];
  return (
    <aside className="bg-zinc-50 px-3 py-4 text-sm">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-4">
        <div className="w-6 h-6 rounded-md bg-zinc-900 text-white text-[11px] font-semibold flex items-center justify-center">
          N
        </div>
        <div className="flex-1 truncate font-semibold tracking-tight">
          Forge CRM
        </div>
        <kbd className="text-[10px] text-zinc-400 border border-zinc-200 rounded px-1 py-0.5 bg-white">
          ⌘K
        </kbd>
      </div>

      <div className="space-y-5">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 px-2 mb-1.5">
              {s.label}
            </div>
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <li
                  key={it.name}
                  className={
                    "flex items-center justify-between px-2 py-1 rounded-md cursor-pointer " +
                    (it.active
                      ? "bg-white border border-zinc-200 text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                      : "text-zinc-600 hover:bg-white hover:text-zinc-900")
                  }
                >
                  <span className="truncate">{it.name}</span>
                  {it.count != null && (
                    <span className="text-[11px] tabular-nums text-zinc-400">
                      {it.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 right-3 hidden">
        {/* placeholder for footer */}
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-8 text-sm">
      <div className="flex items-center gap-2 text-zinc-500">
        <span>Workspace</span>
        <span className="text-zinc-300">/</span>
        <span className="text-zinc-900 font-medium">Dashboard</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search jobs, customers, leads…"
            className="w-72 bg-zinc-50 border border-zinc-200 rounded-md pl-7 pr-12 py-1.5 text-[13px] focus:outline-none focus:border-zinc-400"
          />
          <svg className="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">⌘K</kbd>
        </div>
        <button className="h-7 px-3 text-[13px] rounded-md border border-zinc-200 hover:border-zinc-300 bg-white">
          Invite
        </button>
        <button className="h-7 px-3 text-[13px] rounded-md bg-zinc-900 text-white hover:bg-zinc-800">
          New job
        </button>
        <div className="w-7 h-7 rounded-full bg-zinc-200 text-[11px] flex items-center justify-center font-medium">
          NG
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good afternoon, Nick.
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Sunday, May 3 · 12 jobs scheduled · 4 unread messages
        </p>
      </div>
      <div className="flex items-center gap-1 text-[13px] bg-zinc-50 border border-zinc-200 rounded-md p-0.5">
        {["Today", "Week", "Month", "Quarter"].map((t, i) => (
          <button
            key={t}
            className={
              "px-2.5 py-1 rounded " +
              (i === 1 ? "bg-white shadow-sm border border-zinc-200" : "text-zinc-500")
            }
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiStrip() {
  const k = [
    { label: "Revenue", value: "$48,210", delta: "+12.4%", up: true, sub: "vs last week" },
    { label: "Jobs completed", value: "73", delta: "+8", up: true, sub: "this week" },
    { label: "Close rate", value: "34.2%", delta: "−1.1%", up: false, sub: "vs last week" },
    { label: "Avg. ticket", value: "$612", delta: "+$24", up: true, sub: "this week" },
  ];
  return (
    <div className="grid grid-cols-4 gap-px bg-zinc-200 border border-zinc-200 rounded-lg overflow-hidden">
      {k.map((m) => (
        <div key={m.label} className="bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            {m.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-semibold tabular-nums tracking-tight">
              {m.value}
            </div>
            <div className={"text-[12px] tabular-nums " + (m.up ? "text-zinc-900" : "text-zinc-500")}>
              {m.delta}
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{m.sub}</div>
          <Sparkline up={m.up} />
        </div>
      ))}
    </div>
  );
}

function Sparkline({ up }: { up: boolean }) {
  const path = up
    ? "M0 22 L10 18 L20 20 L30 12 L40 14 L50 8 L60 10 L70 4"
    : "M0 6 L10 10 L20 8 L30 14 L40 12 L50 18 L60 16 L70 22";
  return (
    <svg viewBox="0 0 70 24" className="w-full h-6 mt-2">
      <path d={path} stroke="currentColor" strokeWidth="1.5" fill="none" className="text-zinc-900" />
    </svg>
  );
}

function RevenueChart() {
  return (
    <section className="border border-zinc-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Revenue</h3>
          <p className="text-xs text-zinc-500">Last 12 weeks</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-zinc-900 rounded-sm" /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-zinc-300 rounded-sm" /> Forecast</span>
        </div>
      </div>
      <div className="p-5">
        <BarChart />
      </div>
    </section>
  );
}

function BarChart() {
  const bars = [42, 55, 38, 61, 47, 70, 58, 64, 72, 55, 80, 76];
  const labels = ["W08", "W09", "W10", "W11", "W12", "W13", "W14", "W15", "W16", "W17", "W18", "W19"];
  const max = 90;
  return (
    <div>
      <div className="flex items-end gap-3 h-40">
        {bars.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
            <div
              className={"w-full rounded-sm " + (i >= bars.length - 2 ? "bg-zinc-300" : "bg-zinc-900")}
              style={{ height: `${(v / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {labels.map((l) => (
          <div key={l} className="flex-1 text-center text-[10px] text-zinc-400 tabular-nums">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Schedule() {
  const jobs = [
    { time: "9:00 AM", customer: "Marlene Patel", addr: "412 Birch Ln", status: "On the way", tech: "JB", price: "$420" },
    { time: "10:30 AM", customer: "Forrester Group", addr: "88 Industrial Pkwy", status: "Scheduled", tech: "AT", price: "$1,180" },
    { time: "12:15 PM", customer: "Davies Residence", addr: "76 Cypress Cir", status: "Scheduled", tech: "JB", price: "$285" },
    { time: "2:00 PM", customer: "Wei Office", addr: "1200 Market St", status: "Scheduled", tech: "AT", price: "$640" },
    { time: "4:30 PM", customer: "Rivera, T.", addr: "29 Maple Way", status: "Tentative", tech: "—", price: "$310" },
  ];
  return (
    <section className="border border-zinc-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
        <h3 className="text-sm font-semibold tracking-tight">Today's schedule</h3>
        <Link href="#" className="text-[12px] text-zinc-500 hover:text-zinc-900">
          View all →
        </Link>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="text-left font-normal px-5 py-2">Time</th>
            <th className="text-left font-normal px-5 py-2">Customer</th>
            <th className="text-left font-normal px-5 py-2">Address</th>
            <th className="text-left font-normal px-5 py-2">Status</th>
            <th className="text-left font-normal px-5 py-2">Tech</th>
            <th className="text-right font-normal px-5 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j, i) => (
            <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-5 py-2.5 tabular-nums text-zinc-700">{j.time}</td>
              <td className="px-5 py-2.5 font-medium">{j.customer}</td>
              <td className="px-5 py-2.5 text-zinc-500">{j.addr}</td>
              <td className="px-5 py-2.5">
                <StatusPill label={j.status} />
              </td>
              <td className="px-5 py-2.5">
                <span className="inline-flex w-6 h-6 rounded-full bg-zinc-100 text-[10px] items-center justify-center font-medium text-zinc-700">
                  {j.tech}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums font-medium">{j.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StatusPill({ label }: { label: string }) {
  const map: Record<string, string> = {
    "On the way": "bg-zinc-900 text-white",
    Scheduled: "bg-zinc-100 text-zinc-700",
    Tentative: "border border-dashed border-zinc-300 text-zinc-500",
  };
  return (
    <span className={"inline-block text-[11px] px-2 py-0.5 rounded-full " + (map[label] || "bg-zinc-100 text-zinc-700")}>
      {label}
    </span>
  );
}

function Pipeline() {
  const stages = [
    { name: "New leads", count: 12, value: "$5,400" },
    { name: "Contacted", count: 8, value: "$4,100" },
    { name: "Estimating", count: 9, value: "$8,920" },
    { name: "Won this week", count: 6, value: "$6,310" },
  ];
  return (
    <section className="border border-zinc-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
        <h3 className="text-sm font-semibold tracking-tight">Pipeline</h3>
        <span className="text-[11px] text-zinc-400">35 active</span>
      </div>
      <div className="p-3 space-y-2">
        {stages.map((s, i) => {
          const max = 12;
          const pct = (s.count / max) * 100;
          return (
            <div key={i} className="px-2 py-1.5">
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="text-zinc-700">{s.name}</span>
                <span className="text-zinc-400 tabular-nums">{s.count} · {s.value}</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Activity() {
  const items = [
    { who: "Aubrey", what: "marked Forrester job complete", when: "2m" },
    { who: "Jamal", what: "added a note to Davies", when: "14m" },
    { who: "Sasha", what: "won estimate Patel", when: "1h" },
    { who: "Aubrey", what: "rescheduled Rivera to Wed", when: "3h" },
    { who: "Nick", what: "invoiced Wei Office $640", when: "5h" },
  ];
  return (
    <section className="border border-zinc-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
        <h3 className="text-sm font-semibold tracking-tight">Activity</h3>
        <span className="text-[11px] text-zinc-400">Live</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {items.map((it, i) => (
          <li key={i} className="px-5 py-2.5 text-[13px] flex items-start gap-3">
            <span className="inline-flex w-6 h-6 mt-0.5 rounded-full bg-zinc-100 text-[10px] items-center justify-center font-medium text-zinc-700">
              {it.who[0]}
            </span>
            <div className="flex-1">
              <span className="font-medium">{it.who}</span>{" "}
              <span className="text-zinc-600">{it.what}</span>
            </div>
            <span className="text-[11px] text-zinc-400 tabular-nums">{it.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewBar({ concept, name }: { concept: string; name: string }) {
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px]">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-900">
        ← All concepts
      </Link>
      <div className="font-medium tracking-tight">
        Concept {concept} · <span className="text-zinc-500">{name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400">
        <Link href="/design/concept-a" className="hover:text-zinc-900">A</Link>
        <span>·</span>
        <Link href="/design/concept-b" className="hover:text-zinc-900">B</Link>
        <span>·</span>
        <Link href="/design/concept-c" className="hover:text-zinc-900">C</Link>
        <span>·</span>
        <Link href="/design/concept-d" className="hover:text-zinc-900">D</Link>
      </div>
    </div>
  );
}
