"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TABS = [
  { href: "/leads", label: "Pipeline" },
  { href: "/leads/workflows", label: "Workflows" },
  { href: "/leads/forms", label: "Forms" },
  { href: "/leads/integrations", label: "Integrations" },
];

function activeLabel(pathname: string): string {
  for (const t of TABS) {
    const isActive =
      t.href === "/leads" ? pathname === "/leads" : pathname.startsWith(t.href);
    if (isActive) return t.label;
  }
  return "Pipeline";
}

export default function LeadsTabs() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="md:hidden h-auto gap-1.5 border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-sm font-bold text-zinc-200"
          >
            {activeLabel(pathname)}
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {TABS.map((t) => {
            const active =
              t.href === "/leads"
                ? pathname === "/leads"
                : pathname.startsWith(t.href);
            return (
              <DropdownMenuItem key={t.href} onSelect={() => router.push(t.href)}>
                <span className="w-4 inline-block">{active ? "✓" : ""}</span>
                <span className="ml-1">{t.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="hidden md:block overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
        <div className="bg-black rounded-full p-1 inline-flex items-center text-sm">
          {TABS.map((t) => {
            const active =
              t.href === "/leads"
                ? pathname === "/leads"
                : pathname.startsWith(t.href);
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
    </>
  );
}
