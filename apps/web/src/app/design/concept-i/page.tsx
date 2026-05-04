import Link from "next/link";
import { NAV_ITEMS, KPIS, JOBS, STAGES, NavIcon, ChartArea } from "../_shared";

// Concept I — "Cobalt"
// Light-mid grey canvas (zinc-200) + white cards + electric blue accent
const T = {
  bg: "bg-zinc-200",
  sidebar: "bg-white border-r border-zinc-300/70",
  card: "bg-white border border-zinc-300/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  text: "text-zinc-950",
  muted: "text-zinc-500",
  divider: "border-zinc-200",
  accent: "bg-blue-600 text-white",
  accentSoft: "bg-blue-50 text-blue-700",
  accentRing: "ring-blue-600",
};

export default function ConceptIPage() {
  return (
    <div className={`min-h-screen ${T.bg} ${T.text}`}>
      <PreviewBar />
      <div className="grid grid-cols-[260px_1fr] min-h-[calc(100vh-44px)]">
        <Sidebar />
        <main>
          <Header />
          <div className="px-8 pb-10 space-y-5">
            <KpiRow />
            <div className="grid grid-cols-3 gap-5">
              <ChartCard />
              <PipelineCard />
            </div>
            <ScheduleCard />
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className={`${T.sidebar} flex flex-col px-4 py-5`}>
      <div className="flex items-center gap-2.5 px-2 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white text-[14px] font-extrabold flex items-center justify-center">
          N
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight text-[15px]">Nick360</div>
        </div>
      </div>

      <button className="flex items-center gap-2 mb-5 mx-1 h-10 rounded-xl bg-blue-600 text-white text-[13px] font-bold hover:bg-blue-700 px-3 shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
        <NavIcon name="plus" /> New
      </button>

      <ul className="space-y-0.5 flex-1 overflow-auto">
        {NAV_ITEMS.map((it) => (
          <li
            key={it.name}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-[13.5px] font-semibold transition-colors " +
              (it.active
                ? "bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.20)]"
                : "text-zinc-700 hover:bg-zinc-100")
            }
          >
            <NavIcon name={it.icon} className={"w-4 h-4 " + (it.active ? "text-white" : "text-zinc-500")} />
            <span className="flex-1 truncate">{it.name}</span>
            {it.count != null && (
              <span
                className={
                  "text-[10.5px] tabular-nums font-bold px-1.5 py-0.5 rounded-md " +
                  (it.active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600")
                }
              >
                {it.count}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 p-2 flex items-center gap-3 rounded-xl hover:bg-zinc-100 cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-zinc-200 text-[12px] font-bold flex items-center justify-center text-zinc-700">
          NG
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate">Nick Gaines</div>
          <div className="text-[11px] text-zinc-500 truncate font-medium">Owner</div>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-blue-700 font-bold mb-1.5">
          Sunday · May 3
        </p>
        <h1 className="text-[32px] font-bold tracking-tight leading-tight">
          Good afternoon, Nick.
        </h1>
        <p className="text-[13px] text-zinc-500 mt-1 font-medium">
          12 jobs today · 4 unread messages · 9 estimates pending
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search"
            className="w-64 bg-white border border-zinc-300/70 rounded-xl pl-10 pr-3 py-2.5 text-[13px] font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder-zinc-400"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <NavIcon name="search" />
          </span>
        </div>
        <button className="w-10 h-10 rounded-xl bg-white border border-zinc-300/70 hover:border-zinc-400 flex items-center justify-center text-zinc-700">
          <NavIcon name="bell" />
        </button>
      </div>
    </div>
  );
}

function KpiRow() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KPIS.map((m) => (
        <div key={m.label} className={`${T.card} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12.5px] text-zinc-500 font-semibold">{m.label}</div>
            <span
              className={
                "text-[10.5px] px-2 py-0.5 rounded-md tabular-nums font-bold " +
                (m.up ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-600")
              }
            >
              {m.delta}
            </span>
          </div>
          <div className="text-[32px] font-bold tracking-tight tabular-nums leading-none">
            {m.value}
          </div>
          <div className="text-[11.5px] text-zinc-500 mt-2 font-medium">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard() {
  return (
    <section className={`${T.card} rounded-2xl col-span-2`}>
      <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight">Revenue</h3>
          <p className="text-[12px] text-zinc-500 font-medium">Last 12 weeks</p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
          {["12W", "26W", "YTD"].map((t, i) => (
            <button
              key={t}
              className={
                "px-3 py-1 rounded-md text-[11px] font-bold " +
                (i === 0 ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        <ChartArea stroke="#2563eb" fillFromColor="#2563eb" />
      </div>
    </section>
  );
}

function PipelineCard() {
  const max = 12;
  return (
    <section className={`${T.card} rounded-2xl`}>
      <div className="px-5 py-4 border-b border-zinc-200">
        <h3 className="text-[15px] font-bold tracking-tight">Pipeline</h3>
        <p className="text-[12px] text-zinc-500 font-medium">35 active opportunities</p>
      </div>
      <div className="p-5 space-y-4">
        {STAGES.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[13px] font-bold">{s.name}</span>
              <span className="text-[11px] text-zinc-500 tabular-nums font-bold">
                {s.count} · {s.value}
              </span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScheduleCard() {
  return (
    <section className={`${T.card} rounded-2xl`}>
      <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight">Today's schedule</h3>
          <p className="text-[12px] text-zinc-500 font-medium">{JOBS.length} of 12 visible</p>
        </div>
        <Link href="#" className="text-[12px] text-blue-700 hover:text-blue-800 font-bold">
          View all →
        </Link>
      </div>
      <div className="p-3">
        {JOBS.map((j, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-50 cursor-pointer">
            <div className="text-center w-14">
              <div className="text-[19px] font-bold tabular-nums leading-none">{j.time}</div>
              <div className="text-[10px] text-zinc-500 font-bold mt-1 tracking-wider">{j.ampm}</div>
            </div>
            <div className="w-px h-9 bg-zinc-200" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold truncate">{j.customer}</div>
              <div className="text-[12px] text-zinc-500 truncate font-medium">{j.addr}</div>
            </div>
            <span
              className={
                "text-[11px] px-2.5 py-1 rounded-full font-bold " +
                (j.status === "On the way"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-700")
              }
            >
              {j.status}
            </span>
            <div className="flex items-center gap-2 w-24 justify-end">
              <span className="inline-flex w-7 h-7 rounded-full bg-zinc-100 text-[10px] font-bold items-center justify-center text-zinc-700">
                {j.tech.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[12px] text-zinc-600 font-semibold">{j.tech}</span>
            </div>
            <div className="text-[14px] font-bold tabular-nums w-16 text-right">{j.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-20">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-950 font-bold">
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight text-zinc-950">
        Concept I · <span className="text-blue-600">Cobalt</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
        {["g", "h", "i", "j", "k", "l"].map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <Link href={`/design/concept-${s}`} className="hover:text-zinc-950">{s.toUpperCase()}</Link>
            {i < 5 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
