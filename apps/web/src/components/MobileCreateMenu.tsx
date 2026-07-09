"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Briefcase,
  CheckSquare,
  FileText,
  Receipt,
  Repeat,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { PULSE } from "@/components/pulse/theme";

type CreateItem = { key: string; label: string; href: string; icon: LucideIcon };

// Forge's create surfaces. (Homebase's list also has Lead + Expense, but Forge
// has no standalone Expense create and Leads live in the pipeline, so they're
// omitted here rather than shown as dead options.)
const CREATE_ITEMS: CreateItem[] = [
  { key: "job", label: "Job", href: "/schedule/new", icon: Briefcase },
  { key: "task", label: "Task", href: "/tasks/new", icon: CheckSquare },
  { key: "estimate", label: "Estimate", href: "/estimates/new", icon: FileText },
  { key: "invoice", label: "Invoice", href: "/invoices/new", icon: Receipt },
  {
    key: "subscription",
    label: "Subscription",
    href: "/subscriptions/new",
    icon: Repeat,
  },
  { key: "customer", label: "Customer", href: "/customers/new", icon: UserPlus },
];

/**
 * The mobile quick-create control: a round "+" in the page header that opens a
 * bottom-sheet chooser (Job / Task / Estimate / Invoice / Subscription /
 * Customer). Lives on the Home, Schedule, and Inbox headers so create is one
 * tap away, replacing the Create list that used to live under More.
 */
export default function MobileCreateMenu({
  className = "",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create new"
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-full border shrink-0 " +
          className
        }
        style={{
          borderColor: PULSE.cardBorder,
          background: PULSE.bgAlt,
          color: PULSE.text,
        }}
      >
        <Plus className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Create new"
        >
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          {/* Sheet */}
          <div
            className="relative rounded-t-2xl border-t p-3"
            style={{
              background: PULSE.card,
              borderColor: PULSE.cardBorder,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
            }}
          >
            <div
              className="mx-auto mb-2 h-1 w-10 rounded-full"
              style={{ background: PULSE.cardBorder }}
              aria-hidden
            />
            <div
              className="px-2 pb-2 text-[13px] font-bold"
              style={{ color: PULSE.textMuted }}
            >
              Create new
            </div>
            <div className="space-y-1">
              {CREATE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => go(item.href)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-bold hover:bg-black/40"
                    style={{ color: PULSE.text }}
                  >
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: PULSE.bgAlt }}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-xl py-3 text-[15px] font-bold"
              style={{ background: PULSE.bgAlt, color: PULSE.textMuted }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
