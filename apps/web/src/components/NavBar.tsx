"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/messages", label: "Messages" },
  { href: "/map", label: "Map" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/reports", label: "Reports" },
  { href: "/customers", label: "Customers" },
  { href: "/settings", label: "Settings" },
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
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900">Nick360</span>
          <div className="flex gap-4 text-sm">
            {links.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "text-blue-600 font-medium"
                      : "text-slate-600 hover:text-slate-900"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
