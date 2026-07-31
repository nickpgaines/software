"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PulseIcon } from "@/components/pulse/Icon";
import { PULSE } from "@/components/pulse/theme";

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
  { key: "more", label: "More", icon: "more", href: "/more" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
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
        // Pinned rather than intrinsic. Full-height pages size themselves
        // with calc(100dvh - 3.75rem - safe-area) (CalendarClient,
        // MessagesClient) and scrolling pages reserve the same amount as
        // bottom padding, so this bar has to be exactly that tall. When it
        // was left intrinsic (~61.5px vs the 72px those pages assumed) the
        // shortfall showed as a black seam above the tab bar.
        height: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Primary"
    >
      {visibleTabs.map((tab) => {
        const active =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : (pathname?.startsWith(tab.href!) ||
                tab.matchPrefixes?.some((p) => pathname?.startsWith(p))) ??
              false;

        return (
          <Link
            key={tab.key}
            href={tab.href!}
            className="flex-1 flex items-center justify-center"
          >
            <span
              className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold tracking-tight"
              style={{ color: active ? PULSE.text : PULSE.textMuted }}
            >
              <PulseIcon name={tab.icon} className="w-6 h-6" />
              <span>{tab.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
