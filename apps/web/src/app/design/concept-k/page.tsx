import Link from "next/link";
import { NAV_ITEMS, KPIS, JOBS, STAGES, NavIcon, ChartArea } from "../_shared";

// Concept K — "Mint"
// Warm light-mid grey canvas (stone-200) + white cards + emerald accent
export default function ConceptKPage() {
  return (
    <div className="min-h-screen bg-stone-200 text-stone-900">
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
    <aside className="bg-white border-r border-stone-300/70 flex flex-col px-4 py-5">
      <div className="flex items-center gap-2.5 px-2 mb-5">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white text-[14px] font-extrabold flex items-center justify-center">
          N
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight text-[15px]">Nick360</div>
        </div>
      </div>

      <button className="flex items-center gap-2 mb-5 mx-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 px-3 shadow-[0_2px_10px_rgba(5,150,105,0.22)]">
        <NavIcon name="plus" /> New
      </button>

      <ul className="space-y-0.5 flex-1 overflow-auto">
        {NAV_ITEMS.map((it) => (
          <li
            key={it.name}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-[13.5px] font-semibold transition-colors " +
              (it.active
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "text-stone-700 hover:bg-stone-100")
            }
          >
            <NavIcon name={it.icon} className={"w-4 h-4 " + (it.active ? "text-emerald-700" : "text-stone-500")} />
            <span className="flex-1 truncate">{it.name}</span>
            {it.count != null && (
              <span
                className={
                  "text-[10.5px] tabular-nums font-bold px-1.5 py-0.5 rounded-md " +
                  (it.active ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600")
                }
              >
                {it.count}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 p-2 flex items-center gap-3 rounded-xl hover:bg-stone-100 cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-stone-200 text-[12px] font-bold flex items-center justify-center text-stone-700">
          NG
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate">Nick Gaines</div>
          <div className="text-[11px] text-stone-500 truncate font-medium">Owner</div>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-bold mb-1.5">
          Sunday · May 3
        </p>
        <h1 className="text-[32px] font-bold tracking-tight leading-tight">
          Good afternoon, Nick.
        </h1>
        <p className="text-[13px] text-stone-500 mt-1 font-medium">
          12 jobs today · 4 unread messages · 9 estimates pending
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search"
            className="w-64 bg-white border border-stone-300/70 rounded-xl pl-10 pr-3 py-2.5 text-[13px] font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 placeholder-stone-400"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            <NavIcon name="search" />
          </span>
        </div>
        <button className="w-10 h-10 rounded-xl bg-white border border-stone-300/70 hover:border-stone-400 flex items-center justify-center text-stone-700">
          <NavIcon name="bell" />
        </button>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={"bg-white rounded-2xl border border-stone-300/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] " + className}>
      {children}
    </section>
  );
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
      <div>
        <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
        {subtitle && <p className="text-[12px] text-stone-500 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function KpiRow() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KPIS.map((m) => (
        <Card key={m.label}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12.5px] text-stone-500 font-semibold">{m.label}</div>
              <span
                className={
                  "text-[10.5px] px-2 py-0.5 rounded-md tabular-nums font-bold " +
                  (m.up ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600")
                }
              >
                {m.delta}
              </span>
            </div>
            <div className="text-[32px] font-bold tracking-tight tabular-nums leading-none">{m.value}</div>
            <div className="text-[11.5px] text-stone-500 mt-2 font-medium">{m.sub}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ChartCard() {
  return (
    <Card className="col-span-2">
      <CardHeader
        title="Revenue"
        subtitle="Last 12 weeks"
        action={
          <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
            {["12W", "26W", "YTD"].map((t, i) => (
              <button key={t} className={"px-3 py-1 rounded-md text-[11px] font-bold " + (i === 0 ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900")}>
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-5">
        <ChartArea stroke="#059669" fillFromColor="#059669" />
      </div>
    </Card>
  );
}

function PipelineCard() {
  const max = 12;
  return (
    <Card>
      <CardHeader title="Pipeline" subtitle="35 active opportunities" />
      <div className="p-5 space-y-4">
        {STAGES.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[13px] font-bold">{s.name}</span>
              <span className="text-[11px] text-stone-500 tabular-nums font-bold">
                {s.count} · {s.value}
              </span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScheduleCard() {
  return (
    <Card>
      <CardHeader
        title="Today's schedule"
        subtitle={`${JOBS.length} of 12 visible`}
        action={
          <Link href="#" className="text-[12px] text-emerald-700 hover:text-emerald-800 font-bold">
            View all →
          </Link>
        }
      />
      <div className="p-3">
        {JOBS.map((j, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-50 cursor-pointer">
            <div className="text-center w-14">
              <div className="text-[19px] font-bold tabular-nums leading-none">{j.time}</div>
              <div className="text-[10px] text-stone-500 font-bold mt-1 tracking-wider">{j.ampm}</div>
            </div>
            <div className="w-px h-9 bg-stone-200" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold truncate">{j.customer}</div>
              <div className="text-[12px] text-stone-500 truncate font-medium">{j.addr}</div>
            </div>
            <span
              className={
                "text-[11px] px-2.5 py-1 rounded-full font-bold " +
                (j.status === "On the way" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700")
              }
            >
              {j.status}
            </span>
            <div className="flex items-center gap-2 w-24 justify-end">
              <span className="inline-flex w-7 h-7 rounded-full bg-stone-100 text-[10px] font-bold items-center justify-center text-stone-700">
                {j.tech.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[12px] text-stone-600 font-semibold">{j.tech}</span>
            </div>
            <div className="text-[14px] font-bold tabular-nums w-16 text-right">{j.price}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PreviewBar() {
  return (
    <div className="h-11 bg-white border-b border-stone-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-20">
      <Link href="/design" className="text-stone-500 hover:text-stone-900 font-bold">
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight text-stone-900">
        Concept K · <span className="text-emerald-700">Mint</span>
      </div>
      <div className="flex items-center gap-1.5 text-stone-400 font-bold">
        {["g", "h", "i", "j", "k", "l"].map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <Link href={`/design/concept-${s}`} className="hover:text-stone-900">{s.toUpperCase()}</Link>
            {i < 5 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
