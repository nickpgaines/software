export type DoorStatus =
  | "sale"
  | "not_home"
  | "not_interested"
  | "not_qualified"
  | "do_not_contact"
  | "revisit"
  | "referral"
  | "quote";

export type StatusDef = {
  key: DoorStatus;
  label: string;
  color: string;
  glow?: boolean;
  iconKey:
    | "dollar"
    | "home"
    | "ban"
    | "user-x"
    | "skull"
    | "refresh"
    | "handshake"
    | "doc";
};

export const STATUSES: StatusDef[] = [
  { key: "sale", label: "Sale", color: "#22c55e", iconKey: "dollar" },
  { key: "not_home", label: "Not Home", color: "#f97316", iconKey: "home" },
  {
    key: "not_interested",
    label: "Not Interested",
    color: "#ef4444",
    glow: true,
    iconKey: "ban",
  },
  {
    key: "not_qualified",
    label: "Not Qualified",
    color: "#a855f7",
    iconKey: "user-x",
  },
  {
    key: "do_not_contact",
    label: "Do Not Contact",
    color: "#7f1d1d",
    glow: true,
    iconKey: "skull",
  },
  { key: "revisit", label: "Revisit", color: "#06b6d4", iconKey: "refresh" },
  {
    key: "referral",
    label: "Referral",
    color: "#ec4899",
    iconKey: "handshake",
  },
  { key: "quote", label: "Quote", color: "#3b82f6", iconKey: "doc" },
];

export const OBJECTIONS = [
  "Needs to talk to spouse",
  "Renters objection",
  "The weather",
  "Too expensive",
  "Bad timing",
  "Already have a service",
];

export const TERRITORY_COLORS = [
  "#3b82f6", // blue
  "#f59e0b", // gold
  "#ec4899", // pink
  "#22d3ee", // light blue
  "#22c55e", // green
  "#ef4444", // red
  "#f97316", // orange
  "#a855f7", // purple
];

export function statusByKey(key: string): StatusDef | undefined {
  return STATUSES.find((s) => s.key === key);
}

export function iconSvg(key: StatusDef["iconKey"], size = 18) {
  const stroke = `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const filled = `fill="currentColor"`;
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`;
  switch (key) {
    case "dollar":
      return wrap(
        `<text x="12" y="17" text-anchor="middle" font-family="ui-sans-serif,system-ui" font-size="16" font-weight="800" fill="currentColor">$</text>`
      );
    case "home":
      return wrap(
        `<g ${stroke}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></g>`
      );
    case "ban":
      return wrap(
        `<g ${stroke}><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></g>`
      );
    case "user-x":
      return wrap(
        `<g ${stroke}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></g>`
      );
    case "skull":
      return wrap(
        `<g ${stroke}><path d="M5 11a7 7 0 0 1 14 0v3a3 3 0 0 1-2 2.8V20H7v-3.2A3 3 0 0 1 5 14z"/><circle cx="9" cy="13" r="1.2" ${filled}/><circle cx="15" cy="13" r="1.2" ${filled}/><line x1="11" y1="18" x2="13" y2="18"/></g>`
      );
    case "refresh":
      return wrap(
        `<g ${stroke}><polyline points="21 4 21 10 15 10"/><path d="M3.5 14a8 8 0 0 0 14.5 4l3-3"/><polyline points="3 20 3 14 9 14"/><path d="M20.5 10a8 8 0 0 0-14.5-4l-3 3"/></g>`
      );
    case "handshake":
      return wrap(
        `<g ${stroke}><path d="M11 17l1.7 1.7a2.4 2.4 0 0 0 3.4-3.4L13 12"/><path d="M13 12l-2-2-3 3a2 2 0 1 1-2.8-2.8L9 6.5l3 .8 4-2 4 4-3 3"/></g>`
      );
    case "doc":
      return wrap(
        `<g ${stroke}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></g>`
      );
  }
}
