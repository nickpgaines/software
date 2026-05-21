"use client";

import { ChevronDown, X } from "lucide-react";
import { staffColorHex } from "@/lib/staff-colors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
          {/* Native <select> kept: matches the form-control select pattern
              used elsewhere (JobForm frequency / ends) and avoids Radix
              Select's empty-string-value restriction. */}
          <select
            value={dateRange}
            onChange={(e) => onChangeDateRange(e.target.value as DateRange)}
            className="h-9 w-full rounded-full border border-line-strong bg-black px-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-canvas"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </Section>

        <Section label="Employee">
          <EmployeeDropdown
            allEmployees={allEmployees}
            selectedEmployeeIds={selectedEmployeeIds}
            staff={staff}
            onSelectAll={() => onChangeEmployeeIds(null)}
            onToggle={toggleEmployee}
          />
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

function EmployeeDropdown({
  allEmployees,
  selectedEmployeeIds,
  staff,
  onSelectAll,
  onToggle,
}: {
  allEmployees: boolean;
  selectedEmployeeIds: number[] | null;
  staff: FilterStaff[];
  onSelectAll: () => void;
  onToggle: (id: number) => void;
}) {
  const selectedCount = selectedEmployeeIds?.length ?? 0;
  const summary = allEmployees
    ? "All employees"
    : selectedCount === 1
      ? (staff.find((s) => s.id === selectedEmployeeIds![0])?.name ??
        "1 selected")
      : `${selectedCount} selected`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-full border border-line-strong bg-black px-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-canvas"
        >
          <span className="truncate text-left">{summary}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[--radix-dropdown-menu-trigger-width] max-h-72 overflow-y-auto"
      >
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onSelectAll();
          }}
          className={allEmployees ? "text-white" : "text-zinc-400"}
        >
          All employees
        </DropdownMenuItem>
        {staff.length > 0 && <DropdownMenuSeparator />}
        {staff.length === 0 && (
          <div className="px-2 py-1.5 text-xs font-bold text-zinc-500">
            No employees yet.
          </div>
        )}
        {staff.map((s) => {
          const checked =
            !allEmployees && selectedEmployeeIds!.includes(s.id);
          const color = staffColorHex(s.color);
          return (
            <DropdownMenuCheckboxItem
              key={s.id}
              checked={checked}
              onSelect={(e) => {
                e.preventDefault();
                onToggle(s.id);
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white tracking-tight"
                  style={{ backgroundColor: color }}
                >
                  {initials(s.name)}
                </span>
                {s.name}
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
