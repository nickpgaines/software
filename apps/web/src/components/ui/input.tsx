import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Input — adapted to Pulse design tokens.
 *
 * Overrides vs. canonical shadcn defaults:
 *   - rounded-md → rounded-xl (§6 form-control radius).
 *
 * Note: globals.css already forces `font-weight: 700` on bare inputs
 * lacking a `font-` class, so this primitive inherits font-bold without
 * declaring it. The `bg-canvas` override there also wins against any
 * Tailwind utility that doesn't touch background-color.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm text-fg ring-offset-canvas file:border-0 file:bg-transparent file:text-sm file:font-bold placeholder:text-fg-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
