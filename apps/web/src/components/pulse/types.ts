// Pure type definitions for the pulse UI kit.
// Lives in its own non-"use client" file so server components can import the
// types without crossing a client/server module boundary.

export type RevenuePoint = { date: string; cents: number };

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
