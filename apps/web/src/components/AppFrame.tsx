"use client";

import { usePathname } from "next/navigation";

// Per-route inner frame. Most app pages live inside the centered
// max-width container with horizontal/vertical padding; a small set
// of pages (currently just /schedule) opt out so they can fill the
// viewport edge-to-edge next to the sidebar, the same way /map does.
const FULL_BLEED_PATHS = new Set<string>(["/schedule", "/messages"]);

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = pathname != null && FULL_BLEED_PATHS.has(pathname);
  if (isFullBleed) {
    return <main className="md:ml-60">{children}</main>;
  }
  return (
    <main className="md:ml-60">
      <div className="max-w-app mx-auto px-4 pt-20 pb-8 md:px-10 md:py-10">
        {children}
      </div>
    </main>
  );
}
