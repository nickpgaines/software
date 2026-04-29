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
  User,
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
  { href: "/customers", label: "Customers", icon: User },
  { href: "/employees", label: "Employees", icon: Users },
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
    <aside className="fixed inset-y-0 left-0 w-60 bg-slate-50 flex flex-col z-40">
      {/* Logo */}
      <div className="pt-6 pb-4 px-5 shrink-0">
        <span className="font-bold text-lg text-slate-900 tracking-tight">Nick360</span>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors " +
                (active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
              }
            >
              <Icon
                className={`w-5 h-5 ${active ? "text-slate-900" : ""}`}
                strokeWidth={1.8}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto shrink-0 px-3 pb-4 pt-3 border-t border-slate-200/60">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-sm font-semibold shrink-0">
            N
          </div>
          <span className="text-sm font-medium text-slate-900">Nick</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
