"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PulseIcon } from "@/components/pulse/Icon";
import { ForgeMark } from "./ForgeMark";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-canvas/80 backdrop-blur-md border-b border-line">
      <div className="max-w-app mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="text-white" aria-label="Forge home">
          <ForgeMark />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13.5px] tracking-tight text-zinc-400 font-bold hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-[13.5px] font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>

        <button
          type="button"
          className="md:hidden text-white"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <PulseIcon name={open ? "more" : "more"} className="w-6 h-6" />
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-line bg-canvas">
          <div className="px-6 py-4 flex flex-col gap-3">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-[14px] font-bold text-white py-2"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-[14px] font-bold text-zinc-400 py-2"
            >
              Log in
            </Link>
            <Button asChild className="rounded-full mt-2">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
