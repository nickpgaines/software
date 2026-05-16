"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type MobileNavCtxValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const MobileNavCtx = createContext<MobileNavCtxValue>({
  open: false,
  setOpen: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavCtx);
}

// Wraps the app shell so the mobile menu button and the sidebar drawer share
// a single open/close state. Desktop is unaffected — the responsive classes
// in `PulseSidebar` and `AppFrame` make sidebar always-visible at `md:` and up.
export function MobileNavShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when the user navigates.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open so the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <MobileNavCtx.Provider value={{ open, setOpen }}>
      {children}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}
    </MobileNavCtx.Provider>
  );
}

// Floating hamburger button — visible on mobile only, top-left of viewport.
export function MobileMenuButton() {
  const { open, setOpen } = useMobileNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="md:hidden fixed top-4 left-4 z-50 w-11 h-11 rounded-full flex items-center justify-center bg-card border border-line text-fg"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        aria-hidden
      >
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}
