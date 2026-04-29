"use client";

import { useState } from "react";
import { STATUSES } from "@/lib/map-status";

export type Filters = {
  showCustomers: boolean;
  statuses: string[];
  fromDate: string;
  toDate: string;
  dateRangeOn: boolean;
  staffIds: number[];
};

export type Staff = { id: number; name: string; role: string | null };

export const DEFAULT_FILTERS: Filters = {
  showCustomers: true,
  statuses: STATUSES.map((s) => s.key),
  fromDate: "",
  toDate: "",
  dateRangeOn: false,
  staffIds: [],
};

export default function MapFilterPanel({
  filters,
  setFilters,
  onClose,
  staff,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onClose: () => void;
  staff: Staff[];
}) {
  const [staffOpen, setStaffOpen] = useState(false);

  function toggleStatus(key: string) {
    setFilters({
      ...filters,
      statuses: filters.statuses.includes(key)
        ? filters.statuses.filter((k) => k !== key)
        : [...filters.statuses, key],
    });
  }

  function toggleStaff(id: number) {
    setFilters({
      ...filters,
      staffIds: filters.staffIds.includes(id)
        ? filters.staffIds.filter((x) => x !== id)
        : [...filters.staffIds, id],
    });
  }

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-30"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-14 bottom-0 right-0 z-40 w-full sm:w-[380px] bg-white shadow-2xl flex flex-col rounded-l-3xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Filters</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <Section
            title="Custom range"
            action={
              <Toggle
                on={filters.dateRangeOn}
                onChange={(on) => setFilters({ ...filters, dateRangeOn: on })}
              />
            }
          >
            {filters.dateRangeOn && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) =>
                    setFilters({ ...filters, fromDate: e.target.value })
                  }
                  className="border border-slate-200 rounded-full px-3 py-1.5 text-sm"
                />
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) =>
                    setFilters({ ...filters, toDate: e.target.value })
                  }
                  className="border border-slate-200 rounded-full px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </Section>

          <Section title="Filter by pin status">
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => {
                const active = filters.statuses.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleStatus(s.key)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-medium border transition flex items-center gap-2 " +
                      (active
                        ? "text-white border-transparent"
                        : "text-slate-600 bg-white hover:bg-slate-50 border-slate-200")
                    }
                    style={
                      active
                        ? { backgroundColor: s.color }
                        : { borderColor: s.color, color: s.color }
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: active ? "white" : s.color }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Show Customers"
            action={
              <Toggle
                on={filters.showCustomers}
                onChange={(on) =>
                  setFilters({ ...filters, showCustomers: on })
                }
              />
            }
          />

          <Section
            title="Filter by person"
            action={
              <button
                onClick={() => setStaffOpen((o) => !o)}
                className="text-xs text-slate-500"
              >
                {staffOpen ? "Hide" : "Show"}
              </button>
            }
          >
            {staffOpen && (
              <div className="space-y-1.5">
                {staff.length === 0 ? (
                  <p className="text-sm text-slate-400">No team members yet.</p>
                ) : (
                  staff.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={filters.staffIds.includes(s.id)}
                        onChange={() => toggleStaff(s.id)}
                        className="rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                      />
                      {s.name}
                      {s.role && (
                        <span className="text-xs text-slate-400">
                          · {s.role}
                        </span>
                      )}
                    </label>
                  ))
                )}
                {filters.staffIds.length === 0 && staff.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Empty selection shows all pins.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={reset}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-2 font-medium"
          >
            Done
          </button>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-slate-700 text-sm">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={
        "relative w-10 h-6 rounded-full transition " +
        (on ? "bg-cyan-500" : "bg-slate-200")
      }
      aria-pressed={on}
    >
      <span
        className={
          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition " +
          (on ? "left-[18px]" : "left-0.5")
        }
      />
    </button>
  );
}
