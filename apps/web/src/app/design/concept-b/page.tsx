import Link from "next/link";

export default function ConceptBPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <PreviewBar />
      <div className="max-w-[1400px] mx-auto px-12 py-10">
        <Header />
        <Hero />
        <KpiRow />
        <div className="grid grid-cols-12 gap-10 mt-16">
          <div className="col-span-8 space-y-16">
            <RevenueSection />
            <ScheduleSection />
          </div>
          <aside className="col-span-4 space-y-12">
            <PipelineSection />
            <TeamSection />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 pb-6 mb-12">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-black text-white text-[12px] font-semibold flex items-center justify-center">
            N
          </div>
          <span className="font-semibold tracking-tight text-[15px]">
            FORGE
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-[14px] text-neutral-500">
          <span className="text-neutral-900">Overview</span>
          <span className="hover:text-neutral-900 cursor-pointer">Schedule</span>
          <span className="hover:text-neutral-900 cursor-pointer">Leads</span>
          <span className="hover:text-neutral-900 cursor-pointer">Customers</span>
          <span className="hover:text-neutral-900 cursor-pointer">Reports</span>
          <span className="hover:text-neutral-900 cursor-pointer">Map</span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            placeholder="Search"
            className="w-64 bg-neutral-100 rounded-full pl-10 pr-3 py-2 text-[13px] focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-300"
          />
          <svg className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <button className="h-9 px-4 rounded-full bg-black text-white text-[13px] font-medium hover:bg-neutral-800">
          New job
        </button>
        <div className="w-9 h-9 rounded-full bg-neutral-200 text-[12px] flex items-center justify-center font-medium">
          NG
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="grid grid-cols-12 gap-10 items-end mb-16">
      <div className="col-span-7">
        <p className="text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-4">
          Sunday, May 3 — Week 18
        </p>
        <h1 className="text-[72px] leading-[0.95] font-semibold tracking-[-0.03em]">
          Good afternoon,
          <br />
          <span className="text-neutral-400">Nick.</span>
        </h1>
      </div>
      <div className="col-span-5">
        <p className="text-[16px] text-neutral-600 leading-relaxed max-w-md">
          You have <span className="text-neutral-900 font-medium">12 jobs</span>{" "}
          today across two crews and{" "}
          <span className="text-neutral-900 font-medium">9 estimates</span>{" "}
          waiting on a follow-up. Revenue is pacing 12% above last week.
        </p>
        <div className="flex items-center gap-2 mt-5">
          <button className="px-3 py-1.5 text-[13px] rounded-full border border-neutral-300 hover:border-neutral-900">
            View schedule
          </button>
          <button className="px-3 py-1.5 text-[13px] rounded-full border border-neutral-300 hover:border-neutral-900">
            Open inbox
          </button>
        </div>
      </div>
    </section>
  );
}

function KpiRow() {
  const k = [
    { label: "Revenue this week", value: "$48,210", delta: "+12.4%" },
    { label: "Jobs completed", value: "73", delta: "+8" },
    { label: "Close rate", value: "34.2%", delta: "−1.1%" },
    { label: "Avg. ticket", value: "$612", delta: "+$24" },
  ];
  return (
    <section className="grid grid-cols-4 gap-10 border-y border-neutral-200 py-10">
      {k.map((m) => (
        <div key={m.label}>
          <div className="text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
            {m.label}
          </div>
          <div className="text-[40px] font-semibold tracking-tight tabular-nums leading-none">
            {m.value}
          </div>
          <div className="text-[13px] text-neutral-500 mt-2 tabular-nums">
            {m.delta} <span className="text-neutral-400">vs last week</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function RevenueSection() {
  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
            §01
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Revenue
          </h2>
        </div>
        <div className="flex items-center gap-1 text-[13px] text-neutral-500">
          <button className="px-3 py-1 rounded-full hover:bg-neutral-100">12W</button>
          <button className="px-3 py-1 rounded-full bg-black text-white">26W</button>
          <button className="px-3 py-1 rounded-full hover:bg-neutral-100">YTD</button>
        </div>
      </div>
      <BigChart />
    </section>
  );
}

function BigChart() {
  const points = [42, 51, 47, 58, 49, 63, 55, 67, 60, 72, 65, 78, 70, 82, 76, 88, 80, 91, 85, 95, 88, 98, 92, 104, 97, 110];
  const max = 120;
  const w = 1000;
  const h = 220;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`)
    .join(" ");
  const fill = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <div className="border-t border-neutral-200 pt-6">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#g)" />
        <path d={path} stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[11px] text-neutral-400 mt-3 tabular-nums uppercase tracking-wider">
        <span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span>
      </div>
    </div>
  );
}

function ScheduleSection() {
  const jobs = [
    { time: "09:00", customer: "Marlene Patel", addr: "412 Birch Ln", price: "$420", tech: "Jamal" },
    { time: "10:30", customer: "Forrester Group", addr: "88 Industrial Pkwy", price: "$1,180", tech: "Aubrey" },
    { time: "12:15", customer: "Davies Residence", addr: "76 Cypress Cir", price: "$285", tech: "Jamal" },
    { time: "14:00", customer: "Wei Office", addr: "1200 Market St", price: "$640", tech: "Aubrey" },
    { time: "16:30", customer: "Rivera, T.", addr: "29 Maple Way", price: "$310", tech: "—" },
  ];
  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
            §02
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Today's schedule
          </h2>
        </div>
        <Link href="#" className="text-[13px] text-neutral-500 hover:text-neutral-900 underline underline-offset-4">
          Open full calendar
        </Link>
      </div>
      <div className="border-t border-neutral-200">
        {jobs.map((j, i) => (
          <div
            key={i}
            className="grid grid-cols-12 items-center py-5 border-b border-neutral-200 hover:bg-neutral-50 transition-colors px-1"
          >
            <div className="col-span-1 text-[13px] tabular-nums text-neutral-500">{j.time}</div>
            <div className="col-span-4 text-[16px] font-medium tracking-tight">{j.customer}</div>
            <div className="col-span-4 text-[14px] text-neutral-500">{j.addr}</div>
            <div className="col-span-2 text-[13px] text-neutral-500">{j.tech}</div>
            <div className="col-span-1 text-right text-[14px] font-medium tabular-nums">{j.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineSection() {
  const stages = [
    { name: "New leads", count: 12, value: "$5,400" },
    { name: "Contacted", count: 8, value: "$4,100" },
    { name: "Estimating", count: 9, value: "$8,920" },
    { name: "Won", count: 6, value: "$6,310" },
  ];
  const max = 12;
  return (
    <section>
      <p className="text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
        §03
      </p>
      <h2 className="text-2xl font-semibold tracking-tight mb-5">Pipeline</h2>
      <div className="space-y-4">
        {stages.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[14px] font-medium">{s.name}</span>
              <span className="text-[12px] text-neutral-500 tabular-nums">
                {s.count} · {s.value}
              </span>
            </div>
            <div className="h-[3px] bg-neutral-200">
              <div
                className="h-full bg-black"
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamSection() {
  const team = [
    { name: "Aubrey Tan", jobs: 14, revenue: "$8,420", initials: "AT" },
    { name: "Jamal Brooks", jobs: 11, revenue: "$6,180", initials: "JB" },
    { name: "Sasha Kim", jobs: 9, revenue: "$5,940", initials: "SK" },
  ];
  return (
    <section>
      <p className="text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
        §04
      </p>
      <h2 className="text-2xl font-semibold tracking-tight mb-5">
        Top performers
      </h2>
      <ul className="space-y-4">
        {team.map((t, i) => (
          <li key={t.name} className="flex items-center gap-3">
            <span className="text-[12px] text-neutral-400 w-4 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="w-9 h-9 rounded-full bg-neutral-100 text-[12px] flex items-center justify-center font-medium">
              {t.initials}
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-medium">{t.name}</div>
              <div className="text-[12px] text-neutral-500 tabular-nums">
                {t.jobs} jobs · {t.revenue}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-white border-b border-neutral-200 flex items-center justify-between px-6 text-[12px]">
      <Link href="/design" className="text-neutral-500 hover:text-neutral-900">
        ← All concepts
      </Link>
      <div className="font-medium tracking-tight">
        Concept B · <span className="text-neutral-500">Editorial</span>
      </div>
      <div className="flex items-center gap-1.5 text-neutral-400">
        <Link href="/design/concept-a" className="hover:text-neutral-900">A</Link>
        <span>·</span>
        <Link href="/design/concept-b" className="hover:text-neutral-900">B</Link>
        <span>·</span>
        <Link href="/design/concept-c" className="hover:text-neutral-900">C</Link>
        <span>·</span>
        <Link href="/design/concept-d" className="hover:text-neutral-900">D</Link>
      </div>
    </div>
  );
}
