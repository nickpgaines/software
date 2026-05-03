import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type JobRow = {
  id: number;
  customer_id: number;
  scheduled_at: string;
  price_cents: number;
  status: string;
  title: string | null;
};

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const customers = (await db
    .prepare(
      `SELECT id, name, phone, email, address FROM customers
       WHERE company_id = ?
         AND address IS NOT NULL AND TRIM(address) != ''
       ORDER BY name COLLATE NOCASE`
    )
    .all(companyId)) as CustomerRow[];
  const jobs = (await db
    .prepare(
      `SELECT j.id, j.customer_id, j.scheduled_at, j.price_cents, j.status,
              (SELECT li.title FROM line_items li WHERE li.job_id = j.id
               ORDER BY li.position ASC, li.id ASC LIMIT 1) AS title
       FROM jobs j
       WHERE j.company_id = ?
       ORDER BY j.scheduled_at DESC`
    )
    .all(companyId)) as JobRow[];

  const byCustomer = new Map<number, JobRow[]>();
  for (const job of jobs) {
    const arr = byCustomer.get(job.customer_id) || [];
    arr.push(job);
    byCustomer.set(job.customer_id, arr);
  }

  return NextResponse.json(
    customers.map((c) => ({
      ...c,
      jobs: byCustomer.get(c.id) || [],
    }))
  );
}
