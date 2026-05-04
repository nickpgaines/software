import Link from "next/link";

export default function ConceptDPage() {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <PreviewBar />
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="grid grid-cols-[260px_1fr] gap-6">
          <Sidebar />
          <main className="space-y-6">
            <TopCard />
            <KpiCards />
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <RevenueCard />
                <ScheduleCard />
              </div>
              <div className="space-y-6">
                <PipelineCard />
                <ActivityCard />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const sections = [
    {
      label: "Workspace",
      items: [
        { name: "Dashboard", icon: "▦", active: true, count: null },
        { name: "Schedule", icon: "◷", count: 12 },
        { name: "Map", icon: "◉", count: null },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { name: "Leads", icon: "↗", count: 38 },
        { name: "Estimates", icon: "≋", count: 9 },
        { name: "Jobs", icon: "✓", count: 24 },
        { name: "Invoices", icon: "$", count: 6 },
      ],
    },
    {
      label: "Communications",
      items: [
        { name: "Messages", icon: "✉", count: 4 },
        { name: "Calls", icon: "☏", count: null },
        { name: "Email", icon: "@", count: 2 },
      ],
    },
  ];
  return (
    <aside className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-5 sticky top-6 self-start">
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="w-9 h-9 rounded-2xl bg-stone-900 text-white text-[14px] font-semibold flex items-center justify-center">
          N
        </div>
        <div className="flex-1">
          <div className="font-semibold tracking-tight text-[15px]">FORGE</div>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-stone-400 px-2 mb-2">
              {s.label}
            </div>
            <ul className="space-y-1">
              {s.items.map((it) => (
                <li
                  key={it.name}
                  className={
                    "flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer text-[14px] transition-colors " +
                    (it.active
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-100")
                  }
                >
                  <span className={"w-5 text-center text-[13px] " + (it.active ? "text-white" : "text-stone-400")}>
                    {it.icon}
                  </span>
                  <span className="flex-1 truncate">{it.name}</span>
                  {it.count != null && (
                    <span
                      className={
                        "text-[11px] tabular-nums px-1.5 py-0.5 rounded-md " +
                        (it.active
                          ? "bg-white/15 text-white"
                          : "bg-stone-100 text-stone-500")
                      }
                    >
                      {it.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-stone-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-stone-200 text-[12px] flex items-center justify-center font-medium">
          NG
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">Nick Gaines</div>
          <div className="text-[11px] text-stone-500 truncate">Owner</div>
        </div>
        <button className="text-stone-400 hover:text-stone-900">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>
    </aside>
  );
}

function TopCard() {
  return (
    <div className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] px-7 py-6 flex items-center justify-between gap-6 flex-wrap">
      <div>
        <p className="text-[12px] uppercase tracking-[0.16em] text-stone-500 mb-1.5">
          Sunday · May 3
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Good afternoon, Nick.
        </h1>
        <p className="text-[14px] text-stone-500 mt-0.5">
          12 jobs today · 4 unread messages · 9 estimates pending
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search"
            className="w-64 bg-stone-100 rounded-full pl-10 pr-4 py-2.5 text-[13px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-stone-200"
          />
          <svg className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <button className="h-10 px-5 rounded-full bg-stone-900 text-white text-[13px] font-medium hover:bg-stone-800 shadow-sm">
          + New job
        </button>
      </div>
    </div>
  );
}

function KpiCards() {
  const k = [
    { label: "Revenue", value: "$48,210", delta: "+12.4%", sub: "vs last week", up: true },
    { label: "Jobs done", value: "73", delta: "+8", sub: "this week", up: true },
    { label: "Close rate", value: "34.2%", delta: "−1.1%", sub: "vs last week", up: false },
    { label: "Avg. ticket", value: "$612", delta: "+$24", sub: "this week", up: true },
  ];
  return (
    <div className="grid grid-cols-4 gap-4">
      {k.map((m) => (
        <div
          key={m.label}
          className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-5"
        >
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-stone-500">{m.label}</div>
            <div
              className={
                "text-[11px] px-2 py-0.5 rounded-full tabular-nums " +
                (m.up ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600")
              }
            >
              {m.delta}
            </div>
          </div>
          <div className="text-[30px] font-semibold tracking-tight tabular-nums mt-2 leading-none">
            {m.value}
          </div>
          <div className="text-[11px] text-stone-400 mt-1.5">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

function RevenueCard() {
  return (
    <section className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight">Revenue</h3>
          <p className="text-[12px] text-stone-500">Last 12 weeks</p>
        </div>
        <div className="flex items-center gap-1 text-[12px] bg-stone-100 rounded-full p-1">
          {["12W", "26W", "YTD"].map((t, i) => (
            <button
              key={t}
              className={
                "px-3 py-1 rounded-full " +
                (i === 0 ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <BigArea />
    </section>
  );
}

function BigArea() {
  const points = [42, 55, 38, 61, 47, 70, 58, 64, 72, 55, 80, 76];
  const max = 90;
  const w = 800;
  const h = 200;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`)
    .join(" ");
  const fill = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1c1917" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#dGrad)" />
      <path d={path} stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p / max) * h} r="3" fill="#fff" stroke="#1c1917" strokeWidth="2" />
      ))}
    </svg>
  );
}

function ScheduleCard() {
  const jobs = [
    { time: "9:00 AM", customer: "Marlene Patel", addr: "412 Birch Ln", status: "On the way", tech: "Jamal", price: "$420" },
    { time: "10:30 AM", customer: "Forrester Group", addr: "88 Industrial Pkwy", status: "Scheduled", tech: "Aubrey", price: "$1,180" },
    { time: "12:15 PM", customer: "Davies Residence", addr: "76 Cypress Cir", status: "Scheduled", tech: "Jamal", price: "$285" },
    { time: "2:00 PM", customer: "Wei Office", addr: "1200 Market St", status: "Scheduled", tech: "Aubrey", price: "$640" },
  ];
  return (
    <section className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight">Today's schedule</h3>
          <p className="text-[12px] text-stone-500">{jobs.length} of 12 visible</p>
        </div>
        <Link href="#" className="text-[12px] text-stone-500 hover:text-stone-900">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {jobs.map((j, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-stone-50 transition-colors"
          >
            <div className="text-center w-16">
              <div className="text-[11px] text-stone-400 uppercase tracking-wide">
                {j.time.split(" ")[1]}
              </div>
              <div className="text-[15px] font-semibold tabular-nums">
                {j.time.split(" ")[0]}
              </div>
            </div>
            <div className="w-px h-10 bg-stone-200" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium truncate">{j.customer}</div>
              <div className="text-[12px] text-stone-500 truncate">{j.addr}</div>
            </div>
            <span
              className={
                "text-[11px] px-2.5 py-1 rounded-full font-medium " +
                (j.status === "On the way"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600")
              }
            >
              {j.status}
            </span>
            <div className="flex items-center gap-2 w-28 justify-end">
              <span className="text-[12px] text-stone-500">{j.tech}</span>
            </div>
            <div className="text-[14px] font-semibold tabular-nums w-20 text-right">
              {j.price}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineCard() {
  const stages = [
    { name: "New leads", count: 12, value: "$5,400" },
    { name: "Contacted", count: 8, value: "$4,100" },
    { name: "Estimating", count: 9, value: "$8,920" },
    { name: "Won this week", count: 6, value: "$6,310" },
  ];
  const max = 12;
  return (
    <section className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-6">
      <h3 className="text-[16px] font-semibold tracking-tight">Pipeline</h3>
      <p className="text-[12px] text-stone-500 mb-4">35 active opportunities</p>
      <div className="space-y-4">
        {stages.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[13px] font-medium">{s.name}</span>
              <span className="text-[11px] text-stone-500 tabular-nums">
                {s.count} · {s.value}
              </span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-stone-900 rounded-full"
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityCard() {
  const items = [
    { who: "Aubrey", what: "completed Forrester job", when: "2m" },
    { who: "Jamal", what: "noted Davies", when: "14m" },
    { who: "Sasha", what: "won Patel estimate", when: "1h" },
    { who: "Aubrey", what: "rescheduled Rivera", when: "3h" },
  ];
  return (
    <section className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-semibold tracking-tight">Activity</h3>
        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-900" /> Live
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="inline-flex w-8 h-8 rounded-full bg-stone-100 text-[11px] items-center justify-center font-medium text-stone-700">
              {it.who[0]}
            </span>
            <div className="flex-1 text-[13px]">
              <span className="font-medium">{it.who}</span>{" "}
              <span className="text-stone-600">{it.what}</span>
              <div className="text-[11px] text-stone-400 mt-0.5 tabular-nums">{it.when} ago</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-stone-100 border-b border-stone-200 flex items-center justify-between px-6 text-[12px]">
      <Link href="/design" className="text-stone-500 hover:text-stone-900">
        ← All concepts
      </Link>
      <div className="font-medium tracking-tight">
        Concept D · <span className="text-stone-500">Soft</span>
      </div>
      <div className="flex items-center gap-1.5 text-stone-400">
        <Link href="/design/concept-a" className="hover:text-stone-900">A</Link>
        <span>·</span>
        <Link href="/design/concept-b" className="hover:text-stone-900">B</Link>
        <span>·</span>
        <Link href="/design/concept-c" className="hover:text-stone-900">C</Link>
        <span>·</span>
        <Link href="/design/concept-d" className="hover:text-stone-900">D</Link>
      </div>
    </div>
  );
}
