"use client";

import { X } from "lucide-react";
import { staffColorHex } from "@/lib/staff-colors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type DateRange =
  | "all"
  | "today"
  | "7d"
  | "1m"
  | "3m"
  | "6m"
  | "1y";

export const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "1m", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "1y", label: "Last year" },
  { key: "all", label: "All time" },
];

export type FilterStaff = {
  id: number;
  name: string;
  color: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MapFilterPanel({
  showCustomers,
  showSubscriptions,
  dateRange,
  selectedEmployeeIds,
  staff,
  onChangeShowCustomers,
  onChangeShowSubscriptions,
  onChangeDateRange,
  onChangeEmployeeIds,
  onClose,
}: {
  showCustomers: boolean;
  showSubscriptions: boolean;
  dateRange: DateRange;
  selectedEmployeeIds: number[] | null; // null = all
  staff: FilterStaff[];
  onChangeShowCustomers: (v: boolean) => void;
  onChangeShowSubscriptions: (v: boolean) => void;
  onChangeDateRange: (v: DateRange) => void;
  onChangeEmployeeIds: (v: number[] | null) => void;
  onClose: () => void;
}) {
  const allEmployees = selectedEmployeeIds === null;

  function toggleEmployee(id: number) {
    if (allEmployees) {
      onChangeEmployeeIds([id]);
      return;
    }
    const next = selectedEmployeeIds!.includes(id)
      ? selectedEmployeeIds!.filter((x) => x !== id)
      : [...selectedEmployeeIds!, id];
    onChangeEmployeeIds(next.length === 0 ? null : next);
  }

  return (
    <div className="absolute top-4 right-16 z-10 w-72 max-h-[80vh] flex flex-col rounded-lg border border-line bg-card shadow-md">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="font-extrabold text-white tracking-tight text-sm">Filters</h3>
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-y-auto p-4 space-y-5">
        <Section label="Show">
          <CheckRow
            checked={showCustomers}
            onChange={onChangeShowCustomers}
            label="Customers"
            swatch="#dc2626"
          />
          <CheckRow
            checked={showSubscriptions}
            onChange={onChangeShowSubscriptions}
            label="Subscriptions"
            swatch="#22c55e"
          />
        </Section>

        <Section label="Date">
          <div className="space-y-1">
            {DATE_RANGES.map((r) => (
              <Label
                key={r.key}
                className="flex items-center gap-2 text-sm cursor-pointer py-1 font-bold"
              >
                {/* Native <input type="radio"> kept: no Radio primitive in components/ui yet. */}
                <input
                  type="radio"
                  name="map-filter-date"
                  checked={dateRange === r.key}
                  onChange={() => onChangeDateRange(r.key)}
                  className="accent-slate-900"
                />
                <span className="text-zinc-300">{r.label}</span>
              </Label>
            ))}
          </div>
        </Section>

        <Section label="Employee">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChangeEmployeeIds(null)}
            className={
              "h-auto text-xs px-2 py-1 rounded-full mb-2 font-bold " +
              (allEmployees
                ? "bg-slate-900 text-white hover:bg-slate-900"
                : "bg-black text-zinc-400 hover:bg-line")
            }
          >
            All employees
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {staff.length === 0 && (
              <p className="text-eyebrow uppercase text-zinc-500">No employees yet.</p>
            )}
            {staff.map((s) => {
              const active =
                !allEmployees && selectedEmployeeIds!.includes(s.id);
              return (
                <Button
                  key={s.id}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleEmployee(s.id)}
                  className={
                    "h-auto gap-1.5 rounded-full pl-1 pr-2 py-0.5 text-xs border font-bold " +
                    (active
                      ? "border-transparent text-white hover:bg-current"
                      : "border-line text-zinc-300 hover:bg-black")
                  }
                  style={
                    active ? { backgroundColor: staffColorHex(s.color) } : {}
                  }
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white tracking-tight"
                    style={{ backgroundColor: staffColorHex(s.color) }}
                  >
                    {initials(s.name)}
                  </span>
                  {s.name}
                </Button>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  swatch,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  swatch: string;
}) {
  return (
    <Label className="flex items-center gap-2 text-sm cursor-pointer py-1 font-bold">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <span
        className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: swatch }}
      />
      <span className="text-zinc-300">{label}</span>
    </Label>
  );
}
