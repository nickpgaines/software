import Link from "next/link";
import { NAV_ITEMS, KPIS, JOBS, STAGES, NavIcon, ChartArea } from "./_shared";

const ACCENT = "#379CFB";
const ACCENT_HOVER = "#2589EB";

export type Palette = {
  letter: string; // "M" | "N" | "O" | "P"
  name: string;
  bg: string;
  sidebar: string;
  sidebarBorder: string;
  card: string;
  cardBorder: string;
  divider: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  searchBg: string;
  searchBorder: string;
  hoverBg: string;
  pillNeutralBg: string;
  pillNeutralText: string;
  trackBg: string;
  segmentBg: string;
  segmentActiveBg: string;
  brandTextOnSidebar: string;
  isDark: boolean;
};

export function ThemedDashboard({ p }: { p: Palette }) {
  return (
    <div className={`min-h-screen ${p.bg} ${p.text}`}>
      <PreviewBar p={p} />
      <div className="grid grid-cols-[260px_1fr] min-h-[calc(100vh-44px)]">
        <Sidebar p={p} />
        <main>
          <Header p={p} />
          <div className="px-8 pb-10 space-y-5">
            <KpiRow p={p} />
            <div className="grid grid-cols-3 gap-5">
              <ChartCard p={p} />
              <PipelineCard p={p} />
            </div>
            <ScheduleCard p={p} />
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ p }: { p: Palette }) {
  return (
    <aside className={`${p.sidebar} ${p.sidebarBorder} flex flex-col px-4 py-5`}>
      <div className="flex items-center gap-2.5 px-2 mb-5">
        <div
          className="w-9 h-9 rounded-xl text-white text-[14px] font-extrabold flex items-center justify-center"
          style={{ background: ACCENT }}
        >
          N
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold tracking-tight text-[15px] ${p.brandTextOnSidebar}`}>Nick360</div>
          <div className={`text-[11px] ${p.textSubtle} font-semibold truncate`}>Window cleaning</div>
        </div>
      </div>

      <button
        className="flex items-center gap-2 mb-5 mx-1 h-10 rounded-xl text-white text-[13px] font-bold px-3 transition-colors"
        style={{ background: ACCENT, boxShadow: `0 2px 12px ${ACCENT}40` }}
      >
        <NavIcon name="plus" /> New
      </button>

      <ul className="space-y-0.5 flex-1 overflow-auto">
        {NAV_ITEMS.map((it) => (
          <li
            key={it.name}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-[13.5px] font-semibold transition-colors " +
              (it.active
                ? "text-white"
                : `${p.textMuted} ${p.hoverBg}`)
            }
            style={it.active ? { background: ACCENT, boxShadow: `0 2px 8px ${ACCENT}33` } : undefined}
          >
            <NavIcon
              name={it.icon}
              className={"w-4 h-4 " + (it.active ? "text-white" : p.textSubtle)}
            />
            <span className="flex-1 truncate">{it.name}</span>
            {it.count != null && (
              <span
                className={
                  "text-[10.5px] tabular-nums font-bold px-1.5 py-0.5 rounded-md " +
                  (it.active ? "bg-white/20 text-white" : `${p.pillNeutralBg} ${p.pillNeutralText}`)
                }
              >
                {it.count}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className={`mt-4 p-2 flex items-center gap-3 rounded-xl ${p.hoverBg} cursor-pointer`}>
        <div className={`w-9 h-9 rounded-full ${p.pillNeutralBg} text-[12px] font-bold flex items-center justify-center ${p.pillNeutralText}`}>
          NG
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-bold truncate ${p.brandTextOnSidebar}`}>Nick Gaines</div>
          <div className={`text-[11px] ${p.textSubtle} truncate font-medium`}>Owner</div>
        </div>
      </div>
    </aside>
  );
}

function Header({ p }: { p: Palette }) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-5">
      <div>
        <p
          className="text-[11px] uppercase tracking-[0.18em] font-bold mb-1.5"
          style={{ color: ACCENT }}
        >
          Sunday · May 3
        </p>
        <h1 className={`text-[32px] font-bold tracking-tight leading-tight ${p.brandTextOnSidebar}`}>
          Good afternoon, Nick.
        </h1>
        <p className={`text-[13px] ${p.textMuted} mt-1 font-medium`}>
          12 jobs today · 4 unread messages · 9 estimates pending
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            placeholder="Search"
            className={`w-64 ${p.searchBg} ${p.searchBorder} rounded-xl pl-10 pr-3 py-2.5 text-[13px] font-medium focus:outline-none placeholder-zinc-400 ${p.brandTextOnSidebar}`}
          />
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${p.textSubtle}`}>
            <NavIcon name="search" />
          </span>
        </div>
        <button className={`w-10 h-10 rounded-xl ${p.searchBg} ${p.searchBorder} flex items-center justify-center ${p.textMuted}`}>
          <NavIcon name="bell" />
        </button>
      </div>
    </div>
  );
}

function Card({ p, children, className = "" }: { p: Palette; children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`${p.card} ${p.cardBorder} rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

function CardHeader({
  p,
  title,
  subtitle,
  action,
}: {
  p: Palette;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`px-5 py-4 border-b ${p.divider} flex items-center justify-between`}>
      <div>
        <h3 className={`text-[15px] font-bold tracking-tight ${p.brandTextOnSidebar}`}>{title}</h3>
        {subtitle && <p className={`text-[12px] ${p.textMuted} font-medium mt-0.5`}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function KpiRow({ p }: { p: Palette }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KPIS.map((m) => (
        <Card p={p} key={m.label}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`text-[12.5px] ${p.textMuted} font-semibold`}>{m.label}</div>
              {m.up ? (
                <span
                  className="text-[10.5px] px-2 py-0.5 rounded-md tabular-nums font-bold"
                  style={{ background: `${ACCENT}1A`, color: ACCENT }}
                >
                  {m.delta}
                </span>
              ) : (
                <span
                  className={`text-[10.5px] px-2 py-0.5 rounded-md tabular-nums font-bold ${p.pillNeutralBg} ${p.pillNeutralText}`}
                >
                  {m.delta}
                </span>
              )}
            </div>
            <div className={`text-[32px] font-bold tracking-tight tabular-nums leading-none ${p.brandTextOnSidebar}`}>
              {m.value}
            </div>
            <div className={`text-[11.5px] ${p.textMuted} mt-2 font-medium`}>{m.sub}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ChartCard({ p }: { p: Palette }) {
  return (
    <Card p={p} className="col-span-2">
      <CardHeader
        p={p}
        title="Revenue"
        subtitle="Last 12 weeks"
        action={
          <div className={`flex items-center gap-1 ${p.segmentBg} rounded-lg p-0.5`}>
            {["12W", "26W", "YTD"].map((t, i) => (
              <button
                key={t}
                className={
                  "px-3 py-1 rounded-md text-[11px] font-bold " +
                  (i === 0 ? `${p.segmentActiveBg} ${p.brandTextOnSidebar} shadow-sm` : `${p.textMuted}`)
                }
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-5">
        <ChartArea stroke={ACCENT} fillFromColor={ACCENT} />
      </div>
    </Card>
  );
}

function PipelineCard({ p }: { p: Palette }) {
  const max = 12;
  return (
    <Card p={p}>
      <CardHeader p={p} title="Pipeline" subtitle="35 active opportunities" />
      <div className="p-5 space-y-4">
        {STAGES.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className={`text-[13px] font-bold ${p.brandTextOnSidebar}`}>{s.name}</span>
              <span className={`text-[11px] ${p.textMuted} tabular-nums font-bold`}>
                {s.count} · {s.value}
              </span>
            </div>
            <div className={`h-2 ${p.trackBg} rounded-full overflow-hidden`}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.count / max) * 100}%`, background: ACCENT }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScheduleCard({ p }: { p: Palette }) {
  return (
    <Card p={p}>
      <CardHeader
        p={p}
        title="Today's schedule"
        subtitle={`${JOBS.length} of 12 visible`}
        action={
          <Link
            href="#"
            className="text-[12px] font-bold transition-colors"
            style={{ color: ACCENT }}
          >
            View all →
          </Link>
        }
      />
      <div className="p-3">
        {JOBS.map((j, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 p-3 rounded-xl ${p.hoverBg} cursor-pointer`}
          >
            <div className="text-center w-14">
              <div className={`text-[19px] font-bold tabular-nums leading-none ${p.brandTextOnSidebar}`}>
                {j.time}
              </div>
              <div className={`text-[10px] ${p.textMuted} font-bold mt-1 tracking-wider`}>
                {j.ampm}
              </div>
            </div>
            <div className={`w-px h-9 ${p.isDark ? "bg-zinc-600" : "bg-zinc-200"}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-[14px] font-bold truncate ${p.brandTextOnSidebar}`}>{j.customer}</div>
              <div className={`text-[12px] ${p.textMuted} truncate font-medium`}>{j.addr}</div>
            </div>
            {j.status === "On the way" ? (
              <span
                className="text-[11px] px-2.5 py-1 rounded-full font-bold text-white"
                style={{ background: ACCENT }}
              >
                {j.status}
              </span>
            ) : (
              <span
                className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                style={{ background: `${ACCENT}1A`, color: ACCENT }}
              >
                {j.status}
              </span>
            )}
            <div className="flex items-center gap-2 w-24 justify-end">
              <span
                className={`inline-flex w-7 h-7 rounded-full ${p.pillNeutralBg} text-[10px] font-bold items-center justify-center ${p.pillNeutralText}`}
              >
                {j.tech.slice(0, 2).toUpperCase()}
              </span>
              <span className={`text-[12px] ${p.textMuted} font-semibold`}>{j.tech}</span>
            </div>
            <div className={`text-[14px] font-bold tabular-nums w-16 text-right ${p.brandTextOnSidebar}`}>
              {j.price}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PreviewBar({ p }: { p: Palette }) {
  const barBg = p.isDark ? "bg-zinc-950" : "bg-white";
  const barBorder = p.isDark ? "border-zinc-900" : "border-zinc-200";
  const linkColor = p.isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-950";
  const titleColor = p.isDark ? "text-white" : "text-zinc-950";
  const navColor = p.isDark ? "text-zinc-600 hover:text-white" : "text-zinc-400 hover:text-zinc-950";

  return (
    <div
      className={`h-11 ${barBg} border-b ${barBorder} flex items-center justify-between px-4 text-[12px] sticky top-0 z-20`}
    >
      <Link href="/design" className={`${linkColor} font-bold`}>
        ← All concepts
      </Link>
      <div className={`font-bold tracking-tight ${titleColor}`}>
        Concept {p.letter} · <span style={{ color: ACCENT }}>{p.name}</span>
      </div>
      <div className={`flex items-center gap-1.5 font-bold ${p.isDark ? "text-zinc-700" : "text-zinc-400"}`}>
        {["m", "n", "o", "p"].map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <Link href={`/design/concept-${s}`} className={navColor.split(" ")[1]}>
              {s.toUpperCase()}
            </Link>
            {i < 3 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
