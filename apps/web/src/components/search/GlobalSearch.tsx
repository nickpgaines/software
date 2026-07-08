"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PulseIcon } from "@/components/pulse/Icon";

type SearchItem = { id: number; title: string; subtitle: string | null; href: string };
type SearchGroup = { type: string; label: string; items: SearchItem[] };

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Per-result-button refs, rebuilt each render (see `cursor` below), so the
  // keyboard-highlighted item can be scrolled into view.
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the keyboard-highlighted result visible inside the scroll container.
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Debounced fetch with an out-of-order guard.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      setError(false);
      setActiveIndex(0);
      return;
    }
    setLoading(true);
    setError(false);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (inputRef.current && inputRef.current.value.trim() !== q) return; // stale
        if (!res.ok) {
          setError(true);
          setGroups([]);
          return;
        }
        const data = (await res.json()) as { groups: SearchGroup[] };
        setError(false);
        setGroups(data.groups ?? []);
        setActiveIndex(0);
      } catch {
        setError(true);
        setGroups([]);
      } finally {
        if (!inputRef.current || inputRef.current.value.trim() === q) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function go(item: SearchItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[activeIndex]);
    }
  }

  const q = query.trim();
  let cursor = -1; // running flat index, recomputed each render
  itemRefs.current = []; // rebuilt as buttons render below

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-menu"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <PulseIcon name="search" className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, jobs, invoices, leads…"
            aria-label="Search customers, jobs, invoices, leads"
            className="h-14 w-full rounded-lg bg-transparent text-sm text-fg outline-none placeholder:text-fg-dim focus-visible:ring-1 focus-visible:ring-line"
          />
          {loading && (
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-fg"
              aria-hidden
            />
          )}
          <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-fg-dim sm:block">
            Esc
          </kbd>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {q.length < 2
            ? ""
            : loading
              ? "Searching"
              : error
                ? "Search failed"
                : flat.length === 0
                  ? `No results for ${q}`
                  : `${flat.length} result${flat.length === 1 ? "" : "s"}`}
        </p>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {q.length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-dim">
              Type at least 2 characters to search.
            </p>
          ) : error ? (
            <p className="px-4 py-6 text-center text-sm text-fg-dim">Search failed. Try again.</p>
          ) : !loading && flat.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-dim">
              No results for &ldquo;{q}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.type} className="px-2 py-1">
                <p className="px-2 py-1 text-[11px] font-bold text-fg-dim">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  cursor += 1;
                  const idx = cursor;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={`${group.type}-${item.id}`}
                      type="button"
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm ${
                        active ? "bg-elevated" : ""
                      }`}
                    >
                      <span className="truncate text-fg">{item.title}</span>
                      {item.subtitle && (
                        <span className="shrink-0 truncate text-xs text-fg-subtle">{item.subtitle}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
