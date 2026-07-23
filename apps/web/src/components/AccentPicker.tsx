"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "forge-accent";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const SWATCHES: { label: string; hex: string | null }[] = [
  { label: "Default", hex: null },
  { label: "Violet", hex: "#8b5cf6" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Amber", hex: "#f59e0b" },
  { label: "Rose", hex: "#f43f5e" },
  { label: "Cyan", hex: "#06b6d4" },
  { label: "Slate", hex: "#64748b" },
];

function fgFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0a0a0a" : "#ffffff";
}

function glowFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
}

function applyAccent(hex: string | null) {
  const s = document.documentElement.style;
  if (!hex) {
    s.removeProperty("--color-violet");
    s.removeProperty("--color-violet-soft");
    s.removeProperty("--color-violet-foreground");
    s.removeProperty("--color-violet-glow");
    return;
  }
  s.setProperty("--color-violet", hex);
  s.setProperty("--color-violet-soft", hex);
  s.setProperty("--color-violet-foreground", fgFor(hex));
  s.setProperty("--color-violet-glow", glowFor(hex));
}

export default function AccentPicker() {
  const [accent, setAccent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && HEX_RE.test(stored)) setAccent(stored);
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  function setAndStore(next: string | null) {
    setAccent(next);
    applyAccent(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
      // Any deliberate pick marks the one-shot old-default migration done,
      // so the layout init script never clears a post-migration Violet pick.
      localStorage.setItem("forge-accent-migrated", "1");
    } catch {
      // ignore
    }
  }

  function applyDraft() {
    const value = draft.trim().startsWith("#") ? draft.trim() : `#${draft.trim()}`;
    if (!HEX_RE.test(value)) {
      setDraftError("Enter a 6-character hex value like #3b82f6");
      return;
    }
    setDraftError(null);
    setDraft("");
    setAndStore(value.toLowerCase());
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-extrabold text-fg tracking-tight">
          Accent color
        </h3>
        <p className="text-sm font-bold text-fg-muted mt-1">
          Tints the sidebar new-button, pipeline bars, revenue chart, and
          greeting. Defaults to white in dark mode and black in light mode.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((s) => {
          const isActive = mounted && (s.hex ?? null) === accent;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setAndStore(s.hex)}
              aria-pressed={isActive}
              title={s.label}
              className={
                "h-9 w-9 rounded-full border-2 transition-colors flex items-center justify-center " +
                (isActive ? "border-fg" : "border-line hover:border-line-strong")
              }
              style={{
                background:
                  s.hex ??
                  "linear-gradient(135deg, var(--color-violet) 50%, var(--color-violet-foreground) 50%)",
              }}
            >
              <span className="sr-only">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="text"
          value={draft}
          placeholder="#3b82f6"
          onChange={(e) => {
            setDraft(e.target.value);
            if (draftError) setDraftError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyDraft();
            }
          }}
          className="h-auto w-40 bg-card border-line rounded-full px-4 py-2 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={applyDraft}
          className="h-auto border border-line bg-card hover:bg-elevated rounded-full px-4 py-2 text-sm text-fg font-bold"
        >
          Apply hex
        </Button>
        {accent && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAndStore(null)}
            className="h-auto rounded-full px-3 py-2 text-sm text-fg-muted font-bold hover:text-fg hover:bg-transparent"
          >
            Reset to default
          </Button>
        )}
      </div>
      {draftError && (
        <p className="text-xs font-bold text-rose-500">{draftError}</p>
      )}
      {mounted && accent && (
        <p className="text-xs font-bold text-fg-subtle">
          Current accent: <span className="font-mono">{accent}</span>
        </p>
      )}
    </section>
  );
}
