"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Map,
  Trophy,
  BarChart3,
  User,
  Users,
  Settings,
  LogOut,
  Inbox,
} from "lucide-react";
import NewMenu from "@/components/NewMenu";
import { Button } from "@/components/ui/button";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm?: string;
};

const allLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar, perm: "schedule.view" },
  { href: "/leads", label: "Leads", icon: Inbox, perm: "leads.view" },
  { href: "/messages", label: "Messages", icon: MessageSquare, perm: "messages.view" },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/map", label: "Map", icon: Map, perm: "map.view" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports.view" },
  { href: "/customers", label: "Customers", icon: User, perm: "customers.view" },
  { href: "/employees", label: "Employees", icon: Users, perm: "team.manage" },
  { href: "/settings", label: "Settings", icon: Settings },
];

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

type ConversationSummary = {
  unread_count: number;
};

// How often to poll the conversations endpoint for the unread-count badge.
// Twilio inbound webhooks land on a server route, not the client, so the
// nav has to poll to surface new messages. 30s feels alive without being
// chatty; the page also refetches on focus.
const UNREAD_POLL_MS = 30_000;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/messages/conversations");
        if (!res.ok) return;
        const rows = (await res.json()) as ConversationSummary[];
        if (!cancelled) {
          const total = rows.reduce((sum, c) => sum + (c.unread_count || 0), 0);
          setUnread(total);
        }
      } catch {
        // ignore — badge stays at its last known value
      }
    }
    load();
    const interval = setInterval(load, UNREAD_POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const displayName =
    me?.staff?.first_name?.trim() ||
    me?.staff?.name?.trim() ||
    (me?.is_admin_account ? "Admin" : me?.identity) ||
    "You";
  const photo = me?.staff?.photo_url ?? null;

  // Until /api/me has resolved, show all links to avoid the nav flickering
  // shorter on admin sessions. After resolution, hide links the user lacks
  // permission for.
  const perms = me?.permissions ?? null;
  const filteredLinks = !perms || me?.is_admin_account
    ? allLinks
    : allLinks.filter((l) => !l.perm || perms.includes(l.perm));

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-black flex flex-col z-40">
      {/* Logo */}
      <div className="pt-2 pb-2 px-5 shrink-0">
        <svg viewBox="0 0 128 128" className="w-12 h-12 flex-shrink-0 text-white" aria-label="Forge">
          <path
            d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* + New button */}
      <div className="px-4 shrink-0">
        <NewMenu fullWidth />
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto mt-6 px-3">
        {filteredLinks.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const showBadge = href === "/messages" && unread > 0;
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold mb-0.5 transition-colors " +
                (active
                  ? "bg-black text-white"
                  : "text-zinc-400 hover:bg-black hover:text-white")
              }
            >
              <Icon
                className={`w-5 h-5 ${active ? "text-white" : ""}`}
                strokeWidth={1.8}
              />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span
                  className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center"
                  aria-label={`${unread} unread`}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto shrink-0 px-3 pb-4 pt-3 border-t border-line/60">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center text-zinc-300 text-sm font-semibold shrink-0 overflow-hidden">
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
          <span className="text-sm font-bold text-white tracking-tight truncate">
            {displayName}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={logout}
          className="h-auto justify-start gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-bold text-zinc-500 hover:bg-black hover:text-white"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.8} />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
