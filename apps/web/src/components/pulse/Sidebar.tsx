"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PULSE } from "./theme";
import { PulseIcon } from "./Icon";
import { useMobileNav } from "@/components/MobileNavShell";

type Me = {
  identity: string;
  is_admin_account: boolean;
  staff: {
    id: number;
    name: string;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
  } | null;
  permissions?: string[];
};

type NavItem = {
  name: string;
  icon: string;
  href: string;
  section: string;
  // Optional extra path prefixes that should also mark this row active.
  // Inbox uses this so /messages, /calls, /email all highlight the row.
  matchPrefixes?: string[];
};

const NAV: (NavItem & { perm?: string })[] = [
  { name: "Dashboard", icon: "home", href: "/dashboard", section: "Workspace" },
  { name: "Schedule", icon: "calendar", href: "/schedule", section: "Workspace", perm: "schedule.view" },
  {
    name: "Inbox",
    icon: "message",
    href: "/messages",
    section: "Workspace",
    matchPrefixes: ["/calls", "/email"],
    perm: "messages.view",
  },
  { name: "Map", icon: "map", href: "/map", section: "Workspace", perm: "map.view" },
  { name: "Leads", icon: "inbox", href: "/leads", section: "Workspace", perm: "leads.view" },
  { name: "Reports", icon: "chart", href: "/reports", section: "Insights", perm: "reports.view" },
  { name: "Leaderboard", icon: "trophy", href: "/leaderboard", section: "Insights" },
  { name: "Customers", icon: "user", href: "/customers", section: "Team", perm: "customers.view" },
  { name: "Employees", icon: "users", href: "/employees", section: "Team", perm: "team.manage" },
  { name: "Settings", icon: "settings", href: "/settings", section: "Team" },
];

const NEW_ITEMS = [
  { key: "job", label: "Job", href: "/schedule/new" },
  { key: "subscription", label: "Subscription", href: "/subscriptions/new" },
  { key: "invoice", label: "Invoice", href: "/invoices/new" },
  { key: "estimate", label: "Estimate", href: "/estimates/new" },
  { key: "customer", label: "Customer", href: "/customers?new=1" },
];

const SECTIONS = ["Workspace", "Insights", "Team"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PulseSidebar({ initialMe = null }: { initialMe?: Me | null }) {
  const pathname = usePathname();
  const router = useRouter();
  // Seeded from the server layout so the name + avatar are correct on first
  // paint. Without a seed we'd render "You" / initials and only fill in
  // after a network round-trip, flashing on every navigation.
  const [me, setMe] = useState<Me | null>(initialMe);
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLDivElement>(null);
  const { open: mobileOpen } = useMobileNav();

  // One-shot fallback: only fetch if the server didn't manage to seed us
  // (e.g. session present but staff row still syncing on the layout's
  // replica). Once we have data, never refetch on navigation — soft nav
  // keeps this component mounted and the underlying record rarely changes
  // mid-session. SettingsTabs refreshes the router itself after profile
  // edits, which re-runs the layout and threads in the new initialMe.
  useEffect(() => {
    if (me) return;
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me]);

  // When the server layout re-runs (e.g. after router.refresh() following a
  // profile photo update on Settings), thread the fresh server data through
  // so the sidebar's avatar updates without a manual reload.
  useEffect(() => {
    if (initialMe) setMe(initialMe);
  }, [initialMe]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!newRef.current?.contains(e.target as Node)) setNewOpen(false);
    }
    if (newOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [newOpen]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const cleanFirst = me?.staff?.first_name?.trim();
  const cleanName = me?.staff?.name?.trim();
  const displayName =
    (cleanFirst && !cleanFirst.includes("@") ? cleanFirst : "") ||
    (cleanName && !cleanName.includes("@") ? cleanName : "") ||
    (me?.is_admin_account ? "Admin" : me?.identity) ||
    "You";
  const photo = me?.staff?.photo_url ?? null;

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 w-60 z-40 flex flex-col px-3 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] transition-transform duration-200 ease-out md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ background: PULSE.sidebar, borderRight: `1px solid ${PULSE.divider}` }}
    >
      {/* Brand */}
      <div className="px-2 mb-1">
        <div className="py-1">
          <svg
            viewBox="0 0 128 128"
            className="w-12 h-12 flex-shrink-0"
            style={{ color: PULSE.text }}
            aria-label="Forge"
          >
            <path
              d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex-1 overflow-y-auto px-1 mt-4 space-y-3">
        <li>
          <div ref={newRef} className="relative">
            <button
              type="button"
              onClick={() => setNewOpen((v) => !v)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13.5px] font-extrabold transition-colors"
              style={{
                background: PULSE.violetVar,
                color: PULSE.violetFgVar,
              }}
            >
              <PulseIcon name="plus" />
              <span className="flex-1 truncate text-left">Create</span>
            </button>
            {newOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl overflow-hidden shadow-menu"
                style={{
                  background: PULSE.card,
                  border: `1px solid ${PULSE.cardBorder}`,
                }}
              >
                {NEW_ITEMS.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setNewOpen(false)}
                    className="block px-3.5 py-2.5 text-[13px] font-bold transition-colors"
                    style={{ color: PULSE.textMuted }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </li>
        {SECTIONS.map((section) => {
          const items = NAV.filter((i) => {
            if (i.section !== section) return false;
            if (!i.perm) return true;
            if (me?.is_admin_account) return true;
            const perms = me?.permissions;
            if (!perms) return true; // before /api/me resolves, show all
            return perms.includes(i.perm);
          });
          if (items.length === 0) return null;
          return (
            <li key={section}>
              <div
                className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.2em] font-bold"
                style={{ color: PULSE.textDim }}
              >
                {section}
              </div>
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <PulseNavRow key={it.name} item={it} pathname={pathname} />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {/* Profile + sign out */}
      <div className="mt-auto pt-3" style={{ borderTop: `1px solid ${PULSE.divider}` }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden"
            style={{ background: PULSE.cardBorderHi, color: PULSE.text }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials(displayName)}</span>
            )}
          </div>
          <span
            className="text-[12.5px] font-bold flex-1 truncate"
            style={{ color: PULSE.text }}
          >
            {displayName}
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
          style={{ color: PULSE.textMuted }}
        >
          <PulseIcon name="logout" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function PulseNavRow({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string | null;
}) {
  const active =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : (pathname?.startsWith(item.href) ?? false) ||
        (item.matchPrefixes?.some((p) => pathname?.startsWith(p)) ?? false);
  const baseRow =
    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition-colors";

  if (active) {
    return (
      <li>
        <Link
          href={item.href}
          className={`${baseRow} font-extrabold`}
          style={{
            background: `color-mix(in srgb, ${PULSE.violetVar} 32%, transparent)`,
            color: PULSE.text,
          }}
        >
          <PulseIcon name={item.icon} />
          <span className="flex-1 truncate">{item.name}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={`${baseRow} font-bold hover:bg-elevated`}
        style={{ color: PULSE.textMuted }}
      >
        <PulseIcon name={item.icon} />
        <span className="flex-1 truncate">{item.name}</span>
      </Link>
    </li>
  );
}
