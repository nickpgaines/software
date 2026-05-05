"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Segmented pill toggle. Two callers share this primitive: the larger
 * range/view selectors (Sales/Tech, ranges, billing modes) and the
 * smaller inline label toggles (NET/GROSS, COLLECTED/GENERATED).
 *
 * `size="default"` renders a 32px-tall pill row with `text-sm`;
 * `size="sm"` renders a 20px row with `text-[10px]` for compact
 * inline use beside an eyebrow label.
 *
 * The wrapper is `bg-black` (the §3 canvas tint, one shade darker than
 * the card it sits on); active pills are flat `bg-card`; inactive labels
 * are `text-fg-subtle`. Pure typography drives differentiation — no
 * shadows (§7).
 */
export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "default",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedControlOption<T>[];
  size?: "default" | "sm";
  className?: string;
}) {
  const isSmall = size === "sm";
  return (
    <div
      className={cn(
        "inline-flex items-center bg-black rounded-full p-1",
        isSmall ? "gap-1 text-[10px]" : "text-sm",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-auto rounded-full hover:bg-transparent font-extrabold",
              isSmall ? "px-2 py-0.5" : "px-4 py-1.5",
              active
                ? "bg-card text-white"
                : "text-zinc-400 hover:text-white",
            )}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}
