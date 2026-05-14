"use client";

/**
 * Shared chrome for the three full-dashboard preview routes under
 * /design/theme-options/option-N. Each option mounts the real Pulse sidebar
 * and the same widget set used on the production dashboard, wrapped in a
 * scoped style block that overrides accent CSS variables and (optionally)
 * injects the screenshot's accent-dash underline + recolors the chart line.
 *
 * Light/dark mode toggling is handled by the existing ThemeToggle rendered
 * inside the Pulse sidebar — it flips `html[data-theme]` exactly like the
 * production app.
 *
 * Scoping is via [data-theme-preview-scope="N"] on the wrapper, so the
 * overrides do not leak into the design index page or any sibling route.
 */

import * as React from "react";
import Link from "next/link";
import { PulseSidebar } from "@/components/pulse/Sidebar";

type Accent = "violet" | "blue";

export type PreviewOption = {
  id: 1 | 2 | 3;
  label: string;
  description: string;
  /**
   * `null` means "leave production styling untouched" (option 1, as-is).
   * `"blue"` or `"violet"` injects the corresponding accent palette plus
   * the section-title accent dashes and recolors the chart line.
   */
  variant: null | Accent;
};

const ACCENT_HEX: Record<Accent, { base: string; soft: string; rgb: string }> = {
  violet: { base: "#8b5cf6", soft: "#a78bfa", rgb: "139, 92, 246" },
  blue: { base: "#3b82f6", soft: "#93c5fd", rgb: "59, 130, 246" },
};

export function ThemePreviewShell({
  option,
  children,
}: {
  option: PreviewOption;
  children: React.ReactNode;
}) {
  const scope = String(option.id);
  const hasOverrides = option.variant !== null;

  return (
    <div
      data-theme-preview-scope={scope}
      data-accent-name={hasOverrides ? "true" : "false"}
    >
      {hasOverrides && (
        <ScopedStyles
          scope={scope}
          accent={ACCENT_HEX[option.variant as Accent]}
        />
      )}
      <PreviewTopBar option={option} />
      <PulseSidebar />
      <main className="ml-60 pt-12">
        <div className="max-w-app mx-auto px-10 py-10">{children}</div>
      </main>
    </div>
  );
}

function PreviewTopBar({ option }: { option: PreviewOption }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4 backdrop-blur"
      style={{
        background: "rgba(0,0,0,0.55)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        color: "#fafafa",
      }}
    >
      <div className="flex items-center gap-3 text-[12px] font-bold">
        <Link
          href="/design/theme-options"
          className="rounded-md px-2 py-1"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          ← All options
        </Link>
        <span className="opacity-60">·</span>
        <span>{option.label}</span>
        <span className="opacity-60 hidden sm:inline">— {option.description}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-bold opacity-80">
        <span>Use the moon/sun toggle in the sidebar for light/dark</span>
      </div>
    </div>
  );
}

function ScopedStyles({
  scope,
  accent,
}: {
  scope: string;
  accent: { base: string; soft: string; rgb: string };
}) {
  const sel = `[data-theme-preview-scope="${scope}"]`;
  const css = `
    /* Accent CSS variable overrides — propagate to every widget that reads
       PULSE.violetVar / --color-violet (sidebar New button, pipeline gradient,
       tasks plus button, CardHeaderLink "View all", activity dot, hover dot
       border, glow shadows, primary button color, focus ring). */
    ${sel} {
      --color-violet: ${accent.base};
      --color-violet-soft: ${accent.soft};
      --color-violet-glow: rgba(${accent.rgb}, 0.35);
      --shadow-glow-violet: 0 0 16px rgba(${accent.rgb}, 0.35);
      --shadow-glow-violet-sm: 0 0 12px rgba(${accent.rgb}, 0.35);
      --primary: ${accent.base};
      --ring: ${accent.base};
    }

    /* Greeting first-name span — recolored to the accent in options 2 & 3. */
    ${sel}[data-accent-name="true"] [data-name-token] {
      color: ${accent.base};
    }

    /* Chart line — production widget hardcodes stroke={PULSE.text} on the
       line path (stroke-width=3). Override via CSS attribute selector so
       the line picks up the accent without modifying the widget. */
    ${sel} svg path[stroke-width="3"] {
      stroke: ${accent.base} !important;
    }

    /* Chart area gradient — the widget defines <stop>s with hardcoded
       #ffffff colors. Recolor to a faint accent wash so the chart's fill
       matches its line. */
    ${sel} svg linearGradient stop {
      stop-color: ${accent.base} !important;
    }

    /* Screenshot-style accent dash under section titles. Targets every
       card header (h2.tracking-tight is used by Today's schedule, Pipeline,
       Inbox, Tasks, Activity) and the big revenue value (.text-[52px])
       on the chart hero. */
    ${sel} h2.tracking-tight,
    ${sel} .text-\\[52px\\] {
      position: relative;
      padding-bottom: 10px;
    }
    ${sel} h2.tracking-tight::after,
    ${sel} .text-\\[52px\\]::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: 0;
      width: 24px;
      height: 3px;
      background: ${accent.base};
      border-radius: 999px;
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
