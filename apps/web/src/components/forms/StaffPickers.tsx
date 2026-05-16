"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Staff = { id: number; name: string; role: string | null };

export function StaffSinglePicker({
  staff,
  id,
  setId,
  placeholder,
}: {
  staff: Staff[];
  id: number | null;
  setId: (id: number | null) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = id == null ? null : staff.find((s) => s.id === id) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-full flex items-center justify-between gap-2 border border-line rounded-full px-3 bg-card text-sm font-bold text-left"
      >
        <span className={selected ? "text-white" : "text-zinc-500"}>
          {selected ? selected.name : placeholder}
        </span>
        <span className="flex items-center gap-2 text-zinc-500 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${selected.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setId(null);
                }
              }}
              className="hover:text-white"
            >
              ×
            </span>
          )}
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && staff.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-line rounded-2xl shadow-lg overflow-hidden">
          {staff.map((s) => (
            <Button
              key={s.id}
              type="button"
              onClick={() => {
                setId(s.id);
                setOpen(false);
              }}
              variant="ghost"
              className="w-full text-left px-4 py-2 hover:bg-black text-sm flex items-center justify-between h-auto rounded-none"
            >
              <span className="font-bold text-white tracking-tight">
                {s.name}
              </span>
              {s.role && (
                <span className="text-xs font-bold text-zinc-500">
                  {s.role}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StaffMultiPicker({
  staff,
  ids,
  setIds,
  placeholder,
}: {
  staff: Staff[];
  ids: number[];
  setIds: (ids: number[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const picked = staff.filter((s) => ids.includes(s.id));
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => !ids.includes(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [staff, ids, query]);

  return (
    <div ref={ref} className="relative">
      <div className="h-9 flex flex-wrap items-center gap-1.5 border border-line rounded-full px-3 bg-card">
        {picked.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 bg-black text-zinc-300 rounded-full px-2.5 py-0.5 text-xs"
          >
            {s.name}
            <Button
              type="button"
              onClick={() => setIds(ids.filter((id) => id !== s.id))}
              variant="ghost"
              className="text-zinc-400 hover:text-white h-auto p-0"
              aria-label={`Remove ${s.name}`}
            >
              ×
            </Button>
          </span>
        ))}
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={picked.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none text-sm font-bold bg-transparent px-0 border-0 h-auto"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-line rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <Button
              key={s.id}
              type="button"
              onClick={() => {
                setIds([...ids, s.id]);
                setQuery("");
              }}
              variant="ghost"
              className="w-full text-left px-4 py-2 hover:bg-black text-sm flex items-center justify-between h-auto rounded-none"
            >
              <span className="font-bold text-white tracking-tight">{s.name}</span>
              {s.role && (
                <span className="text-xs font-bold text-zinc-500">{s.role}</span>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
