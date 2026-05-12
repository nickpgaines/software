"use client";

/**
 * Standalone, non-merging preview of three accent/styling options for the
 * dashboard surface. Self-contained — does not depend on Pulse tokens or app
 * data. Each preview renders the same dashboard mock with its own scoped
 * --accent + surface variables and an `data-mode` flag for light/dark.
 *
 * Options:
 *   1. As-is              — current Pulse look (violet accent, no header dashes)
 *   2. Screenshot style   — blue accent, dashes under every section title
 *   3. Screenshot style   — purple accent, dashes under every section title
 */

import * as React from "react";

type Mode = "light" | "dark";

type Palette = {
  accent: string;
  accentSoft: string;
  accentText: string;
  withDashes: boolean;
};

const VIOLET = "#8b5cf6";
const VIOLET_SOFT = "#c4b5fd";
const BLUE = "#3b82f6";
const BLUE_SOFT = "#bfdbfe";

const OPTIONS: { id: 1 | 2 | 3; title: string; subtitle: string; palette: Palette }[] = [
  {
    id: 1,
    title: "Option 1 — As-is",
    subtitle: "Current Pulse look. Violet accent, no header dashes.",
    palette: { accent: VIOLET, accentSoft: VIOLET_SOFT, accentText: "#ffffff", withDashes: false },
  },
  {
    id: 2,
    title: "Option 2 — Blue + dashes",
    subtitle: "Screenshot styling. Blue accent everywhere, dash under each section title.",
    palette: { accent: BLUE, accentSoft: BLUE_SOFT, accentText: "#ffffff", withDashes: true },
  },
  {
    id: 3,
    title: "Option 3 — Purple + dashes",
    subtitle: "Same layout as Option 2 but with the existing purple accent.",
    palette: { accent: VIOLET, accentSoft: VIOLET_SOFT, accentText: "#ffffff", withDashes: true },
  },
];

export default function ThemeOptionsPreview() {
  const [mode, setMode] = React.useState<Mode>("light");

  return (
    <div
      className="min-h-screen"
      style={{
        background: mode === "light" ? "#e4e4e7" : "#09090b",
        color: mode === "light" ? "#0a0a0a" : "#fafafa",
      }}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Dashboard theme options</h1>
            <p className="text-sm opacity-70 mt-1">
              Three accent options shown together. Toggle light/dark to preview both modes.
            </p>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {OPTIONS.map((opt) => (
            <section key={opt.id} className="flex flex-col gap-3">
              <div>
                <div
                  className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
                  style={{ color: opt.palette.accent }}
                >
                  {opt.title}
                </div>
                <div className="text-sm opacity-70 mt-1">{opt.subtitle}</div>
              </div>
              <DashboardPreview mode={mode} palette={opt.palette} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const isDark = mode === "dark";
  return (
    <div
      className="inline-flex items-center rounded-full p-1 text-xs font-semibold"
      style={{
        background: isDark ? "#18181b" : "#ffffff",
        border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
      }}
    >
      <button
        type="button"
        onClick={() => onChange("light")}
        className="px-4 py-1.5 rounded-full transition"
        style={{
          background: !isDark ? "#0a0a0a" : "transparent",
          color: !isDark ? "#ffffff" : "#a1a1aa",
        }}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => onChange("dark")}
        className="px-4 py-1.5 rounded-full transition"
        style={{
          background: isDark ? "#fafafa" : "transparent",
          color: isDark ? "#0a0a0a" : "#71717a",
        }}
      >
        Dark
      </button>
    </div>
  );
}

/* =============================================================================
   Dashboard preview — scoped by mode + palette. Each preview is its own world:
   own CSS variables, own surfaces. Layout intentionally mimics the screenshot
   (sidebar + greeting + revenue card + schedule + inbox/tasks).
   ============================================================================= */

function DashboardPreview({ mode, palette }: { mode: Mode; palette: Palette }) {
  const isDark = mode === "dark";

  const colors = isDark
    ? {
        canvas: "#0a0a0a",
        card: "#0f0f12",
        elevated: "#18181b",
        border: "#1f1f24",
        borderStrong: "#27272a",
        fg: "#fafafa",
        fgMuted: "#a1a1aa",
        fgSubtle: "#71717a",
        fgDim: "#52525b",
        sidebarBg: "#0a0a0a",
        sidebarHover: "#18181b",
      }
    : {
        canvas: "#fafafa",
        card: "#ffffff",
        elevated: "#f4f4f5",
        border: "#e4e4e7",
        borderStrong: "#d4d4d8",
        fg: "#0a0a0a",
        fgMuted: "#52525b",
        fgSubtle: "#71717a",
        fgDim: "#a1a1aa",
        sidebarBg: "#ffffff",
        sidebarHover: "#f4f4f5",
      };

  const accentTint = isDark
    ? hexToRgba(palette.accent, 0.16)
    : hexToRgba(palette.accent, 0.1);
  const accentTintStrong = isDark
    ? hexToRgba(palette.accent, 0.22)
    : hexToRgba(palette.accent, 0.14);

  return (
    <div
      className="rounded-2xl overflow-hidden border shadow-sm"
      style={{
        background: colors.canvas,
        color: colors.fg,
        borderColor: colors.border,
      }}
    >
      <div className="flex" style={{ minHeight: 620 }}>
        <Sidebar colors={colors} palette={palette} accentTint={accentTint} />
        <Main
          colors={colors}
          palette={palette}
          accentTint={accentTint}
          accentTintStrong={accentTintStrong}
        />
      </div>
    </div>
  );
}

function Sidebar({
  colors,
  palette,
  accentTint,
}: {
  colors: ReturnType<typeof sidebarTypeHelper>;
  palette: Palette;
  accentTint: string;
}) {
  const items = [
    { label: "Dashboard", icon: IconHome, active: true },
    { label: "Schedule", icon: IconCalendar },
    { label: "Map", icon: IconMap },
    { label: "Leads", icon: IconInbox },
    { label: "Messages", icon: IconChat },
    { label: "Calls", icon: IconPhone },
    { label: "Email", icon: IconMail },
    { label: "Leaderboard", icon: IconTrophy },
    { label: "Reports", icon: IconChart },
    { label: "Customers", icon: IconUser },
    { label: "Employees", icon: IconUsers },
    { label: "Settings", icon: IconCog },
  ];
  return (
    <aside
      className="hidden sm:flex flex-col shrink-0 border-r"
      style={{
        width: 168,
        background: colors.sidebarBg,
        borderColor: colors.border,
      }}
    >
      <div
        className="px-4 pt-4 pb-3 text-[13px] font-extrabold"
        style={{ color: colors.fg }}
      >
        Nick360
      </div>
      <div className="px-3">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold"
          style={{
            background: palette.accent,
            color: palette.accentText,
          }}
        >
          <span className="text-[14px] leading-none">+</span>
          New
        </button>
      </div>
      <nav className="mt-2 px-2 flex-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.label}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px]"
              style={{
                background: it.active ? accentTint : "transparent",
                color: it.active ? palette.accent : colors.fgMuted,
                fontWeight: it.active ? 600 : 500,
              }}
            >
              <Icon
                size={14}
                color={it.active ? palette.accent : colors.fgSubtle}
              />
              <span>{it.label}</span>
            </div>
          );
        })}
      </nav>
      <div
        className="m-3 mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px]"
        style={{ background: colors.elevated }}
      >
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
          style={{ background: colors.borderStrong, color: colors.fg }}
        >
          NG
        </div>
        <span style={{ color: colors.fgMuted, fontWeight: 600 }}>Account</span>
      </div>
    </aside>
  );
}

function Main({
  colors,
  palette,
  accentTint,
  accentTintStrong,
}: {
  colors: ReturnType<typeof sidebarTypeHelper>;
  palette: Palette;
  accentTint: string;
  accentTintStrong: string;
}) {
  return (
    <div className="flex-1 px-5 py-5 overflow-hidden">
      <div className="mb-4">
        <h2
          className="text-[22px] font-extrabold tracking-tight"
          style={{ color: colors.fg }}
        >
          Good morning, Nick
        </h2>
        <p className="text-[11px] mt-0.5" style={{ color: colors.fgSubtle }}>
          Welcome to your dashboard
        </p>
      </div>

      <Card colors={colors}>
        <SectionTitle
          colors={colors}
          palette={palette}
          title="May 2026 Revenue"
          right={
            <RangePill
              colors={colors}
              accentTint={accentTintStrong}
              accentText={palette.accent}
              range="Apr 30 – May 31"
            />
          }
        />
        <div className="text-[26px] font-extrabold tracking-tight mt-1" style={{ color: colors.fg }}>
          $1,098
        </div>
        <div
          className="h-[3px] w-7 mt-1.5 rounded-full"
          style={{ background: palette.accent }}
        />
        <RevenueChart colors={colors} accent={palette.accent} />
        <div
          className="text-[10px] text-right mt-1.5"
          style={{ color: colors.fgDim }}
        >
          Avg: $35.4 · Updated May 3, 11:44 PM
        </div>
      </Card>

      <div className="mt-4">
        <Card colors={colors}>
          <SectionTitle
            colors={colors}
            palette={palette}
            title="Today's schedule"
          />
          <div
            className="flex flex-col items-center justify-center py-10 gap-2"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: colors.elevated }}
            >
              <IconCalendar size={16} color={colors.fgSubtle} />
            </div>
            <div className="text-[13px] font-semibold" style={{ color: colors.fg }}>
              Nothing on the calendar
            </div>
            <div className="text-[11px]" style={{ color: colors.fgSubtle }}>
              Today's jobs will appear here once scheduled.
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <Card colors={colors}>
          <SectionTitle colors={colors} palette={palette} title="Inbox" />
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: colors.elevated }}
            >
              <IconChat size={14} color={colors.fgSubtle} />
            </div>
            <div className="text-[11px]" style={{ color: colors.fgSubtle }}>
              No new messages
            </div>
          </div>
        </Card>

        <Card colors={colors}>
          <SectionTitle
            colors={colors}
            palette={palette}
            title="Tasks"
            right={
              <div className="flex items-center gap-3">
                <Tabs
                  colors={colors}
                  accent={palette.accent}
                  tabs={["Upcoming", "Team", "Completed"]}
                  active={0}
                />
                <button
                  type="button"
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold"
                  style={{ background: palette.accent, color: palette.accentText }}
                >
                  +
                </button>
              </div>
            }
          />
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: colors.elevated }}
            >
              <IconDoc size={14} color={colors.fgSubtle} />
            </div>
            <div className="text-[11px]" style={{ color: colors.fgSubtle }}>
              All caught up
            </div>
          </div>
        </Card>
      </div>

      {/* Pipeline bar widget — illustrates accent on bar fills */}
      <div className="mt-4">
        <Card colors={colors}>
          <SectionTitle colors={colors} palette={palette} title="Pipeline" />
          <div className="grid grid-cols-4 gap-3 mt-2">
            {[
              { label: "New", value: 12, pct: 0.95 },
              { label: "Quoted", value: 8, pct: 0.65 },
              { label: "Scheduled", value: 5, pct: 0.4 },
              { label: "Won", value: 3, pct: 0.25 },
            ].map((b) => (
              <div key={b.label}>
                <div
                  className="text-[10px] font-extrabold uppercase tracking-[0.16em]"
                  style={{ color: colors.fgSubtle }}
                >
                  {b.label}
                </div>
                <div className="text-[18px] font-extrabold mt-1" style={{ color: colors.fg }}>
                  {b.value}
                </div>
                <div
                  className="mt-1.5 h-1.5 rounded-full overflow-hidden"
                  style={{ background: accentTint }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${b.pct * 100}%`, background: palette.accent }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({
  colors,
  children,
}: {
  colors: ReturnType<typeof sidebarTypeHelper>;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: colors.card,
        borderColor: colors.border,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  colors,
  palette,
  title,
  right,
}: {
  colors: ReturnType<typeof sidebarTypeHelper>;
  palette: Palette;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[13px] font-extrabold" style={{ color: colors.fg }}>
          {title}
        </div>
        {palette.withDashes && (
          <div
            className="h-[3px] w-6 mt-1.5 rounded-full"
            style={{ background: palette.accent }}
          />
        )}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function RangePill({
  colors,
  accentTint,
  accentText,
  range,
}: {
  colors: ReturnType<typeof sidebarTypeHelper>;
  accentTint: string;
  accentText: string;
  range: string;
}) {
  const labels = ["1W", "1M", "3M", "1Y"];
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center rounded-full p-0.5 text-[10px] font-semibold"
        style={{ background: colors.elevated }}
      >
        {labels.map((l) => {
          const active = l === "1M";
          return (
            <span
              key={l}
              className="px-2 py-0.5 rounded-full"
              style={{
                background: active ? accentTint : "transparent",
                color: active ? accentText : colors.fgSubtle,
              }}
            >
              {l}
            </span>
          );
        })}
      </div>
      <span className="text-[10px]" style={{ color: colors.fgSubtle }}>
        {range}
      </span>
    </div>
  );
}

function Tabs({
  colors,
  accent,
  tabs,
  active,
}: {
  colors: ReturnType<typeof sidebarTypeHelper>;
  accent: string;
  tabs: string[];
  active: number;
}) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold">
      {tabs.map((t, i) => (
        <span
          key={t}
          style={{ color: i === active ? accent : colors.fgSubtle }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function RevenueChart({ colors, accent }: { colors: ReturnType<typeof sidebarTypeHelper>; accent: string }) {
  // Single spike on day 3 to match the screenshot
  const points = Array.from({ length: 31 }, (_, i) => {
    if (i === 1) return 200;
    if (i === 2) return 1098;
    if (i === 3) return 350;
    return 0;
  });
  const width = 560;
  const height = 180;
  const padX = 24;
  const padY = 16;
  const maxY = 2000;
  const stepX = (width - padX * 2) / (points.length - 1);
  const toY = (v: number) => height - padY - (v / maxY) * (height - padY * 2);
  const linePath = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${padX + i * stepX} ${toY(v)}`)
    .join(" ");
  const fillPath = `${linePath} L ${padX + (points.length - 1) * stepX} ${height - padY} L ${padX} ${height - padY} Z`;
  const yTicks = [500, 1000, 1500, 2000];
  return (
    <div className="mt-2 -mx-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={`grad-${accent.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padX}
              x2={width - padX}
              y1={toY(t)}
              y2={toY(t)}
              stroke={colors.border}
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            <text
              x={padX - 6}
              y={toY(t) + 3}
              textAnchor="end"
              fontSize="9"
              fill={colors.fgDim}
            >
              {t}
            </text>
          </g>
        ))}
        <path d={fillPath} fill={`url(#grad-${accent.replace("#", "")})`} />
        <path d={linePath} fill="none" stroke={accent} strokeWidth={2} />
        {[1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31].map((d) => (
          <text
            key={d}
            x={padX + (d - 1) * stepX}
            y={height - 2}
            textAnchor="middle"
            fontSize="8"
            fill={colors.fgDim}
          >
            {d}
          </text>
        ))}
        <circle
          cx={padX + 30 * stepX}
          cy={toY(0)}
          r={3}
          fill={accent}
        />
      </svg>
    </div>
  );
}

/* Tiny icon set — stroke-based, scales via size + color props. */
type IconProps = { size?: number; color?: string };

function IconBase({ size = 16, color = "currentColor", path }: IconProps & { path: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}
const IconHome = (p: IconProps) => (
  <IconBase {...p} path={<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>} />
);
const IconCalendar = (p: IconProps) => (
  <IconBase {...p} path={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>} />
);
const IconMap = (p: IconProps) => (
  <IconBase {...p} path={<><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>} />
);
const IconInbox = (p: IconProps) => (
  <IconBase {...p} path={<><path d="M3 13l3-8h12l3 8" /><path d="M3 13v6h18v-6" /><path d="M8 13a4 4 0 008 0" /></>} />
);
const IconChat = (p: IconProps) => (
  <IconBase {...p} path={<path d="M21 11.5a8.4 8.4 0 01-1.3 4.5 8.5 8.5 0 01-7.5 4 8.4 8.4 0 01-4.4-1.2L3 20l1.2-4.7A8.5 8.5 0 1121 11.5z" />} />
);
const IconPhone = (p: IconProps) => (
  <IconBase {...p} path={<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7 13 13 0 00.7 2.8 2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5 13 13 0 002.8.7 2 2 0 011.7 2z" />} />
);
const IconMail = (p: IconProps) => (
  <IconBase {...p} path={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>} />
);
const IconTrophy = (p: IconProps) => (
  <IconBase {...p} path={<><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M17 5h3v3a3 3 0 01-3 3M7 5H4v3a3 3 0 003 3" /></>} />
);
const IconChart = (p: IconProps) => (
  <IconBase {...p} path={<><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-7" /></>} />
);
const IconUser = (p: IconProps) => (
  <IconBase {...p} path={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>} />
);
const IconUsers = (p: IconProps) => (
  <IconBase {...p} path={<><circle cx="9" cy="8" r="3.5" /><path d="M2 21a7 7 0 0114 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15 21a5 5 0 017-4.6" /></>} />
);
const IconCog = (p: IconProps) => (
  <IconBase {...p} path={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>} />
);
const IconDoc = (p: IconProps) => (
  <IconBase {...p} path={<><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></>} />
);

/* Helpers ---------------------------------------------------------------- */

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper type alias: gives TS a name for the colors object shape passed to
// sub-components without exporting it. The function body is unused at runtime.
function sidebarTypeHelper() {
  return {
    canvas: "",
    card: "",
    elevated: "",
    border: "",
    borderStrong: "",
    fg: "",
    fgMuted: "",
    fgSubtle: "",
    fgDim: "",
    sidebarBg: "",
    sidebarHover: "",
  };
}
