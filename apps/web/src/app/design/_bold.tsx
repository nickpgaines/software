"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeProvider, useTheme, useTokens, ACCENT } from "./concept-live/_theme";
import { SmoothRevenueChart } from "./concept-live/_chart";
import type { LiveJob, RevenueSummary } from "./concept-live/_data";

// ---------- Config ---------------------------------------------------------

export type BoldConfig = {
  letter: string;
  name: string;
  // Defaults
  defaultDark: boolean;
  // Sidebar
  navWeight: "font-semibold" | "font-bold" | "font-extrabold";
  showSectionLabels: boolean;
  navActive: "fill" | "leftbar";
  brandFontSize: string;
  // Headline
  headlineSize: string;
  headlineWeight: "font-bold" | "font-extrabold" | "font-black";
  // KPI strip
  showKpiStrip: boolean;
  kpiValueSize: string;
  kpiValueWeight: "font-bold" | "font-extrabold" | "font-black";
  // Schedule rows
  scheduleScale: "default" | "large";
  // Optional palette overrides
  canvasBg?: string; // single canvas (no toggle)
  canvasBgLight?: string; // canvas in light mode (when toggle is enabled)
  canvasBgDark?: string; // canvas in dark mode (when toggle is enabled)
  forceMode?: "light" | "dark"; // forces the theme; hides toggle in preview bar
  pageHeadingColor?: string; // override; otherwise auto-flips with mode
  pageSubtitleColor?: string; // override; otherwise auto-flips with mode
  // Preview-bar nav letters and slug prefix
  navLetters?: string[]; // default ["1","2","3","4"]
  navSlugPrefix?: string; // default "concept-bold-"
};

// ---------- Nav ------------------------------------------------------------

type NavItem = {
  name: string;
  icon: string;
  href: string | null;
  section?: string;
};

const NAV: NavItem[] = [
  { name: "Dashboard", icon: "home", href: "/design/__SLUG__", section: "Workspace" },
  { name: "Schedule", icon: "calendar", href: "/design/concept-live/schedule", section: "Workspace" },
  { name: "Map", icon: "map", href: null, section: "Workspace" },
  { name: "Leads", icon: "inbox", href: null, section: "Pipeline" },
  { name: "Messages", icon: "message", href: null, section: "Inbox" },
  { name: "Calls", icon: "phone", href: null, section: "Inbox" },
  { name: "Email", icon: "mail", href: null, section: "Inbox" },
  { name: "Leaderboard", icon: "trophy", href: "/design/concept-live/leaderboard", section: "Insights" },
  { name: "Reports", icon: "chart", href: "/design/concept-live/reports", section: "Insights" },
  { name: "Customers", icon: "user", href: "/design/concept-live/customers", section: "Team" },
  { name: "Employees", icon: "users", href: null, section: "Team" },
  { name: "Settings", icon: "settings", href: null, section: "Team" },
];

// ---------- Public components ----------------------------------------------

export default function BoldShell({
  config,
  children,
  initials,
  homeSlug,
}: {
  config: BoldConfig;
  children: React.ReactNode;
  initials: string;
  homeSlug: string; // e.g. "concept-bold-1" — used to replace __SLUG__ in dashboard nav href
}) {
  return (
    <ThemeProvider>
      <ShellInner config={config} initials={initials} homeSlug={homeSlug}>
        {children}
      </ShellInner>
    </ThemeProvider>
  );
}

function ShellInner({
  config,
  initials,
  homeSlug,
  children,
}: {
  config: BoldConfig;
  initials: string;
  homeSlug: string;
  children: React.ReactNode;
}) {
  const { dark, setDark } = useTheme();
  // Apply default/forced mode on mount
  useEffect(() => {
    if (config.forceMode === "dark") setDark(true);
    else if (config.forceMode === "light") setDark(false);
    else if (config.defaultDark) setDark(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvas = dark
    ? config.canvasBgDark ?? config.canvasBg ?? "bg-zinc-100"
    : config.canvasBgLight ?? config.canvasBg ?? "bg-zinc-100";

  return (
    <div className={`min-h-screen ${canvas}`}>
      <PreviewBar config={config} />
      <FloatingSidebar config={config} initials={initials} homeSlug={homeSlug} />
      <main className="ml-20 pr-3 pb-3">
        <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  );
}

function FloatingSidebar({
  config,
  initials,
  homeSlug,
}: {
  config: BoldConfig;
  initials: string;
  homeSlug: string;
}) {
  const t = useTokens();
  const items = NAV.map((it) => ({
    ...it,
    href: it.href?.replace("__SLUG__", homeSlug) ?? null,
  }));

  const sidebarBg = t.isDark ? "bg-zinc-900" : "bg-white";
  const sidebarBorder = t.isDark ? "border border-zinc-800" : "border border-zinc-200";

  // group by section if enabled
  const grouped: { section: string | null; items: typeof items }[] = [];
  if (config.showSectionLabels) {
    let current: typeof grouped[number] | null = null;
    for (const it of items) {
      if (!current || current.section !== (it.section ?? null)) {
        current = { section: it.section ?? null, items: [] };
        grouped.push(current);
      }
      current.items.push(it);
    }
  } else {
    grouped.push({ section: null, items });
  }

  return (
    <aside
      className={`group fixed left-3 top-14 bottom-3 w-14 hover:w-60 transition-[width] duration-200 z-40 ${sidebarBg} ${sidebarBorder} rounded-2xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden whitespace-nowrap flex flex-col`}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2.5 h-14 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl text-white text-[14px] font-extrabold flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT }}
        >
          N
        </div>
        <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          <div className={`tracking-tight ${config.brandFontSize} font-extrabold ${t.text}`}>Nick360</div>
          <div className={`text-[11px] ${t.subtle} font-bold truncate`}>Window cleaning</div>
        </div>
      </div>

      {/* New */}
      <button
        className={`mx-2 mb-3 h-10 rounded-xl text-white ${config.navWeight === "font-extrabold" ? "font-extrabold" : "font-bold"} flex items-center gap-2 px-3`}
        style={{ background: ACCENT, boxShadow: `0 2px 12px ${ACCENT}40` }}
      >
        <NavIcon name="plus" />
        <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          New
        </span>
      </button>

      {/* Nav */}
      <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {grouped.map((g, gi) => (
          <li key={gi}>
            {g.section && (
              <div
                className={`px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.16em] font-extrabold ${t.subtle} opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100`}
              >
                {g.section}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <NavRow key={it.name} it={it} config={config} t={t} />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* Profile */}
      <div className={`mx-2 mb-2 p-2 flex items-center gap-3 rounded-xl ${t.hoverBg} cursor-pointer flex-shrink-0`}>
        <div className={`w-9 h-9 rounded-full ${t.iconChip} text-[12px] font-extrabold flex items-center justify-center flex-shrink-0`}>
          {initials || "?"}
        </div>
        <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          <div className={`text-[13px] font-extrabold truncate ${t.text}`}>Account</div>
          <div className={`text-[11px] ${t.subtle} truncate font-bold`}>Owner</div>
        </div>
      </div>
    </aside>
  );
}

function NavRow({
  it,
  config,
  t,
}: {
  it: NavItem & { href: string | null };
  config: BoldConfig;
  t: ReturnType<typeof useTokens>;
}) {
  // Active state from pathname could be wired via usePathname; for the bold
  // dashboard preview we mark Dashboard as active by default.
  const active = it.name === "Dashboard";
  const baseRow = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] ${config.navWeight} transition-colors`;
  const labelCls =
    "flex-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100";

  if (active && config.navActive === "leftbar") {
    return (
      <li>
        <Link
          href={it.href ?? "#"}
          className={`${baseRow} relative ${t.text}`}
          style={{ background: `${ACCENT}1A` }}
        >
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ background: ACCENT }} />
          <span className="flex-shrink-0" style={{ color: ACCENT }}>
            <NavIcon name={it.icon} />
          </span>
          <span className={labelCls} style={{ color: ACCENT }}>
            {it.name}
          </span>
        </Link>
      </li>
    );
  }

  if (active) {
    return (
      <li>
        <Link
          href={it.href ?? "#"}
          className={`${baseRow} text-white`}
          style={{ background: ACCENT, boxShadow: `0 2px 8px ${ACCENT}33` }}
        >
          <NavIcon name={it.icon} />
          <span className={labelCls}>{it.name}</span>
        </Link>
      </li>
    );
  }

  if (it.href) {
    return (
      <li>
        <Link href={it.href} className={`${baseRow} ${t.muted} ${t.hoverBg}`}>
          <span className={`flex-shrink-0 ${t.subtle}`}>
            <NavIcon name={it.icon} />
          </span>
          <span className={labelCls}>{it.name}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className={`${baseRow} ${t.subtle} cursor-default`}>
        <span className={`flex-shrink-0 ${t.subtle}`}>
          <NavIcon name={it.icon} />
        </span>
        <span className={labelCls}>{it.name}</span>
      </div>
    </li>
  );
}

function PreviewBar({ config }: { config: BoldConfig }) {
  const { dark, setDark } = useTheme();
  const showToggle = !config.forceMode;
  const letters = config.navLetters ?? ["1", "2", "3", "4"];
  const prefix = config.navSlugPrefix ?? "concept-bold-";
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-50">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-950 font-bold">
        ← All concepts
      </Link>
      <div className="flex items-center gap-3">
        <div className="font-bold tracking-tight text-zinc-950">
          Concept {config.letter} · <span style={{ color: ACCENT }}>{config.name}</span>
        </div>
        {showToggle && (
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
        )}
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
        {letters.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            <Link href={`/design/${prefix}${n}`} className="hover:text-zinc-950">
              B{n}
            </Link>
            {i < letters.length - 1 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Dashboard view -------------------------------------------------

export function BoldDashboard({
  config,
  greeting,
  firstName,
  jobs,
  revenue,
}: {
  config: BoldConfig;
  greeting: string;
  firstName: string;
  jobs: LiveJob[];
  revenue: RevenueSummary;
}) {
  const t = useTokens();
  const headingColor = config.pageHeadingColor ?? t.text;
  const subtitleColor = config.pageSubtitleColor ?? t.muted;
  return (
    <>
      <div className="mb-6">
        <h1 className={`${config.headlineSize} ${config.headlineWeight} ${headingColor} tracking-tight`}>
          {greeting}, <span style={{ color: ACCENT }}>{firstName}</span>
        </h1>
        <p className={`text-sm ${subtitleColor} mt-1 font-bold`}>Welcome to your dashboard</p>
      </div>

      <div className="space-y-6">
        {config.showKpiStrip && <KpiStrip config={config} jobs={jobs} revenue={revenue} />}
        <ChartCard />
        <ScheduleCard config={config} jobs={jobs} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InboxCard />
          <TasksCard />
        </div>
      </div>
    </>
  );
}

// ---------- Cards ----------------------------------------------------------

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const t = useTokens();
  return (
    <section className={`${t.card} ${t.cardShadow} rounded-2xl ${className}`}>{children}</section>
  );
}

function CardHeading({
  title,
  action,
  big,
}: {
  title: string;
  action?: React.ReactNode;
  big?: boolean;
}) {
  const t = useTokens();
  return (
    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
      <div>
        <h3 className={`tracking-tight ${big ? "text-lg" : "text-[15px]"} font-extrabold ${t.text}`}>{title}</h3>
        <span className="inline-block mt-1.5 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
      </div>
      {action}
    </div>
  );
}

function KpiStrip({
  config,
  jobs,
  revenue,
}: {
  config: BoldConfig;
  jobs: LiveJob[];
  revenue: RevenueSummary;
}) {
  const t = useTokens();
  const todayCents = jobs.reduce((s, j) => s + (j.price_cents || 0), 0);
  const cards = [
    { label: "Revenue MTD", value: formatCents(revenue.totalCents), sub: "this month" },
    { label: "Jobs done", value: String(revenue.jobsCompleted), sub: "this month" },
    { label: "Today's revenue", value: formatCents(todayCents), sub: `${jobs.length} job${jobs.length === 1 ? "" : "s"}` },
    { label: "Customers", value: String(revenue.customersCount), sub: "all time" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <CardShell key={c.label}>
          <div className="p-5">
            <div className={`text-[12.5px] font-bold ${t.muted}`}>{c.label}</div>
            <div className={`${config.kpiValueSize} ${config.kpiValueWeight} tracking-tight tabular-nums leading-none mt-2 ${t.text}`}>
              {c.value}
            </div>
            <span className="inline-block mt-2 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
            <div className={`text-[11.5px] mt-2 font-bold ${t.subtle}`}>{c.sub}</div>
          </div>
        </CardShell>
      ))}
    </div>
  );
}

function ChartCard() {
  return (
    <CardShell>
      <div className="p-6 sm:p-8">
        <SmoothRevenueChart initialRange="1m" totalSize="text-4xl sm:text-5xl" strokeWidth={3} />
      </div>
    </CardShell>
  );
}

function ScheduleCard({ config, jobs }: { config: BoldConfig; jobs: LiveJob[] }) {
  const t = useTokens();
  const isLarge = config.scheduleScale === "large";

  if (jobs.length === 0) {
    return (
      <CardShell>
        <CardHeading title="Today's schedule" />
        <div className="py-12 flex flex-col items-center text-center px-6">
          <div className={`w-12 h-12 rounded-full ${t.iconChip} flex items-center justify-center`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </div>
          <p className={`mt-3 font-extrabold ${t.text}`}>Nothing on the calendar</p>
          <p className={`text-sm ${t.subtle} mt-1 font-bold max-w-xs`}>
            Today's jobs will appear here once scheduled.
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <CardHeading
        title="Today's schedule"
        action={<Link href="#" className="text-[12px] font-extrabold" style={{ color: ACCENT }}>View all →</Link>}
      />
      <div className="px-3 pb-3">
        {jobs.map((j) => {
          const { time, ampm } = formatTime(j.scheduled_at);
          const isOnTheWay = j.status === "in_progress" || j.status === "on_the_way";
          return (
            <div key={j.id} className={`flex items-center gap-4 ${isLarge ? "p-4" : "p-3"} rounded-xl ${t.hoverBg} cursor-pointer`}>
              <div className="text-center w-14">
                <div className={`${isLarge ? "text-[24px]" : "text-[19px]"} font-extrabold tabular-nums leading-none ${t.text}`}>{time}</div>
                <div className={`text-[10px] ${t.muted} font-extrabold mt-1 tracking-wider`}>{ampm}</div>
              </div>
              <div className={`w-px ${isLarge ? "h-12" : "h-9"} ${t.isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
              <div className="flex-1 min-w-0">
                <div className={`${isLarge ? "text-[16px]" : "text-[14px]"} font-extrabold truncate ${t.text}`}>
                  {j.customer_name}
                </div>
                {j.customer_address && (
                  <div className={`text-[12px] ${t.muted} truncate font-bold`}>{j.customer_address}</div>
                )}
              </div>
              {isOnTheWay ? (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-extrabold text-white" style={{ background: ACCENT }}>
                  On the way
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-extrabold capitalize" style={{ background: `${ACCENT}1A`, color: ACCENT }}>
                  {j.status.replace(/_/g, " ")}
                </span>
              )}
              {j.technician_name && (
                <div className={`text-[12px] ${t.muted} font-bold w-24 truncate text-right`}>{j.technician_name}</div>
              )}
              <div className={`${isLarge ? "text-[18px]" : "text-[14px]"} font-extrabold tabular-nums w-20 text-right ${t.text}`}>
                {formatCents(j.price_cents)}
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

function InboxCard() {
  const t = useTokens();
  return (
    <CardShell>
      <CardHeading title="Inbox" />
      <div className="py-12 flex flex-col items-center text-center px-6">
        <div className={`w-12 h-12 rounded-full ${t.iconChip} flex items-center justify-center`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className={`mt-3 font-extrabold ${t.text}`}>No recent conversations</p>
        <p className={`text-sm ${t.subtle} mt-1 font-bold`}>New conversations will appear here.</p>
      </div>
    </CardShell>
  );
}

function TasksCard() {
  const t = useTokens();
  const tabs = ["Upcoming", "Team", "Completed"];
  return (
    <CardShell>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className={`text-[15px] font-extrabold tracking-tight ${t.text}`}>Tasks</h3>
          <span className="inline-block mt-1.5 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm">
            {tabs.map((tb, i) => (
              <span key={tb} className={"px-2 py-1 font-extrabold text-[12px] " + (i === 0 ? t.text : t.subtle)}>
                {tb}
              </span>
            ))}
          </div>
          <button
            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-lg leading-none font-extrabold"
            style={{ background: ACCENT }}
          >
            +
          </button>
        </div>
      </div>
      <div className="py-12 flex flex-col items-center text-center px-6">
        <div className={`w-12 h-12 rounded-full ${t.iconChip} flex items-center justify-center`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className={`mt-3 font-extrabold ${t.text}`}>No tasks found</p>
        <p className={`text-sm ${t.subtle} mt-1 font-bold max-w-xs`}>
          Tasks help your team stay organized. Create one to get started.
        </p>
      </div>
    </CardShell>
  );
}

// ---------- Helpers --------------------------------------------------------

function formatTime(iso: string) {
  const d = new Date(iso);
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const m = d.getMinutes().toString().padStart(2, "0");
  return { time: `${h12}:${m}`, ampm };
}

function formatCents(c: number) {
  if (c >= 100000) return `$${(c / 100000).toFixed(1)}K`;
  if (c === 0) return "$0";
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

function NavIcon({ name }: { name: string }) {
  const common = { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
  switch (name) {
    case "home": return <svg {...common}><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
    case "inbox": return <svg {...common}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></svg>;
    case "message": return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case "phone": return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7 13 13 0 0 0 .7 2.8 2 2 0 0 1-.5 2L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2-.5 13 13 0 0 0 2.8.7 2 2 0 0 1 1.7 2z" /></svg>;
    case "mail": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
    case "map": return <svg {...common}><path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v16M15 6v16" /></svg>;
    case "trophy": return <svg {...common}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" /></svg>;
    case "chart": return <svg {...common}><path d="M3 3v18h18" /><path d="M7 14v4M12 9v9M17 5v13" /></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 3.5a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "plus": return <svg {...common} strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
