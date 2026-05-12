import Link from "next/link";

/**
 * Index for the dashboard theme-option previews. Each card links to a full
 * interactive dashboard route under /design/theme-options/option-N so the
 * viewer can scroll, hover, click cards, and use the in-sidebar light/dark
 * toggle exactly as they would on the production dashboard.
 *
 * The dashboards themselves live at:
 *   /design/theme-options/option-1   — current look, no changes
 *   /design/theme-options/option-2   — blue accent + accent dash under section titles
 *   /design/theme-options/option-3   — violet accent + accent dash under section titles
 */

type Option = {
  href: string;
  number: 1 | 2 | 3;
  title: string;
  description: string;
  accent: string;
  accentLabel: string;
};

const OPTIONS: Option[] = [
  {
    href: "/design/theme-options/option-1",
    number: 1,
    title: "As-is",
    description:
      "The current dashboard, untouched. No accent swap, no extra dashes.",
    accent: "#8b5cf6",
    accentLabel: "Violet",
  },
  {
    href: "/design/theme-options/option-2",
    number: 2,
    title: "Blue + dashes",
    description:
      "Matches the screenshot. All violet UI (New button, pipeline bars, chart line, active states) swapped to blue, plus a short accent dash under every section title.",
    accent: "#3b82f6",
    accentLabel: "Blue",
  },
  {
    href: "/design/theme-options/option-3",
    number: 3,
    title: "Purple + dashes",
    description:
      "Same layout as Option 2 but keeps the existing violet accent everywhere. Adds the section-title dashes and recolors the chart line to violet.",
    accent: "#8b5cf6",
    accentLabel: "Violet",
  },
];

export default function ThemeOptionsIndex() {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <div className="mx-auto max-w-[920px] px-6 py-12">
        <header className="mb-8">
          <div className="text-eyebrow uppercase text-fg-subtle mb-3">
            Dashboard theme options
          </div>
          <h1 className="text-page-title">Pick an option to open.</h1>
          <p className="text-sm text-fg-muted mt-3 max-w-[640px]">
            Each link opens the full dashboard with that option's styling
            applied — scrollable, clickable, real data. Toggle light/dark from
            the moon/sun in the sidebar.
          </p>
        </header>

        <div className="grid gap-4">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.number}
              href={opt.href}
              className="group relative flex flex-col gap-2 rounded-2xl border border-line bg-card p-6 hover:border-line-strong transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center rounded-full w-7 h-7 text-[12px] font-extrabold"
                  style={{ background: opt.accent, color: "#ffffff" }}
                >
                  {opt.number}
                </span>
                <div className="text-[18px] font-extrabold tracking-tight">
                  Option {opt.number} — {opt.title}
                </div>
                <span
                  className="ml-auto text-[10.5px] font-extrabold uppercase tracking-[0.18em]"
                  style={{ color: opt.accent }}
                >
                  {opt.accentLabel} accent
                </span>
              </div>
              <p className="text-[13px] text-fg-muted leading-relaxed">
                {opt.description}
              </p>
              <span className="absolute right-6 bottom-6 text-[12px] font-bold text-fg-subtle group-hover:text-fg">
                Open →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-[12px] text-fg-subtle">
          Nothing on the production dashboard changes — these are standalone
          preview routes under <code>/design/theme-options</code>.
        </p>
      </div>
    </div>
  );
}
