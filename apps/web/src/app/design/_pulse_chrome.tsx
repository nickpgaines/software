"use client";

import Link from "next/link";
import { PULSE, PULSE_NAV } from "./_pulse_theme";

export function PulseIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home": return <svg {...common}><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
    case "map": return <svg {...common}><path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v16M15 6v16" /></svg>;
    case "inbox": return <svg {...common}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></svg>;
    case "doc": return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "check": return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case "wallet": return <svg {...common}><path d="M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z" /><path d="M3 7V5a2 2 0 0 1 2-2h12" /><circle cx="17" cy="14" r="1.5" /></svg>;
    case "message": return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case "phone": return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7 13 13 0 0 0 .7 2.8 2 2 0 0 1-.5 2L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2-.5 13 13 0 0 0 2.8.7 2 2 0 0 1 1.7 2z" /></svg>;
    case "mail": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
    case "chart": return <svg {...common}><path d="M3 3v18h18" /><path d="M7 14v4M12 9v9M17 5v13" /></svg>;
    case "trophy": return <svg {...common}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" /></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 3.5a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "plus": return <svg {...common} strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
    case "bell": return <svg {...common}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    case "chevron": return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

export type PulseSidebarStyle = "minimal" | "sectioned";

export function PulseSidebar({
  homeSlug,
  initials,
  variantLabel,
  variantSlug,
  style = "minimal",
}: {
  homeSlug: string;
  initials: string;
  variantLabel: string;
  variantSlug: string;
  style?: PulseSidebarStyle;
}) {
  void variantSlug;
  const items = PULSE_NAV.map((it) => ({
    ...it,
    href: it.href?.replace("__SLUG__", homeSlug) ?? null,
  }));

  // Group by section
  const grouped: { section: string | null; items: typeof items }[] = [];
  if (style === "sectioned") {
    grouped.push({ section: "Workspace", items: items.filter((i) => !i.section || i.section === "Workspace" || ["Dashboard", "Schedule", "Map"].includes(i.name)) });
    grouped.push({ section: "Pipeline", items: items.filter((i) => i.section === "Pipeline") });
    grouped.push({ section: "Inbox", items: items.filter((i) => i.section === "Inbox") });
    grouped.push({ section: "Insights", items: items.filter((i) => i.section === "Insights") });
    grouped.push({ section: "Team", items: items.filter((i) => i.section === "Team") });
  } else {
    grouped.push({ section: null, items });
  }

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-60 z-40 flex flex-col px-3 py-4"
      style={{ background: PULSE.bg, borderRight: `1px solid ${PULSE.divider}` }}
    >
      {/* Workspace switcher */}
      <div className="px-2 mb-1">
        <div className="flex items-center gap-2.5 py-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${PULSE.violet}, ${PULSE.violetSoft})`,
              boxShadow: `0 0 18px ${PULSE.violetGlow}`,
            }}
          >
            N
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="text-[14px] font-bold tracking-tight" style={{ color: PULSE.text }}>
              Nick360
            </span>
            <PulseIcon name="chevron" className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex-1 overflow-y-auto px-1 mt-3 space-y-3">
        {grouped.map((g, gi) => (
          <li key={gi}>
            {g.section && (
              <div
                className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.2em] font-bold"
                style={{ color: PULSE.textDim }}
              >
                {g.section}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <PulseNavRow key={it.name} item={it} homeSlug={homeSlug} />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* Profile */}
      <div className="mt-auto pt-3" style={{ borderTop: `1px solid ${PULSE.divider}` }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: PULSE.cardBorderHi, color: PULSE.text }}
          >
            {initials}
          </div>
          <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: PULSE.textMuted }}>
            {variantLabel}
          </span>
          <PulseIcon name="chevron" className="w-3.5 h-3.5" />
        </div>
      </div>
    </aside>
  );
}

function PulseNavRow({
  item,
  homeSlug,
}: {
  item: { name: string; icon: string; href: string | null };
  homeSlug: string;
}) {
  const isDashboard = item.name === "Dashboard";
  const active = isDashboard;
  const baseRow =
    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition-colors cursor-pointer";

  if (active) {
    return (
      <li>
        <Link
          href={item.href ?? "#"}
          className={`${baseRow} font-bold`}
          style={{ background: PULSE.cardBorderHi, color: PULSE.text }}
        >
          <PulseIcon name={item.icon} />
          <span className="flex-1 truncate">{item.name}</span>
        </Link>
      </li>
    );
  }

  if (item.href) {
    return (
      <li>
        <Link
          href={item.href}
          className={`${baseRow} font-semibold`}
          style={{ color: PULSE.textMuted }}
        >
          <PulseIcon name={item.icon} />
          <span className="flex-1 truncate">{item.name}</span>
        </Link>
      </li>
    );
  }

  void homeSlug;
  return (
    <li>
      <div
        className={`${baseRow} font-semibold cursor-default`}
        style={{ color: PULSE.textMuted }}
      >
        <PulseIcon name={item.icon} />
        <span className="flex-1 truncate">{item.name}</span>
      </div>
    </li>
  );
}

const PULSE_NAMES_BY_KEY: Record<string, string> = {
  "1": "Pure",
  "2": "Neon",
  "3": "Bold",
  "4": "Airy",
  "5": "Dense",
  "6": "Donut",
  "7": "Sparks",
  "8": "Compact",
  "9": "Premium",
  "10": "Color",
  "11": "Charted",
};

export function PulsePreviewBar({
  active,
  group = ["1", "2", "3"],
}: {
  active: string;
  group?: string[];
}) {
  const name = PULSE_NAMES_BY_KEY[active] ?? "";
  return (
    <div
      className="h-11 flex items-center justify-between px-4 text-[12px] sticky top-0 z-50"
      style={{
        background: PULSE.bg,
        borderBottom: `1px solid ${PULSE.divider}`,
      }}
    >
      <Link href="/design" className="font-bold hover:text-white transition-colors" style={{ color: PULSE.textMuted }}>
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight" style={{ color: PULSE.text }}>
        Pulse {active} · <span style={{ color: PULSE.violet }}>{name}</span>
      </div>
      <div className="flex items-center gap-1.5 font-bold" style={{ color: PULSE.textDim }}>
        {group.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            <Link
              href={`/design/concept-pulse-${n}`}
              className={n === active ? "text-white" : "hover:text-white transition-colors"}
              style={{ color: n === active ? PULSE.text : PULSE.textDim }}
            >
              P{n}
            </Link>
            {i < group.length - 1 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
