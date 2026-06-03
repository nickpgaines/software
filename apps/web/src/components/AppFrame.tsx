"use client";

import { usePathname } from "next/navigation";

// Per-route inner frame. Most app pages live inside the centered
// max-width container with horizontal/vertical padding; a small set
// of pages (currently just /schedule) opt out so they can fill the
// viewport edge-to-edge next to the sidebar, the same way /map does.
const FULL_BLEED_PATHS = new Set<string>([
  "/schedule",
  "/messages",
  "/calls",
  "/email",
]);

const FULL_BLEED_PREFIXES = ["/leads/workflows/"];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed =
    pathname != null &&
    (FULL_BLEED_PATHS.has(pathname) ||
      FULL_BLEED_PREFIXES.some((p) => pathname.startsWith(p)));
  if (isFullBleed) {
    return <main className="md:ml-60 overflow-x-hidden">{children}</main>;
  }
  return (
    <main className="md:ml-60 overflow-x-hidden">
      <div className="max-w-app mx-auto px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-10 md:py-10">
        {children}
      </div>
    </main>
  );
}
