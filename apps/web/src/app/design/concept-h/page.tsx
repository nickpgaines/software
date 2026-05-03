import Link from "next/link";

export default function ConceptHPage() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <PreviewBar />
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <PageHeader />
        <KpiRow />
        <div className="grid grid-cols-3 gap-5 mt-5">
          <RevenueCard />
          <PipelineCard />
        </div>
        <div className="grid grid-cols-3 gap-5 mt-5">
          <ScheduleCard />
          <ActivityCard />
        </div>
      </div>
    </div>
  );
}

function TopNav() {
  const links = [
    { name: "Home", active: true },
    { name: "Schedule" },
    { name: "Leads" },
    { name: "Customers" },
    { name: "Map" },
    { name: "Reports" },
  ];
  return (
    <header className="bg-black text-white sticky top-11 z-10 border-b border-zinc-900">
      <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center gap-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white text-black text-[13px] font-extrabold flex items-center justify-center">
            N
          </div>
          <span className="font-bold tracking-tight text-[15px]">Nick360</span>
        </div>
        <nav className="flex items-center gap-1 flex-1">
          {links.map((l) => (
            <span
              key={l.name}
              className={
                "px-3.5 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-colors " +
                (l.active
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5")
              }
            >
              {l.name}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              placeholder="Search"
              className="w-64 bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-[13px] font-medium focus:outline-none focus:border-zinc-700 placeholder-zinc-500 text-white"
            />
            <svg className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </div>
          <button className="h-9 px-4 rounded-full bg-white text-black text-[13px] font-bold hover:bg-zinc-200">
            + New
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-zinc-800 text-[12px] flex items-center justify-center font-bold ring-2 ring-white/10">
            NG
          </div>
        </div>
      </div>
    </header>
  );
}

function PageHeader() {
  return (
    <div className="flex items-end justify-between gap-4 mb-7">
      <div>
        <p className="text-[12px] uppercase tracking-[0.18em] text-zinc-500 font-bold mb-2">
          Sunday · May 3
        </p>
        <h1 className="text-[36px] font-bold tracking-tight leading-tight text-white">
          Good afternoon, Nick.
        </h1>
        <p className="text-[14px] text-zinc-400 mt-1 font-medium">
          12 jobs today · 4 unread messages · 9 estimates pending
        </p>
      </div>
      <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700/60 rounded-full p-1">
        {["Today", "Week", "Month"].map((t, i) => (
          <button
            key={t}
            className={
              "px-3.5 py-1.5 rounded-full text-[12px] font-bold " +
              (i === 1 ? "bg-white text-black" : "text-zinc-400 hover:text-white")
            }
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiRow() {
  const k = [
    { label: "Revenue", value: "$48.2K", delta: "+12.4%", up: true, sub: "vs last week" },
    { label: "Jobs done", value: "73", delta: "+8", up: true, sub: "this week" },
    { label: "Close rate", value: "34%", delta: "−1.1%", up: false, sub: "vs last week" },
    { label: "Avg. ticket", value: "$612", delta: "+$24", up: true, sub: "this week" },
  ];
  return (
    <div className="grid grid-cols-4 gap-5">
      {k.map((m) => (
        <Card key={m.label}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] text-zinc-400 font-semibold">{m.label}</div>
              <span
                className={
                  "text-[11px] px-2 py-0.5 rounded-full tabular-nums font-bold " +
                  (m.up ? "bg-white text-black" : "bg-zinc-900 text-zinc-300 border border-zinc-700")
                }
              >
                {m.delta}
              </span>
            </div>
            <div className="text-[34px] font-bold tracking-tight tabular-nums leading-none text-white">
              {m.value}
            </div>
            <div className="text-[12px] text-zinc-500 mt-1.5 font-medium">{m.sub}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={
        "bg-zinc-800 rounded-2xl border border-zinc-700/60 shadow-[0_1px_2px_rgba(0,0,0,0.2)] " +
        className
      }
    >
      {children}
    </section>
  );
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-zinc-700/60 flex items-center justify-between">
      <div>
        <h3 className="text-[15px] font-bold tracking-tight text-white">{title}</h3>
        {subtitle && (
          <p className="text-[12px] text-zinc-500 font-medium mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function RevenueCard() {
  return (
    <Card className="col-span-2">
      <CardHeader
        title="Revenue"
        subtitle="Last 12 weeks"
        action={
          <div className="flex items-center gap-1 bg-zinc-900 rounded-full p-1">
            {["12W", "26W", "YTD"].map((t, i) => (
              <button
                key={t}
                className={
                  "px-3 py-1 rounded-full text-[11px] font-bold " +
                  (i === 0 ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white")
                }
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-5">
        <Area />
      </div>
    </Card>
  );
}

function Area() {
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
        <linearGradient id="hGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#hGrad)" />
      <path d={path} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
    <Card>
      <CardHeader title="Pipeline" subtitle="35 active opportunities" />
      <div className="p-5 space-y-4">
        {stages.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[13px] font-bold text-white">{s.name}</span>
              <span className="text-[11px] text-zinc-500 tabular-nums font-bold">
                {s.count} · {s.value}
              </span>
            </div>
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScheduleCard() {
  const jobs = [
    { time: "9:00", ampm: "AM", customer: "Marlene Patel", addr: "412 Birch Ln", status: "On the way", tech: "Jamal", price: "$420" },
    { time: "10:30", ampm: "AM", customer: "Forrester Group", addr: "88 Industrial Pkwy", status: "Scheduled", tech: "Aubrey", price: "$1,180" },
    { time: "12:15", ampm: "PM", customer: "Davies Residence", addr: "76 Cypress Cir", status: "Scheduled", tech: "Jamal", price: "$285" },
    { time: "2:00", ampm: "PM", customer: "Wei Office", addr: "1200 Market St", status: "Scheduled", tech: "Aubrey", price: "$640" },
  ];
  return (
    <Card className="col-span-2">
      <CardHeader
        title="Today's schedule"
        subtitle={`${jobs.length} of 12 visible`}
        action={
          <Link href="#" className="text-[12px] text-zinc-300 hover:text-white font-bold">
            View all →
          </Link>
        }
      />
      <div className="p-3">
        {jobs.map((j, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-900/60 transition-colors cursor-pointer"
          >
            <div className="text-center w-14">
              <div className="text-[19px] font-bold tabular-nums leading-none text-white">{j.time}</div>
              <div className="text-[10px] text-zinc-500 font-bold mt-1 tracking-wider">{j.ampm}</div>
            </div>
            <div className="w-px h-9 bg-zinc-700" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold truncate text-white">{j.customer}</div>
              <div className="text-[12px] text-zinc-500 truncate font-medium">{j.addr}</div>
            </div>
            <span
              className={
                "text-[11px] px-2.5 py-1 rounded-full font-bold " +
                (j.status === "On the way"
                  ? "bg-white text-black"
                  : "bg-zinc-900 text-zinc-300 border border-zinc-700")
              }
            >
              {j.status}
            </span>
            <div className="flex items-center gap-2 w-24 justify-end">
              <span className="inline-flex w-7 h-7 rounded-full bg-zinc-900 text-[10px] font-bold items-center justify-center text-zinc-300">
                {j.tech.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[12px] text-zinc-400 font-semibold">{j.tech}</span>
            </div>
            <div className="text-[14px] font-bold tabular-nums w-16 text-right text-white">
              {j.price}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActivityCard() {
  const items = [
    { who: "Aubrey", what: "completed Forrester job", when: "2m" },
    { who: "Jamal", what: "noted Davies", when: "14m" },
    { who: "Sasha", what: "won Patel estimate", when: "1h" },
    { who: "Aubrey", what: "rescheduled Rivera", when: "3h" },
    { who: "Nick", what: "invoiced Wei Office $640", when: "5h" },
  ];
  return (
    <Card>
      <CardHeader
        title="Activity"
        action={
          <span className="text-[10px] text-zinc-300 flex items-center gap-1.5 font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
          </span>
        }
      />
      <ul className="p-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2.5">
            <span className="inline-flex w-8 h-8 rounded-full bg-zinc-900 text-[11px] items-center justify-center font-bold text-zinc-200">
              {it.who[0]}
            </span>
            <div className="flex-1 text-[13px]">
              <span className="font-bold text-white">{it.who}</span>{" "}
              <span className="text-zinc-400 font-medium">{it.what}</span>
              <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums font-bold">{it.when} ago</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 text-[12px] sticky top-0 z-20">
      <Link href="/design" className="text-zinc-500 hover:text-white font-bold">
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight text-white">
        Concept H · <span className="text-zinc-500">Balanced Dark</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-600 font-bold">
        {["a", "b", "c", "d", "e", "f", "g", "h"].map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <Link href={`/design/concept-${s}`} className="hover:text-white">{s.toUpperCase()}</Link>
            {i < 7 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
