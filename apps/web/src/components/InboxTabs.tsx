"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/messages", label: "Messages" },
  { href: "/calls", label: "Calls" },
  { href: "/email", label: "Email" },
];

export default function InboxTabs() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
      <div className="bg-black rounded-full p-1 inline-flex items-center text-sm">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "whitespace-nowrap px-4 py-1.5 rounded-full transition-colors " +
                (active
                  ? "bg-card text-white shadow-sm font-bold"
                  : "text-zinc-400 hover:text-white")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
