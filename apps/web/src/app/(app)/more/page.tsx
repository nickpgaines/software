"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PulseIcon } from "@/components/pulse/Icon";
import { NAV, NEW_ITEMS, SECTIONS } from "@/components/pulse/Sidebar";

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

// Hrefs already reachable from the mobile bottom tab bar. The More page lists
// only what the tab bar doesn't, so there are no duplicates.
const BOTTOM_TAB_HREFS = new Set([
  "/dashboard",
  "/schedule",
  "/messages",
  "/map",
]);

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

function Chevron() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-fg-subtle"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Row({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 active:bg-black/40"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-fg-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-fg">
        {label}
      </span>
      <Chevron />
    </Link>
  );
}

export default function MorePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => {
        if (!cancelled && d) setMe(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Before /api/me resolves, show all (matches the sidebar's gating).
  const canSee = (perm?: string) => {
    if (!perm) return true;
    if (!me) return true;
    if (me.is_admin_account) return true;
    return me.permissions?.includes(perm) ?? true;
  };

  const moreItems = NAV.filter(
    (i) => !BOTTOM_TAB_HREFS.has(i.href) && canSee(i.perm),
  );

  const cleanFirst = me?.staff?.first_name?.trim();
  const cleanName = me?.staff?.name?.trim();
  const displayName =
    (cleanFirst && !cleanFirst.includes("@") ? cleanFirst : "") ||
    (cleanName && !cleanName.includes("@") ? cleanName : "") ||
    (me?.is_admin_account ? "Admin" : me?.identity) ||
    "You";
  const photo = me?.staff?.photo_url ?? null;

  const sectionHeader =
    "px-1 text-[10px] uppercase tracking-[0.2em] font-bold text-fg-dim";
  const cardClass =
    "rounded-2xl border border-line bg-card overflow-hidden divide-y divide-line";

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-page-title text-white">More</h1>

      {/* Create */}
      <section className="space-y-2">
        <h2 className={sectionHeader}>Create</h2>
        <div className={cardClass}>
          {NEW_ITEMS.map((item) => (
            <Row
              key={item.key}
              href={item.href}
              icon={<PulseIcon name="plus" />}
              label={item.label}
            />
          ))}
        </div>
      </section>

      {/* Nav items not already in the bottom tab bar, grouped by section. */}
      {SECTIONS.map((section) => {
        const items = moreItems.filter((i) => i.section === section);
        if (items.length === 0) return null;
        return (
          <section key={section} className="space-y-2">
            <h2 className={sectionHeader}>{section}</h2>
            <div className={cardClass}>
              {items.map((it) => (
                <Row
                  key={it.href}
                  href={it.href}
                  icon={<PulseIcon name={it.icon} />}
                  label={it.name}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Profile + sign out */}
      <section className="space-y-2">
        <div className={cardClass}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-elevated text-[13px] font-bold text-fg">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(displayName)
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-fg">
              {displayName}
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-black/40"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-fg-muted">
              <PulseIcon name="logout" />
            </span>
            <span className="flex-1 text-[15px] font-bold text-fg">
              Sign out
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
