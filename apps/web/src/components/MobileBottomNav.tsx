"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PulseIcon } from "@/components/pulse/Icon";
import { PULSE } from "@/components/pulse/theme";
import { useMobileNav } from "@/components/MobileNavShell";

type Tab = {
  key: string;
  label: string;
  icon: string;
  href?: string;
  matchPrefixes?: string[];
  perm?: string;
};

const TABS: Tab[] = [
  { key: "home", label: "Home", icon: "home", href: "/dashboard" },
  { key: "schedule", label: "Schedule", icon: "calendar", href: "/schedule" },
  {
    key: "inbox",
    label: "Inbox",
    icon: "message",
    href: "/messages",
    matchPrefixes: ["/calls", "/email"],
  },
  { key: "map", label: "Map", icon: "map", href: "/map", perm: "map.view" },
  { key: "more", label: "More", icon: "more" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open: drawerOpen, setOpen } = useMobileNav();
  const [perms, setPerms] = useState<string[] | null>(null);
  const [isAdminAccount, setIsAdminAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { permissions?: string[]; is_admin_account?: boolean } | null) => {
        if (cancelled || !d) return;
        setPerms(d.permissions ?? []);
        setIsAdminAccount(!!d.is_admin_account);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTabs =
    !perms || isAdminAccount
      ? TABS
      : TABS.filter((t) => !t.perm || perms.includes(t.perm));

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex items-stretch"
      style={{
        background: PULSE.sidebar,
        borderTop: `1px solid ${PULSE.divider}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Primary"
    >
      {visibleTabs.map((tab) => {
        const isMore = tab.key === "more";
        const active = isMore
          ? drawerOpen
          : tab.href === "/dashboard"
            ? pathname === "/dashboard" && !drawerOpen
            : (!drawerOpen &&
                (pathname?.startsWith(tab.href!) ||
                  tab.matchPrefixes?.some((p) => pathname?.startsWith(p)))) ??
              false;

        const inner = (
          <span
            className="flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold tracking-tight"
            style={{ color: active ? PULSE.text : PULSE.textMuted }}
          >
            <PulseIcon name={tab.icon} className="w-5 h-5" />
            <span>{tab.label}</span>
          </span>
        );

        if (isMore) {
          return (
            <button
              key={tab.key}
              type="button"
              aria-label="More menu"
              aria-expanded={drawerOpen}
              onClick={() => setOpen(!drawerOpen)}
              className="flex-1 flex items-center justify-center"
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={tab.key}
            href={tab.href!}
            onClick={() => {
              if (drawerOpen) setOpen(false);
            }}
            className="flex-1 flex items-center justify-center"
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
