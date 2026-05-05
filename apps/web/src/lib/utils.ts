import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Canonical shadcn/ui `cn()` helper. Combines `clsx` (conditional class
 * composition) with `tailwind-merge` (resolves conflicting Tailwind
 * classes so the last-applied wins). Used by every shadcn/ui component
 * generated under @/components/ui.
 *
 * Usage:
 *   <div className={cn("text-fg", isActive && "text-violet", className)} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
