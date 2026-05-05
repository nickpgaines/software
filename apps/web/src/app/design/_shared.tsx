export type NavItem = {
  name: string;
  icon: string;
  count: number | null;
  active?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", icon: "home", count: null, active: true },
  { name: "Schedule", icon: "calendar", count: 12 },
  { name: "Leads", icon: "inbox", count: 38 },
  { name: "Messages", icon: "message", count: 4 },
  { name: "Calls", icon: "phone", count: null },
  { name: "Email", icon: "mail", count: 2 },
  { name: "Map", icon: "map", count: null },
  { name: "Leaderboard", icon: "trophy", count: null },
  { name: "Reports", icon: "chart", count: null },
  { name: "Customers", icon: "user", count: null },
  { name: "Employees", icon: "users", count: null },
  { name: "Settings", icon: "settings", count: null },
];

export const KPIS = [
  { label: "Revenue", value: "$48.2K", delta: "+12.4%", up: true, sub: "vs last week" },
  { label: "Jobs done", value: "73", delta: "+8", up: true, sub: "this week" },
  { label: "Close rate", value: "34%", delta: "−1.1%", up: false, sub: "vs last week" },
  { label: "Avg. ticket", value: "$612", delta: "+$24", up: true, sub: "this week" },
];

export const JOBS = [
  { time: "9:00", ampm: "AM", customer: "Marlene Patel", addr: "412 Birch Ln", status: "On the way", tech: "Jamal", price: "$420" },
  { time: "10:30", ampm: "AM", customer: "Forrester Group", addr: "88 Industrial Pkwy", status: "Scheduled", tech: "Aubrey", price: "$1,180" },
  { time: "12:15", ampm: "PM", customer: "Davies Residence", addr: "76 Cypress Cir", status: "Scheduled", tech: "Jamal", price: "$285" },
  { time: "2:00", ampm: "PM", customer: "Wei Office", addr: "1200 Market St", status: "Scheduled", tech: "Aubrey", price: "$640" },
];

export const STAGES = [
  { name: "New leads", count: 12, value: "$5.4K" },
  { name: "Contacted", count: 8, value: "$4.1K" },
  { name: "Estimating", count: 9, value: "$8.9K" },
  { name: "Won", count: 6, value: "$6.3K" },
];

export const CHART_POINTS = [42, 55, 38, 61, 47, 70, 58, 64, 72, 55, 80, 76];

export function NavIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
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
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.4a7 7 0 0 0-2 1.2l-2.4-.8-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.4a7 7 0 0 0 2-1.2l2.4.8 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>;
    case "plus": return <svg {...common} strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>;
    case "search": return <svg {...common} strokeWidth={2.5}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
    case "bell": return <svg {...common}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

export function ChartArea({ stroke, fillFromColor }: { stroke: string; fillFromColor: string }) {
  const max = 90;
  const w = 800;
  const h = 200;
  const step = w / (CHART_POINTS.length - 1);
  const path = CHART_POINTS
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`)
    .join(" ");
  const fill = path + ` L ${w} ${h} L 0 ${h} Z`;
  const id = "g_" + stroke.replace(/[^a-z0-9]/gi, "");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fillFromColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fillFromColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path d={path} stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
