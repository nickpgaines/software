import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export type CustomerPin = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  is_recurring: number;
  created_at: string;
  has_active_subscription: number;
  latest_subscription_created_at: string | null;
  subscription_employee_ids: number[];
  customer_employee_ids: number[];
};

type Row = Omit<
  CustomerPin,
  "subscription_employee_ids" | "customer_employee_ids"
> & {
  subscription_sold_by_csv: string | null;
  customer_salesperson_csv: string | null;
};

function parseIdCsv(csv: string | null): number[] {
  if (!csv) return [];
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    )
  );
}

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT
         c.id, c.name, c.phone, c.address, c.formatted_address,
         c.latitude, c.longitude, c.is_recurring, c.created_at,
         CASE WHEN EXISTS(
           SELECT 1 FROM customer_subscriptions s
           WHERE s.customer_id = c.id AND s.status = 'active'
         ) THEN 1 ELSE 0 END AS has_active_subscription,
         (
           SELECT MAX(s.created_at) FROM customer_subscriptions s
           WHERE s.customer_id = c.id AND s.status = 'active'
         ) AS latest_subscription_created_at,
         (
           SELECT GROUP_CONCAT(DISTINCT s.sold_by_id)
             FROM customer_subscriptions s
            WHERE s.customer_id = c.id
              AND s.status = 'active'
              AND s.sold_by_id IS NOT NULL
         ) AS subscription_sold_by_csv,
         (
           SELECT GROUP_CONCAT(DISTINCT j.salesperson_id)
             FROM jobs j
            WHERE j.customer_id = c.id
              AND j.salesperson_id IS NOT NULL
         ) AS customer_salesperson_csv
       FROM customers c
      WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`
    )
    .all()) as Row[];

  const out: CustomerPin[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    formatted_address: r.formatted_address,
    latitude: r.latitude,
    longitude: r.longitude,
    is_recurring: r.is_recurring,
    created_at: r.created_at,
    has_active_subscription: r.has_active_subscription,
    latest_subscription_created_at: r.latest_subscription_created_at,
    subscription_employee_ids: parseIdCsv(r.subscription_sold_by_csv),
    customer_employee_ids: parseIdCsv(r.customer_salesperson_csv),
  }));
  return NextResponse.json(out);
}
