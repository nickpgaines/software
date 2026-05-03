import Link from "next/link";

export default function ConceptCPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <PreviewBar />
      <div className="grid grid-cols-[240px_1fr] min-h-[calc(100vh-44px)]">
        <Sidebar />
        <main className="border-l border-zinc-900">
          <TopBar />
          <div className="px-8 py-7 space-y-7">
            <Header />
            <KpiStrip />
            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-2 space-y-5">
                <RevenueChart />
                <Schedule />
              </div>
              <div className="space-y-5">
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
        { name: "Dashboard", active: true },
        { name: "Schedule", count: 12 },
        { name: "Map" },
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
        { name: "Calls" },
        { name: "Email", count: 2 },
      ],
    },
  ] as { label: string; items: { name: string; active?: boolean; count?: number }[] }[];

  return (
    <aside className="bg-black px-3 py-4 text-sm flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-5">
        <div className="w-7 h-7 rounded-lg bg-white text-black text-[12px] font-semibold flex items-center justify-center">
          N
        </div>
        <div className="flex-1 truncate font-semibold tracking-tight">Nick360</div>
        <kbd className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-1 py-0.5">
          ⌘K
        </kbd>
      </div>

      <div className="space-y-5 flex-1">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 px-2 mb-1.5">
              {s.label}
            </div>
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <li
                  key={it.name}
                  className={
                    "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-[13px] " +
                    (it.active
                      ? "bg-zinc-900 text-white border border-zinc-800"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100")
                  }
                >
                  <span className="truncate">{it.name}</span>
                  {it.count != null && (
                    <span className="text-[11px] tabular-nums text-zinc-500">
                      {it.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-zinc-800 text-[12px] flex items-center justify-center font-medium">
          NG
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">Nick Gaines</div>
          <div className="text-[11px] text-zinc-500 truncate">Owner · Nick360</div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <div className="h-12 border-b border-zinc-900 flex items-center justify-between px-8 text-sm">
      <div className="flex items-center gap-2 text-zinc-500">
        <span>Workspace</span>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-100 font-medium">Dashboard</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search jobs, customers, leads…"
            className="w-72 bg-zinc-950 border border-zinc-800 rounded-md pl-7 pr-12 py-1.5 text-[13px] focus:outline-none focus:border-zinc-600 placeholder-zinc-600 text-zinc-100"
          />
          <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">⌘K</kbd>
        </div>
        <button className="h-7 px-3 text-[13px] rounded-md border border-zinc-800 hover:border-zinc-700 text-zinc-200">
          Invite
        </button>
        <button className="h-7 px-3 text-[13px] rounded-md bg-white text-black hover:bg-zinc-200 font-medium">
          New job
        </button>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Good afternoon, Nick.
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Sunday, May 3 · 12 jobs scheduled · 4 unread messages
        </p>
      </div>
      <div className="flex items-center gap-1 text-[13px] bg-zinc-950 border border-zinc-900 rounded-md p-0.5">
        {["Today", "Week", "Month", "Quarter"].map((t, i) => (
          <button
            key={t}
            className={
              "px-2.5 py-1 rounded " +
              (i === 1 ? "bg-zinc-900 text-white border border-zinc-800" : "text-zinc-500 hover:text-zinc-200")
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
    { label: "Revenue", value: "$48,210", delta: "+12.4%", sub: "vs last week" },
    { label: "Jobs completed", value: "73", delta: "+8", sub: "this week" },
    { label: "Close rate", value: "34.2%", delta: "−1.1%", sub: "vs last week" },
    { label: "Avg. ticket", value: "$612", delta: "+$24", sub: "this week" },
  ];
  return (
    <div className="grid grid-cols-4 gap-px bg-zinc-900 border border-zinc-900 rounded-xl overflow-hidden">
      {k.map((m) => (
        <div key={m.label} className="bg-black p-5 hover:bg-zinc-950/40 transition-colors">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            {m.label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <div className="text-[28px] font-semibold tabular-nums tracking-tight text-white">
              {m.value}
            </div>
            <div className="text-[12px] tabular-nums text-zinc-400">
              {m.delta}
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{m.sub}</div>
          <Sparkline />
        </div>
      ))}
    </div>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 100 28" className="w-full h-7 mt-3 overflow-visible">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 24 L12 20 L24 22 L36 14 L48 16 L60 8 L72 10 L84 4 L100 6 L100 28 L0 28 Z"
        fill="url(#sg)"
      />
      <path
        d="M0 24 L12 20 L24 22 L36 14 L48 16 L60 8 L72 10 L84 4 L100 6"
        stroke="#fff"
        strokeWidth="1.25"
        fill="none"
      />
    </svg>
  );
}

function RevenueChart() {
  return (
    <section className="border border-zinc-900 rounded-xl bg-zinc-950/40">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Revenue</h3>
          <p className="text-xs text-zinc-500">Last 12 weeks</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-white rounded-sm" /> Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-zinc-700 rounded-sm" /> Forecast
          </span>
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
      <div className="flex items-end gap-3 h-44">
        {bars.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end">
            <div
              className={"w-full rounded " + (i >= bars.length - 2 ? "bg-zinc-700" : "bg-white")}
              style={{ height: `${(v / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {labels.map((l) => (
          <div key={l} className="flex-1 text-center text-[10px] text-zinc-600 tabular-nums">
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
    <section className="border border-zinc-900 rounded-xl bg-zinc-950/40">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
        <h3 className="text-sm font-semibold tracking-tight">Today's schedule</h3>
        <Link href="#" className="text-[12px] text-zinc-500 hover:text-zinc-200">
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
            <tr key={i} className="border-t border-zinc-900 hover:bg-zinc-900/40">
              <td className="px-5 py-2.5 tabular-nums text-zinc-400">{j.time}</td>
              <td className="px-5 py-2.5 font-medium text-white">{j.customer}</td>
              <td className="px-5 py-2.5 text-zinc-500">{j.addr}</td>
              <td className="px-5 py-2.5">
                <StatusPill label={j.status} />
              </td>
              <td className="px-5 py-2.5">
                <span className="inline-flex w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] items-center justify-center font-medium text-zinc-200">
                  {j.tech}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums font-medium text-white">{j.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StatusPill({ label }: { label: string }) {
  const map: Record<string, string> = {
    "On the way": "bg-white text-black",
    Scheduled: "bg-zinc-900 border border-zinc-800 text-zinc-300",
    Tentative: "border border-dashed border-zinc-700 text-zinc-500",
  };
  return (
    <span className={"inline-block text-[11px] px-2 py-0.5 rounded-full " + (map[label] || "bg-zinc-900 text-zinc-300")}>
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
  const max = 12;
  return (
    <section className="border border-zinc-900 rounded-xl bg-zinc-950/40">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
        <h3 className="text-sm font-semibold tracking-tight">Pipeline</h3>
        <span className="text-[11px] text-zinc-500">35 active</span>
      </div>
      <div className="p-4 space-y-3">
        {stages.map((s) => (
          <div key={s.name} className="px-1">
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-zinc-300">{s.name}</span>
              <span className="text-zinc-500 tabular-nums">{s.count} · {s.value}</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
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
    <section className="border border-zinc-900 rounded-xl bg-zinc-950/40">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
        <h3 className="text-sm font-semibold tracking-tight">Activity</h3>
        <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Live
        </span>
      </div>
      <ul className="divide-y divide-zinc-900">
        {items.map((it, i) => (
          <li key={i} className="px-5 py-3 text-[13px] flex items-start gap-3">
            <span className="inline-flex w-6 h-6 mt-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] items-center justify-center font-medium text-zinc-200">
              {it.who[0]}
            </span>
            <div className="flex-1">
              <span className="font-medium text-white">{it.who}</span>{" "}
              <span className="text-zinc-400">{it.what}</span>
            </div>
            <span className="text-[11px] text-zinc-500 tabular-nums">{it.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-black border-b border-zinc-900 flex items-center justify-between px-4 text-[12px]">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-100">
        ← All concepts
      </Link>
      <div className="font-medium tracking-tight text-zinc-100">
        Concept C · <span className="text-zinc-500">Obsidian</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-600">
        <Link href="/design/concept-a" className="hover:text-zinc-100">A</Link>
        <span>·</span>
        <Link href="/design/concept-b" className="hover:text-zinc-100">B</Link>
        <span>·</span>
        <Link href="/design/concept-c" className="hover:text-zinc-100">C</Link>
        <span>·</span>
        <Link href="/design/concept-d" className="hover:text-zinc-100">D</Link>
      </div>
    </div>
  );
}
