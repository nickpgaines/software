"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{ open, openSearch, closeSearch }}>
      {children}
      {open && <GlobalSearch onClose={closeSearch} />}
    </Ctx.Provider>
  );
}
