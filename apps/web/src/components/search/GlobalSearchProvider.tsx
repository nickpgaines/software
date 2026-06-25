"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GlobalSearch } from "./GlobalSearch";

type GlobalSearchCtx = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const Ctx = createContext<GlobalSearchCtx | null>(null);

export function useGlobalSearch(): GlobalSearchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
  return ctx;
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // The element focused when the palette opened — focus returns here on close
  // (standard dialog focus-return; without it, Esc drops focus to <body>).
  const triggerRef = useRef<HTMLElement | null>(null);
  // Mirror of `open` so the once-bound ⌘K listener reads current state without
  // re-registering on every toggle.
  const openRef = useRef(false);

  const openSearch = useCallback(() => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    setOpen(true);
  }, []);
  const closeSearch = useCallback(() => {
    setOpen(false);
    const el = triggerRef.current;
    if (el) requestAnimationFrame(() => el.focus());
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) closeSearch();
        else openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch, closeSearch]);

  return (
    <Ctx.Provider value={{ open, openSearch, closeSearch }}>
      {children}
      {open && <GlobalSearch onClose={closeSearch} />}
    </Ctx.Provider>
  );
}
