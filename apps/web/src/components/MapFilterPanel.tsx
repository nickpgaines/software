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

// Mirrors MapClient.tsx CUSTOMER_PIN_COLOR / SUBSCRIPTION_PIN_COLOR so the
// filter swatches read as the same family as the rendered pins.
const CUSTOMER_PIN_COLOR = "#dc2626";
const SUBSCRIPTION_PIN_COLOR = "#22c55e";

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
            pinColor={CUSTOMER_PIN_COLOR}
          />
          <CheckRow
            checked={showSubscriptions}
            onChange={onChangeShowSubscriptions}
            label="Subscriptions"
            pinColor={SUBSCRIPTION_PIN_COLOR}
          />
        </Section>

        <Section label="Date">
          <div className="flex flex-wrap gap-1.5">
            {DATE_RANGES.map((r) => {
              const active = dateRange === r.key;
              return (
                <Button
                  key={r.key}
                  type="button"
                  variant="ghost"
                  onClick={() => onChangeDateRange(r.key)}
                  className={
                    "h-auto rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap " +
                    (active
                      ? "bg-card text-white shadow-sm border border-line-strong hover:bg-card"
                      : "bg-black text-zinc-400 border border-transparent hover:text-white hover:bg-black")
                  }
                >
                  {r.label}
                </Button>
              );
            })}
          </div>
        </Section>

        <Section label="Employee">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChangeEmployeeIds(null)}
              className={
                "h-auto rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap " +
                (allEmployees
                  ? "bg-card text-white shadow-sm border border-line-strong hover:bg-card"
                  : "bg-black text-zinc-400 border border-transparent hover:text-white hover:bg-black")
              }
            >
              All employees
            </Button>
            {staff.length === 0 && (
              <p className="text-xs font-bold text-zinc-500 w-full mt-1">
                No employees yet.
              </p>
            )}
            {staff.map((s) => {
              const active =
                !allEmployees && selectedEmployeeIds!.includes(s.id);
              const color = staffColorHex(s.color);
              return (
                <Button
                  key={s.id}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleEmployee(s.id)}
                  className={
                    "h-auto gap-1.5 rounded-full pl-1 pr-3 py-0.5 text-xs font-bold whitespace-nowrap " +
                    (active
                      ? "bg-card text-white shadow-sm border border-line-strong hover:bg-card"
                      : "bg-black text-zinc-400 border border-transparent hover:text-white hover:bg-black")
                  }
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white tracking-tight"
                    style={{ backgroundColor: color }}
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
      <div className="text-xs font-bold text-zinc-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

/**
 * Mini pin preview — mirrors `makeCustomerMarkerElement` in `MapClient.tsx`
 * so the filter swatch reads as the same family as the actual map pin
 * (filled colored circle, colored holographic glow, centered white person
 * glyph). Sized down from 28px → 20px for the filter row.
 */
function PinSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 20,
        height: 20,
        backgroundColor: color,
        boxShadow:
          `0 0 0 1px ${color},` +
          `0 0 8px 1px ${color}cc,` +
          `0 0 16px 3px ${color}55,` +
          "0 2px 4px rgba(0,0,0,0.45)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={12}
        height={12}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <circle cx="12" cy="8" r="4" fill="#ffffff" />
        <path
          fill="#ffffff"
          d="M12 14c-4.4 0-8 1.8-8 4v2h16v-2c0-2.2-3.6-4-8-4z"
        />
      </svg>
    </span>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  pinColor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  pinColor: string;
}) {
  return (
    <Label className="flex items-center gap-2.5 text-sm cursor-pointer py-1 font-normal">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <PinSwatch color={pinColor} />
      <span className="text-zinc-300">{label}</span>
    </Label>
  );
}
