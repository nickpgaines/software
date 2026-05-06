"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { PULSE } from "@/components/pulse/theme";

type Theme = "dark" | "light";

const STORAGE_KEY = "forge-theme";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
      : null);
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing) — theme will reset on reload.
    }
  }

  const isLight = mounted && theme === "light";
  const label = isLight ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={isLight}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
      style={{ color: PULSE.textMuted }}
    >
      {isLight ? (
        <Sun className="w-[18px] h-[18px]" strokeWidth={1.8} />
      ) : (
        <Moon className="w-[18px] h-[18px]" strokeWidth={1.8} />
      )}
      {label}
    </button>
  );
}
