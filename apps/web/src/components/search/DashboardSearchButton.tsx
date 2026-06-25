"use client";

import { Button } from "@/components/ui/button";
import { PulseIcon } from "@/components/pulse/Icon";
import { useGlobalSearch } from "@/components/search/GlobalSearchProvider";

export function DashboardSearchButton() {
  const { openSearch } = useGlobalSearch();
  return (
    <Button
      variant="outline"
      onClick={openSearch}
      className="h-11 w-72 gap-2 rounded-2xl px-4 text-[13px] bg-elevated border-line text-fg-subtle hover:bg-elevated"
    >
      <PulseIcon name="search" className="w-3.5 h-3.5" />
      Search anything
      <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] text-fg-dim">⌘K</kbd>
    </Button>
  );
}
