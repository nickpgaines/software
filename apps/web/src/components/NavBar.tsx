"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Map,
  Trophy,
  BarChart3,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import NewMenu from "@/components/NewMenu";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/map", label: "Map", icon: Map },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-slate-200 flex flex-col z-40">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 shrink-0">
        <span className="font-bold text-lg text-slate-900 tracking-tight">Nick360</span>
      </div>

      {/* + New button */}
      <div className="px-3 pb-3 shrink-0">
        <NewMenu fullWidth />
      </div>

      <div className="mx-3 border-t border-slate-100 shrink-0" />

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors " +
                (active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
              }
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-2 pb-4 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut size={17} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
