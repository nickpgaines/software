"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StaffSinglePicker, type Staff } from "./StaffPickers";

export const LEAD_METHODS = ["Online", "Direct", "Other"] as const;
export type LeadMethod = (typeof LEAD_METHODS)[number];

export function LeadSourceField({
  staff,
  salesId,
  setSalesId,
  leadMethod,
  setLeadMethod,
  placeholder = "Select salesperson…",
}: {
  staff: Staff[];
  salesId: number | null;
  setSalesId: (id: number | null) => void;
  leadMethod: string;
  setLeadMethod: (m: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="block text-xs font-bold text-zinc-500 mb-2">
        Lead Source
      </Label>
      <StaffSinglePicker
        staff={staff}
        id={salesId}
        setId={setSalesId}
        placeholder={placeholder}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3">
        {LEAD_METHODS.map((m) => (
          <Label
            key={m}
            className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold"
          >
            {/* Checkbox primitive used as a single-select toggle so the
                lead-method row visually matches the Anytime / Schedule
                later checkboxes elsewhere. Selecting one clears the others. */}
            <Checkbox
              checked={leadMethod === m}
              onCheckedChange={(c) => setLeadMethod(c === true ? m : "")}
              className="rounded border-line-strong text-white focus:ring-zinc-500"
            />
            {m}
          </Label>
        ))}
      </div>
    </div>
  );
}
