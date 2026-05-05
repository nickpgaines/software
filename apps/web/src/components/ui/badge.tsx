import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Badge — adapted to Pulse design tokens.
 *
 * Overrides vs. canonical shadcn defaults (see DESIGN_SYSTEM.md):
 *   - rounded-md → rounded-full (§6: status chips and badges use full).
 *   - font-semibold → font-extrabold (§10 #1).
 *   - Default text size 12px → 11px (matches PulseStatusChip token, §8.6).
 *
 * The closest existing primitive is `PulseStatusChip` in widgets.tsx,
 * which has two hard-coded variants (active / default). This Badge
 * primitive is the broader form: accent variants for general use,
 * including the destructive / outline / secondary variants shadcn
 * consumers expect. PulseStatusChip is unchanged.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-line bg-elevated text-fg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
