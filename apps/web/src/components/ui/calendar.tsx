"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar primitive backed by react-day-picker v9.
 *
 * Pulse-tuned defaults: rounded selection, dark surface, bold weekday
 * headers, today highlighted with the same outline pattern used by
 * focused inputs. Uses native CSS variable overrides via classNames so
 * we don't fight the library's own styles.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-3",
        month_caption: "flex justify-center items-center h-7 relative",
        caption_label: "text-sm font-extrabold tracking-tight text-white",
        nav: "flex items-center gap-1 absolute right-0 top-0",
        button_previous:
          "h-7 w-7 inline-flex items-center justify-center rounded-full text-zinc-400 hover:bg-black hover:text-white",
        button_next:
          "h-7 w-7 inline-flex items-center justify-center rounded-full text-zinc-400 hover:bg-black hover:text-white",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 w-9 text-center",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button:
          "h-9 w-9 rounded-full font-bold text-zinc-300 hover:bg-black hover:text-white aria-selected:bg-slate-900 aria-selected:text-white aria-selected:hover:bg-slate-800",
        selected: "bg-slate-900 text-white hover:bg-slate-800",
        today:
          "outline outline-1 outline-offset-[-2px] outline-zinc-500 rounded-full",
        outside: "text-zinc-600 opacity-50",
        disabled: "text-zinc-700 opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
