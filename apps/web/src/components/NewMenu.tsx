"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Item = {
  key: string;
  label: string;
  href?: string;
  disabled?: boolean;
};

const ITEMS: Item[] = [
  { key: "job", label: "Job", href: "/schedule/new" },
  { key: "subscription", label: "Subscription", href: "/subscriptions/new" },
  { key: "invoice", label: "Invoice", href: "/invoices/new" },
  { key: "estimate", label: "Estimate", href: "/estimates/new" },
  { key: "customer", label: "Customer", href: "/customers?new=1" },
];

export default function NewMenu({ fullWidth }: { fullWidth?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          fullWidth
            ? "inline-flex items-center justify-center w-full gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full py-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas data-[state=open]:bg-slate-800"
            : "inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full px-3 py-1.5 text-sm font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas data-[state=open]:bg-slate-800 group"
        }
      >
        New
        {!fullWidth && (
          <span
            className="text-xs inline-block transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={fullWidth ? "start" : "end"}
        className="w-48 bg-card border-line rounded-2xl shadow-lg p-1"
      >
        {ITEMS.map((it) => (
          <DropdownMenuItem
            key={it.key}
            disabled={it.disabled}
            asChild={!it.disabled && !!it.href}
            className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-zinc-300 focus:bg-black focus:text-zinc-300 cursor-pointer"
          >
            {!it.disabled && it.href ? (
              <Link href={it.href}>
                <span>{it.label}</span>
              </Link>
            ) : (
              <>
                <span>{it.label}</span>
                {it.disabled && (
                  <span className="text-[10px] font-bold bg-black text-zinc-400 rounded-full px-1.5 py-0.5">
                    Soon
                  </span>
                )}
              </>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
