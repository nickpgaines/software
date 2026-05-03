"use client";

import { useState } from "react";
import Link from "next/link";
import { NAV_ITEMS, JOBS, CHART_POINTS, NavIcon } from "./_shared";

const ACCENT = "#379CFB";

export type Variant2 = {
  letter: string;
  name: string;
  // Card surface
  cardLight: string;
  cardDark: string;
  cardRadius: string;
  cardShadowLight: string;
  cardShadowDark: string;
  // Sidebar
  sidebarLight: string;
  sidebarDark: string;
  // Typography
  headingSize: string; // e.g. "text-3xl sm:text-4xl"
  bodyWeight: string; // "font-semibold" | "font-medium"
  // Pills / nav
  pillRadius: string; // "rounded-full" | "rounded-md"
  statusPillStyle: "filled" | "outlined";
  activeNavStyle: "fill" | "leftbar";
  // Spacing
  sectionGap: string; // "space-y-6"
  cardHeaderAccent: boolean; // adds thin blue line under card title
};

type Tokens = {
  isDark: boolean;
  card: string;
  cardShadow: string;
  sidebar: string;
  text: string;
  muted: string;
  subtle: string;
  divider: string;
  hoverBg: string;
  pillBg: string;
  pillText: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  iconChip: string;
};

function tokensFor(v: Variant2, dark: boolean): Tokens {
  return {
    isDark: dark,
    card: dark ? v.cardDark : v.cardLight,
    cardShadow: dark ? v.cardShadowDark : v.cardShadowLight,
    sidebar: dark ? v.sidebarDark : v.sidebarLight,
    text: dark ? "text-white" : "text-zinc-950",
    muted: dark ? "text-zinc-400" : "text-zinc-500",
    subtle: dark ? "text-zinc-500" : "text-zinc-400",
    divider: dark ? "border-zinc-800" : "border-zinc-200",
    hoverBg: dark ? "hover:bg-zinc-800/60" : "hover:bg-zinc-50",
    pillBg: dark ? "bg-zinc-800" : "bg-zinc-100",
    pillText: dark ? "text-zinc-300" : "text-zinc-600",
    inputBg: dark ? "bg-zinc-800" : "bg-white",
    inputBorder: dark ? "border-zinc-700" : "border-zinc-200",
    placeholder: dark ? "placeholder-zinc-500" : "placeholder-zinc-400",
    iconChip: dark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-500",
  };
}

const PAGE_HEADING = "text-zinc-950"; // always dark — stays visible on light grey canvas in both modes
const PAGE_MUTED = "text-zinc-500";

export function RealDashboard2({ v }: { v: Variant2 }) {
  const [dark, setDark] = useState(false);
  const t = tokensFor(v, dark);

  return (
    <div className="min-h-screen bg-zinc-100 relative">
      <PreviewBar v={v} dark={dark} setDark={setDark} />
      <Sidebar v={v} t={t} />
      <main className="ml-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Header v={v} t={t} />
          <div className={v.sectionGap}>
            <RevenueCard v={v} t={t} />
            <ScheduleCard v={v} t={t} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InboxCard v={v} t={t} />
              <TasksCard v={v} t={t} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Sidebar({ v, t }: { v: Variant2; t: Tokens }) {
  return (
    <aside
      className={`group fixed left-0 top-11 bottom-0 w-16 hover:w-60 transition-[width] duration-200 z-30 ${t.sidebar} overflow-hidden whitespace-nowrap flex flex-col ${
        t.isDark ? "border-r border-zinc-800" : "border-r border-zinc-200"
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 h-16 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl text-white text-[14px] font-extrabold flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT }}
        >
          N
        </div>
        <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          <div className={`font-bold tracking-tight text-[15px] ${t.text}`}>Nick360</div>
          <div className={`text-[11px] ${t.subtle} font-semibold truncate`}>Window cleaning</div>
        </div>
      </div>

      {/* New button */}
      <button
        className="mx-2.5 mb-4 h-10 rounded-xl text-white font-bold flex items-center gap-2 px-3"
        style={{ background: ACCENT, boxShadow: `0 2px 12px ${ACCENT}40` }}
      >
        <NavIcon name="plus" className="w-4 h-4 flex-shrink-0" />
        <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          New
        </span>
      </button>

      {/* Nav items */}
      <ul className="space-y-0.5 flex-1 overflow-y-auto px-2">
        {NAV_ITEMS.map((it) => (
          <NavRow key={it.name} it={it} v={v} t={t} />
        ))}
      </ul>

      {/* User profile */}
      <div className={`mx-2 mb-3 p-2 flex items-center gap-3 rounded-xl cursor-pointer ${t.hoverBg} flex-shrink-0`}>
        <div className={`w-9 h-9 rounded-full ${t.iconChip} text-[12px] font-bold flex items-center justify-center flex-shrink-0`}>
          NG
        </div>
        <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          <div className={`text-[13px] font-bold truncate ${t.text}`}>Nick Gaines</div>
          <div className={`text-[11px] ${t.subtle} truncate font-medium`}>Owner</div>
        </div>
      </div>
    </aside>
  );
}

function NavRow({ it, v, t }: { it: typeof NAV_ITEMS[number]; v: Variant2; t: Tokens }) {
  const active = !!it.active;
  const baseRow =
    "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13.5px] font-semibold transition-colors";
  const labelCls = "flex-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100";
  const countCls = "text-[10.5px] tabular-nums font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100";

  if (active && v.activeNavStyle === "leftbar") {
    return (
      <li className={`${baseRow} relative ${t.text}`} style={{ background: `${ACCENT}1A` }}>
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ background: ACCENT }} />
        <span className="flex-shrink-0" style={{ color: ACCENT }}>
          <NavIcon name={it.icon} className="w-4 h-4" />
        </span>
        <span className={labelCls} style={{ color: ACCENT }}>
          {it.name}
        </span>
        {it.count != null && (
          <span className={`${countCls} text-white`} style={{ background: ACCENT }}>
            {it.count}
          </span>
        )}
      </li>
    );
  }

  if (active) {
    return (
      <li
        className={`${baseRow} text-white`}
        style={{ background: ACCENT, boxShadow: `0 2px 8px ${ACCENT}33` }}
      >
        <NavIcon name={it.icon} className="w-4 h-4 flex-shrink-0 text-white" />
        <span className={labelCls}>{it.name}</span>
        {it.count != null && (
          <span className={`${countCls} bg-white/20 text-white`}>{it.count}</span>
        )}
      </li>
    );
  }

  return (
    <li className={`${baseRow} ${t.muted} ${t.hoverBg}`}>
      <NavIcon name={it.icon} className={`w-4 h-4 flex-shrink-0 ${t.subtle}`} />
      <span className={labelCls}>{it.name}</span>
      {it.count != null && (
        <span className={`${countCls} ${t.pillBg} ${t.pillText}`}>{it.count}</span>
      )}
    </li>
  );
}

function Header({ v, t }: { v: Variant2; t: Tokens }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className={`${v.headingSize} font-bold ${PAGE_HEADING}`}>
          Good afternoon, <span style={{ color: ACCENT }}>Nick</span>
        </h1>
        <p className={`text-sm ${PAGE_MUTED} mt-1 ${v.bodyWeight}`}>Welcome to your dashboard</p>
      </div>
      <div className="relative">
        <input
          type="search"
          placeholder="Search"
          className={`${t.inputBg} ${t.inputBorder} border rounded-full pl-10 pr-16 py-2.5 text-sm w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-[#379CFB]/30 ${t.placeholder} ${t.text} ${v.bodyWeight}`}
        />
        <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.subtle}`}>
          <NavIcon name="search" />
        </span>
        <kbd className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${t.subtle} ${t.pillBg} rounded px-1.5 py-0.5 font-bold`}>
          ⌘K
        </kbd>
      </div>
    </div>
  );
}

function CardShell({ v, t, children }: { v: Variant2; t: Tokens; children: React.ReactNode }) {
  return (
    <section className={`${t.card} ${v.cardRadius} ${t.cardShadow}`}>{children}</section>
  );
}

function CardTitle({ v, t, title, action }: { v: Variant2; t: Tokens; title: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
      <div>
        <h3 className={`font-bold tracking-tight ${t.text} text-[15px]`}>{title}</h3>
        {v.cardHeaderAccent && (
          <span
            className="inline-block mt-1.5 h-0.5 w-8 rounded-full"
            style={{ background: ACCENT }}
          />
        )}
      </div>
      {action}
    </div>
  );
}

function RevenueCard({ v, t }: { v: Variant2; t: Tokens }) {
  const max = 90;
  const w = 800;
  const h = 200;
  const step = w / (CHART_POINTS.length - 1);
  const path = CHART_POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`).join(" ");
  const fill = path + ` L ${w} ${h} L 0 ${h} Z`;
  const id = `rev2-${v.letter}-${t.isDark ? "d" : "l"}`;

  return (
    <CardShell v={v} t={t}>
      <CardTitle v={v} t={t} title="Revenue" />
      <div className="px-5 pb-5">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44" preserveAspectRatio="none">
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#${id})`} />
          <path d={path} stroke={ACCENT} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </CardShell>
  );
}

function ScheduleCard({ v, t }: { v: Variant2; t: Tokens }) {
  return (
    <CardShell v={v} t={t}>
      <CardTitle
        v={v}
        t={t}
        title="Today's schedule"
        action={
          <Link href="#" className={`text-[12px] ${v.bodyWeight}`} style={{ color: ACCENT }}>
            View all →
          </Link>
        }
      />
      <div className="px-3 pb-3">
        {JOBS.map((j, i) => (
          <div key={i} className={`flex items-center gap-4 p-3 ${v.pillRadius === "rounded-md" ? "rounded-lg" : "rounded-xl"} ${t.hoverBg} cursor-pointer`}>
            <div className="text-center w-14">
              <div className={`text-[19px] font-bold tabular-nums leading-none ${t.text}`}>{j.time}</div>
              <div className={`text-[10px] ${t.muted} font-bold mt-1 tracking-wider`}>{j.ampm}</div>
            </div>
            <div className={`w-px h-9 ${t.isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-[14px] font-bold truncate ${t.text}`}>{j.customer}</div>
              <div className={`text-[12px] ${t.muted} truncate ${v.bodyWeight}`}>{j.addr}</div>
            </div>
            <StatusPill status={j.status} v={v} />
            <div className="flex items-center gap-2 w-24 justify-end">
              <span className={`inline-flex w-7 h-7 rounded-full ${t.iconChip} text-[10px] font-bold items-center justify-center`}>
                {j.tech.slice(0, 2).toUpperCase()}
              </span>
              <span className={`text-[12px] ${t.muted} font-semibold`}>{j.tech}</span>
            </div>
            <div className={`text-[14px] font-bold tabular-nums w-16 text-right ${t.text}`}>{j.price}</div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function StatusPill({ status, v }: { status: string; v: Variant2 }) {
  const isPrimary = status === "On the way";
  if (v.statusPillStyle === "outlined") {
    return (
      <span
        className={`text-[11px] px-2.5 py-1 ${v.pillRadius} font-bold border`}
        style={{
          color: ACCENT,
          borderColor: isPrimary ? ACCENT : `${ACCENT}55`,
          background: isPrimary ? `${ACCENT}10` : "transparent",
        }}
      >
        {status}
      </span>
    );
  }
  // filled
  if (isPrimary) {
    return (
      <span
        className={`text-[11px] px-2.5 py-1 ${v.pillRadius} font-bold text-white`}
        style={{ background: ACCENT }}
      >
        {status}
      </span>
    );
  }
  return (
    <span
      className={`text-[11px] px-2.5 py-1 ${v.pillRadius} font-bold`}
      style={{ background: `${ACCENT}1A`, color: ACCENT }}
    >
      {status}
    </span>
  );
}

function InboxCard({ v, t }: { v: Variant2; t: Tokens }) {
  return (
    <CardShell v={v} t={t}>
      <CardTitle
        v={v}
        t={t}
        title="Inbox"
        action={
          <span className={t.subtle}>
            <NavIcon name="message" />
          </span>
        }
      />
      <div className="py-10 flex flex-col items-center text-center px-6">
        <div className={`w-12 h-12 rounded-full ${t.iconChip} flex items-center justify-center`}>
          <NavIcon name="message" />
        </div>
        <p className={`mt-3 font-bold ${t.text}`}>No recent conversations</p>
        <p className={`text-sm ${t.subtle} mt-1 ${v.bodyWeight}`}>
          New conversations will appear here.
        </p>
      </div>
    </CardShell>
  );
}

function TasksCard({ v, t }: { v: Variant2; t: Tokens }) {
  const tabs = ["Upcoming", "Team", "Completed"];
  return (
    <CardShell v={v} t={t}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className={`font-bold tracking-tight ${t.text} text-[15px]`}>Tasks</h3>
          {v.cardHeaderAccent && (
            <span className="inline-block mt-1.5 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm">
            {tabs.map((tb, i) => (
              <span
                key={tb}
                className={
                  "px-2 py-1 font-semibold text-[12px] " + (i === 0 ? t.text : t.subtle)
                }
              >
                {tb}
              </span>
            ))}
          </div>
          <button
            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-lg leading-none"
            style={{ background: ACCENT }}
          >
            +
          </button>
        </div>
      </div>
      <div className="py-10 flex flex-col items-center text-center px-6">
        <div className={`w-12 h-12 rounded-full ${t.iconChip} flex items-center justify-center`}>
          <NavIcon name="chart" />
        </div>
        <p className={`mt-3 font-bold ${t.text}`}>No tasks found</p>
        <p className={`text-sm ${t.subtle} mt-1 max-w-xs ${v.bodyWeight}`}>
          Tasks help your team stay organized. Create one to get started.
        </p>
      </div>
    </CardShell>
  );
}

function PreviewBar({
  v,
  dark,
  setDark,
}: {
  v: Variant2;
  dark: boolean;
  setDark: (d: boolean) => void;
}) {
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-40">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-950 font-bold">
        ← All concepts
      </Link>
      <div className="flex items-center gap-3">
        <div className="font-bold tracking-tight text-zinc-950">
          Concept {v.letter} · <span style={{ color: ACCENT }}>{v.name}</span>
        </div>
        <div className="flex items-center gap-0.5 bg-zinc-100 rounded-full p-0.5">
          <button
            onClick={() => setDark(false)}
            className={
              "px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors " +
              (!dark ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500")
            }
          >
            Light
          </button>
          <button
            onClick={() => setDark(true)}
            className={
              "px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors " +
              (dark ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500")
            }
          >
            Dark
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
        {["v", "w", "x", "y", "z"].map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <Link href={`/design/concept-${s}`} className="hover:text-zinc-950">
              {s.toUpperCase()}
            </Link>
            {i < 4 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
