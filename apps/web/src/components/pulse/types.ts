// Pure type definitions for the pulse UI kit.
// Lives in its own non-"use client" file so server components can import the
// types without crossing a client/server module boundary.

// `label`, when present, is a human range string for a bucketed point
// (e.g. monthly "Jul 1–5"); the chart tooltip prefers it over the raw date.
export type RevenuePoint = { date: string; cents: number; label?: string };

export type RevenueSummary = {
  totalCents: number;
  jobsCompleted: number;
  customersCount: number;
  daily: RevenuePoint[];
};

export type LiveJob = {
  id: number;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: string;
  customer_name: string;
  customer_address: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

export type PipelineEntry = {
  label: string;
  count: number;
  value: number;
  pct: number;
};
