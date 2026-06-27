// Pure formatter helpers used by both server components (the dashboard
// page and other server-rendered routes) and the client widget components.
// No "use client" directive — that way server components can import and
// call these directly without going through a client/server module
// boundary, which in production builds turns exports of "use client"
// modules into client references that aren't callable on the server.

export function formatCents(c: number, decimals = 0) {
  return `$${(c / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatCentsShort(c: number) {
  if (c >= 100_000_000) return `$${(c / 100_000_000).toFixed(1)}M`;
  if (c >= 100_000) return `$${(c / 100_000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(0)}`;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const m = d.getMinutes().toString().padStart(2, "0");
  return { time: `${h12}:${m}`, ampm };
}

export function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function dateLabel(d: Date = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
