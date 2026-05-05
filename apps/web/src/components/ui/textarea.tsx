import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Textarea — adapted to Pulse design tokens.
 *
 * Overrides vs. canonical shadcn defaults:
 *   - rounded-md → rounded-xl (§6 form-control radius).
 *
 * Same global cascade applies as Input — globals.css forces font-weight
 * 700 and bg-canvas on bare textareas without those utility classes.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm text-fg ring-offset-canvas placeholder:text-fg-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
