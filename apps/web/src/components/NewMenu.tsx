"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

type Item = {
  key: string;
  label: string;
  href?: string;
  disabled?: boolean;
};

const ITEMS: Item[] = [
  { key: "job", label: "Job", href: "/schedule/new" },
  { key: "subscription", label: "Subscription", disabled: true },
  { key: "invoice", label: "Invoice", disabled: true },
  { key: "estimate", label: "Estimate", disabled: true },
  { key: "customer", label: "Customer", href: "/customers?new=1" },
];

export default function NewMenu({ fullWidth }: { fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          fullWidth
            ? "inline-flex items-center justify-center w-full gap-1.5 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white rounded-full py-3 text-sm font-semibold shadow-sm transition-colors"
            : "inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-3 py-1.5 text-sm font-medium shadow-sm"
        }
      >
        {fullWidth ? (
          <>
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            New
          </>
        ) : (
          <>
            New
            <span
              className={
                "text-xs transition-transform " +
                (open ? "rotate-180 inline-block" : "inline-block")
              }
              aria-hidden
            >
              ▾
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 z-50 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden ${
            fullWidth ? "left-0" : "right-0"
          }`}
        >
          <ul className="py-1">
            {ITEMS.map((it) => {
              const inner = (
                <span
                  className={
                    "flex items-center justify-between gap-2 px-4 py-2 text-sm " +
                    (it.disabled
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-slate-700 hover:bg-slate-50 cursor-pointer")
                  }
                >
                  <span>{it.label}</span>
                  {it.disabled && (
                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                      Soon
                    </span>
                  )}
                </span>
              );

              return (
                <li key={it.key}>
                  {it.disabled || !it.href ? (
                    <button
                      type="button"
                      disabled
                      className="block w-full text-left"
                    >
                      {inner}
                    </button>
                  ) : (
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className="block"
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
