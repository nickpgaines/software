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

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/map", label: "Map", icon: Map },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/customers", label: "Customers", icon: User },
  { href: "/employees", label: "Employees", icon: Users },
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
};

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

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-black flex flex-col z-40">
      {/* Logo */}
      <div className="pt-6 pb-4 px-5 shrink-0">
        <span className="font-bold text-lg text-white tracking-tight">Forge CRM</span>
      </div>

      {/* + New button */}
      <div className="px-4 shrink-0">
        <NewMenu fullWidth />
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto mt-6 px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
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
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto shrink-0 px-3 pb-4 pt-3 border-t border-[#1f1f24]/60">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#1f1f24] flex items-center justify-center text-zinc-300 text-sm font-semibold shrink-0 overflow-hidden">
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
          className="h-auto justify-start gap-3 w-full px-3 py-2.5 rounded-lg text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 hover:bg-black hover:text-white"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.8} />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
