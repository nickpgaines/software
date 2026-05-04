"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider, useTheme, useTokens, ACCENT } from "./_theme";

const NAV: { name: string; icon: string; href: string | null; count?: number | null }[] = [
  { name: "Dashboard", icon: "home", href: "/design/concept-live" },
  { name: "Schedule", icon: "calendar", href: "/design/concept-live/schedule" },
  { name: "Leads", icon: "inbox", href: null },
  { name: "Messages", icon: "message", href: null },
  { name: "Calls", icon: "phone", href: null },
  { name: "Email", icon: "mail", href: null },
  { name: "Map", icon: "map", href: null },
  { name: "Leaderboard", icon: "trophy", href: "/design/concept-live/leaderboard" },
  { name: "Reports", icon: "chart", href: "/design/concept-live/reports" },
  { name: "Customers", icon: "user", href: "/design/concept-live/customers" },
  { name: "Employees", icon: "users", href: null },
  { name: "Settings", icon: "settings", href: null },
];

export default function Shell({
  children,
  greetingName,
  initials,
}: {
  children: React.ReactNode;
  greetingName: string;
  initials: string;
}) {
  return (
    <ThemeProvider>
      <ShellInner greetingName={greetingName} initials={initials}>
        {children}
      </ShellInner>
    </ThemeProvider>
  );
}

function ShellInner({
  children,
  greetingName,
  initials,
}: {
  children: React.ReactNode;
  greetingName: string;
  initials: string;
}) {
  return (
    <div className="min-h-screen bg-zinc-100">
      <PreviewBar />
      <FloatingSidebar initials={initials} />
      <main className="ml-20 pr-3 pb-3">
        <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  );
}

function FloatingSidebar({ initials }: { initials: string }) {
  const t = useTokens();
  const pathname = usePathname();

  const sidebarBg = t.isDark ? "bg-zinc-900" : "bg-white";
  const sidebarBorder = t.isDark ? "border border-zinc-800" : "border border-zinc-200";

  return (
    <aside
      className={`group fixed left-3 top-14 bottom-3 w-14 hover:w-60 transition-[width] duration-200 z-40 ${sidebarBg} ${sidebarBorder} rounded-2xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden whitespace-nowrap flex flex-col`}
    >
      {/* Brand — empty 36px square reserved for the future Nick360 logo */}
      <div className="flex items-center gap-2.5 px-2.5 h-14 flex-shrink-0">
        <div className="w-9 h-9 flex-shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          <div className={`font-bold tracking-tight text-[15px] ${t.text}`}>Nick360</div>
        </div>
      </div>

      {/* New button */}
      <button
        className="mx-2 mb-3 h-10 rounded-xl text-white font-bold flex items-center gap-2 px-3"
        style={{ background: ACCENT, boxShadow: `0 2px 12px ${ACCENT}40` }}
      >
        <NavIcon name="plus" />
        <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          New
        </span>
      </button>

      {/* Nav items */}
      <ul className="space-y-0.5 flex-1 overflow-y-auto px-2">
        {NAV.map((it) => (
          <NavRow key={it.name} it={it} pathname={pathname} t={t} />
        ))}
      </ul>

      {/* Profile */}
      <div className={`mx-2 mb-2 p-2 flex items-center gap-3 rounded-xl ${t.hoverBg} cursor-pointer flex-shrink-0`}>
        <div className={`w-9 h-9 rounded-full ${t.iconChip} text-[12px] font-bold flex items-center justify-center flex-shrink-0`}>
          {initials || "?"}
        </div>
        <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100">
          <div className={`text-[13px] font-bold truncate ${t.text}`}>Account</div>
          <div className={`text-[11px] ${t.subtle} truncate font-medium`}>Owner</div>
        </div>
      </div>
    </aside>
  );
}

function NavRow({
  it,
  pathname,
  t,
}: {
  it: typeof NAV[number];
  pathname: string | null;
  t: ReturnType<typeof useTokens>;
}) {
  const active =
    !!it.href &&
    (pathname === it.href ||
      (it.href !== "/design/concept-live" && pathname?.startsWith(it.href)));

  const baseRow =
    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-colors";
  const labelCls =
    "flex-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-100";

  // Active uses leftbar (Z style)
  if (active) {
    return (
      <li>
        <Link
          href={it.href!}
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

  // Inactive but linked
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

  // Disabled (no link target yet)
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

function PreviewBar() {
  const { dark, setDark } = useTheme();
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-50">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-950 font-bold">
        ← All concepts
      </Link>
      <div className="flex items-center gap-3">
        <div className="font-bold tracking-tight text-zinc-950">
          Concept Live · <span style={{ color: ACCENT }}>real data</span>
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
      <div className="text-zinc-400 font-bold">Z + floating sidebar + real data</div>
    </div>
  );
}
