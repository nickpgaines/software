"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Repeat,
  FileText,
  Calculator,
  UserPlus,
  ChevronDown,
} from "lucide-react";

type Item = {
  key: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

const ITEMS: Item[] = [
  { key: "job", label: "Job", href: "/schedule/new", icon: <Briefcase size={16} /> },
  { key: "subscription", label: "Subscription", icon: <Repeat size={16} />, disabled: true },
  { key: "invoice", label: "Invoice", icon: <FileText size={16} />, disabled: true },
  { key: "estimate", label: "Estimate", icon: <Calculator size={16} />, disabled: true },
  { key: "customer", label: "Customer", href: "/customers?new=1", icon: <UserPlus size={16} /> },
];

export default function NewMenu() {
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
        className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full pl-3 pr-2 py-1.5 text-sm font-medium shadow-sm"
      >
        New
        <ChevronDown
          size={14}
          className={"transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <ul className="py-1">
            {ITEMS.map((it) => {
              const inner = (
                <span
                  className={
                    "flex items-center justify-between gap-2 px-3 py-2 text-sm " +
                    (it.disabled
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-slate-700 hover:bg-slate-50 cursor-pointer")
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={
                        "w-7 h-7 rounded-lg flex items-center justify-center " +
                        (it.disabled
                          ? "bg-slate-50 text-slate-300"
                          : "bg-cyan-50 text-cyan-600")
                      }
                    >
                      {it.icon}
                    </span>
                    {it.label}
                  </span>
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
