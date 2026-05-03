import Link from "next/link";

export default function ConceptFPage() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <PreviewBar />
      <div className="grid grid-cols-[280px_1fr] min-h-[calc(100vh-44px)] p-4 gap-4">
        <Sidebar />
        <main className="space-y-4">
          <Hero />
          <KpiCards />
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              <RevenueCard />
              <ScheduleCards />
            </div>
            <div className="space-y-4">
              <PipelineCard />
              <ActivityCard />
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
        { name: "Dashboard", icon: HomeIcon, active: true },
        { name: "Schedule", icon: CalendarIcon, count: 12 },
        { name: "Map", icon: MapIcon },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { name: "Leads", icon: BoltIcon, count: 38 },
        { name: "Estimates", icon: DocIcon, count: 9 },
        { name: "Jobs", icon: CheckIcon, count: 24 },
        { name: "Invoices", icon: CashIcon, count: 6 },
      ],
    },
    {
      label: "Inbox",
      items: [
        { name: "Messages", icon: ChatIcon, count: 4 },
        { name: "Calls", icon: PhoneIcon },
        { name: "Email", icon: MailIcon, count: 2 },
      ],
    },
  ] as { label: string; items: { name: string; icon: () => JSX.Element; active?: boolean; count?: number }[] }[];

  return (
    <aside className="bg-white rounded-3xl p-5 flex flex-col sticky top-4 self-start h-[calc(100vh-72px)]">
      <div className="flex items-center gap-3 mb-7 px-1">
        <div className="w-10 h-10 rounded-2xl bg-neutral-950 text-white text-[15px] font-extrabold flex items-center justify-center">
          N
        </div>
        <div className="flex-1">
          <div className="font-bold tracking-tight text-[16px]">Nick360</div>
          <div className="text-[12px] text-neutral-500 font-medium">Window cleaning</div>
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-auto">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-400 px-2 mb-2 font-bold">
              {s.label}
            </div>
            <ul className="space-y-1">
              {s.items.map((it) => {
                const Icon = it.icon;
                return (
                  <li
                    key={it.name}
                    className={
                      "flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer text-[14px] font-semibold transition-colors " +
                      (it.active
                        ? "bg-neutral-950 text-white"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950")
                    }
                  >
                    <span className={"w-5 h-5 flex items-center justify-center " + (it.active ? "text-white" : "text-neutral-400")}>
                      <Icon />
                    </span>
                    <span className="flex-1 truncate">{it.name}</span>
                    {it.count != null && (
                      <span
                        className={
                          "text-[11px] tabular-nums font-bold px-2 py-0.5 rounded-full " +
                          (it.active ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-600")
                        }
                      >
                        {it.count}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 p-3 rounded-2xl bg-neutral-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-neutral-200 text-[13px] font-bold flex items-center justify-center text-neutral-700">
          NG
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold truncate">Nick Gaines</div>
          <div className="text-[11px] text-neutral-500 truncate font-medium">Owner</div>
        </div>
      </div>
    </aside>
  );
}

function Hero() {
  return (
    <div className="bg-white rounded-3xl p-7 flex items-center justify-between gap-6 flex-wrap">
      <div>
        <p className="text-[12px] uppercase tracking-[0.18em] text-neutral-500 font-bold mb-2">
          Sunday · May 3
        </p>
        <h1 className="text-[34px] font-bold tracking-tight leading-tight">
          Good afternoon, Nick.
        </h1>
        <p className="text-[15px] text-neutral-500 mt-1 font-medium">
          12 jobs today · 4 unread messages
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search anything"
            className="w-72 bg-neutral-100 rounded-full pl-11 pr-4 py-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-neutral-300 placeholder-neutral-400"
          />
          <svg className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <button className="h-12 px-6 rounded-full bg-neutral-950 text-white text-[14px] font-bold hover:bg-neutral-800">
          + New job
        </button>
      </div>
    </div>
  );
}

function KpiCards() {
  const k = [
    { label: "Revenue", value: "$48.2K", delta: "+12.4%", up: true },
    { label: "Jobs done", value: "73", delta: "+8", up: true },
    { label: "Close rate", value: "34%", delta: "−1.1%", up: false },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {k.map((m) => (
        <div key={m.label} className="bg-white rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] text-neutral-500 font-semibold">{m.label}</div>
            <div
              className={
                "text-[12px] px-2.5 py-1 rounded-full tabular-nums font-bold " +
                (m.up ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600")
              }
            >
              {m.delta}
            </div>
          </div>
          <div className="text-[44px] font-bold tracking-tight tabular-nums leading-none">
            {m.value}
          </div>
          <div className="text-[12px] text-neutral-500 mt-2 font-medium">vs last week</div>
        </div>
      ))}
    </div>
  );
}

function RevenueCard() {
  return (
    <section className="bg-white rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[18px] font-bold tracking-tight">Revenue</h3>
          <p className="text-[13px] text-neutral-500 font-medium">Last 12 weeks</p>
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
          {["12W", "26W", "YTD"].map((t, i) => (
            <button
              key={t}
              className={
                "px-3.5 py-1.5 rounded-full text-[12px] font-bold " +
                (i === 0 ? "bg-neutral-950 text-white" : "text-neutral-500 hover:text-neutral-950")
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#171717" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#171717" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#fGrad)" />
      <path d={path} stroke="#171717" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScheduleCards() {
  const jobs = [
    { time: "9:00", ampm: "AM", customer: "Marlene Patel", addr: "412 Birch Ln", status: "On the way", tech: "Jamal", price: "$420" },
    { time: "10:30", ampm: "AM", customer: "Forrester Group", addr: "88 Industrial Pkwy", status: "Scheduled", tech: "Aubrey", price: "$1,180" },
    { time: "12:15", ampm: "PM", customer: "Davies Residence", addr: "76 Cypress Cir", status: "Scheduled", tech: "Jamal", price: "$285" },
    { time: "2:00", ampm: "PM", customer: "Wei Office", addr: "1200 Market St", status: "Scheduled", tech: "Aubrey", price: "$640" },
  ];
  return (
    <section className="bg-white rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[18px] font-bold tracking-tight">Today's schedule</h3>
          <p className="text-[13px] text-neutral-500 font-medium">{jobs.length} of 12 visible</p>
        </div>
        <Link href="#" className="text-[13px] text-neutral-600 font-bold hover:text-neutral-950">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {jobs.map((j, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200/70 transition-colors cursor-pointer"
          >
            <div className="text-center w-14">
              <div className="text-[20px] font-bold tabular-nums leading-none">{j.time}</div>
              <div className="text-[10px] text-neutral-500 font-bold mt-1 tracking-wider">{j.ampm}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold truncate">{j.customer}</div>
              <div className="text-[13px] text-neutral-500 truncate font-medium">{j.addr}</div>
            </div>
            <span
              className={
                "text-[11px] px-3 py-1 rounded-full font-bold " +
                (j.status === "On the way"
                  ? "bg-neutral-950 text-white"
                  : "bg-white text-neutral-700")
              }
            >
              {j.status}
            </span>
            <div className="text-[15px] font-bold tabular-nums w-20 text-right">
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
    { name: "New leads", count: 12, value: "$5.4K" },
    { name: "Contacted", count: 8, value: "$4.1K" },
    { name: "Estimating", count: 9, value: "$8.9K" },
    { name: "Won", count: 6, value: "$6.3K" },
  ];
  const max = 12;
  return (
    <section className="bg-white rounded-3xl p-6">
      <h3 className="text-[18px] font-bold tracking-tight">Pipeline</h3>
      <p className="text-[13px] text-neutral-500 font-medium mb-5">35 active</p>
      <div className="space-y-4">
        {stages.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[14px] font-bold">{s.name}</span>
              <span className="text-[12px] text-neutral-500 tabular-nums font-bold">
                {s.count} · {s.value}
              </span>
            </div>
            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-950 rounded-full"
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
    { who: "Aubrey", what: "completed Forrester", when: "2m" },
    { who: "Jamal", what: "noted Davies", when: "14m" },
    { who: "Sasha", what: "won Patel estimate", when: "1h" },
    { who: "Aubrey", what: "rescheduled Rivera", when: "3h" },
  ];
  return (
    <section className="bg-white rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-bold tracking-tight">Activity</h3>
        <span className="text-[11px] text-neutral-700 flex items-center gap-1.5 font-bold">
          <span className="w-2 h-2 rounded-full bg-neutral-950" /> LIVE
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="inline-flex w-9 h-9 rounded-full bg-neutral-100 text-[12px] items-center justify-center font-bold text-neutral-800">
              {it.who[0]}
            </span>
            <div className="flex-1 text-[13px]">
              <span className="font-bold">{it.who}</span>{" "}
              <span className="text-neutral-600 font-medium">{it.what}</span>
              <div className="text-[11px] text-neutral-400 mt-0.5 tabular-nums font-bold">{it.when} ago</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between px-4 text-[12px]">
      <Link href="/design" className="text-neutral-500 hover:text-neutral-950 font-bold">
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight text-neutral-950">
        Concept F · <span className="text-neutral-500">Bold Light</span>
      </div>
      <div className="flex items-center gap-1.5 text-neutral-400 font-bold">
        <Link href="/design/concept-a" className="hover:text-neutral-950">A</Link>
        <span>·</span>
        <Link href="/design/concept-b" className="hover:text-neutral-950">B</Link>
        <span>·</span>
        <Link href="/design/concept-c" className="hover:text-neutral-950">C</Link>
        <span>·</span>
        <Link href="/design/concept-d" className="hover:text-neutral-950">D</Link>
        <span>·</span>
        <Link href="/design/concept-e" className="hover:text-neutral-950">E</Link>
        <span>·</span>
        <Link href="/design/concept-f" className="hover:text-neutral-950">F</Link>
      </div>
    </div>
  );
}

function HomeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></svg>; }
function CalendarIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>; }
function MapIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v16M15 6v16" /></svg>; }
function BoltIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="m13 2-9 12h7l-1 8 9-12h-7z" /></svg>; }
function DocIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M20 6 9 17l-5-5" /></svg>; }
function CashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg>; }
function ChatIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function PhoneIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7 13 13 0 0 0 .7 2.8 2 2 0 0 1-.5 2L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2-.5 13 13 0 0 0 2.8.7 2 2 0 0 1 1.7 2z" /></svg>; }
function MailIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>; }
