import { NextResponse } from "next/server";
import {
  getDb,
  type Customer,
  type CustomerSubscription,
  type Estimate,
  type Invoice,
  type Message,
} from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { normalizeAddress } from "@/lib/customer-address";
import { computeJobStatus, type JobStatus } from "@/lib/jobs";

export const dynamic = "force-dynamic";

function buildName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

function pick<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

type CustomerJobRow = {
  id: number;
  scheduled_at: string;
  description: string | null;
  lead_source: string | null;
  employees: string | null;
  price_cents: number;
  paid_total_cents: number;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  job_status: JobStatus;
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const customer = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Customer | undefined;
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jobRows = (await db
    .prepare(
      `SELECT j.id,
              j.scheduled_at,
              j.lead_source,
              j.price_cents,
              j.en_route_at,
              j.arrived_at,
              j.started_at,
              j.completed_at,
              (SELECT li.title FROM line_items li
                 WHERE li.job_id = j.id
                 ORDER BY li.position ASC, li.id ASC LIMIT 1) AS description,
              (SELECT GROUP_CONCAT(s.name, ', ')
                 FROM job_assignments ja
                 JOIN staff s ON s.id = ja.staff_id
                WHERE ja.job_id = j.id) AS employees,
              COALESCE(
                (SELECT SUM(p.amount_cents) FROM payments p WHERE p.job_id = j.id),
                0
              ) AS paid_total_cents
         FROM jobs j
        WHERE j.company_id = ? AND j.customer_id = ?
        ORDER BY j.scheduled_at DESC, j.id DESC`
    )
    .all(companyId, id)) as Omit<CustomerJobRow, "job_status">[];

  const jobs: CustomerJobRow[] = jobRows.map((row) => ({
    ...row,
    job_status: computeJobStatus({
      en_route_at: row.en_route_at,
      arrived_at: row.arrived_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      price_cents: row.price_cents,
      paid_total_cents: row.paid_total_cents,
    }),
  }));

  const estimates = (await db
    .prepare(
      `SELECT * FROM estimates
        WHERE company_id = ? AND customer_id = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(companyId, id)) as Estimate[];

  const invoices = (await db
    .prepare(
      `SELECT * FROM invoices
        WHERE company_id = ? AND customer_id = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(companyId, id)) as Invoice[];

  const subscriptions = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ? AND customer_id = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(companyId, id)) as CustomerSubscription[];

  const lastMessage =
    ((await db
      .prepare(
        `SELECT * FROM messages
          WHERE company_id = ? AND customer_id = ?
          ORDER BY created_at DESC, id DESC LIMIT 1`
      )
      .get(companyId, id)) as Message | undefined) || null;

  const unreadRow = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
        WHERE company_id = ? AND customer_id = ?
          AND direction = 'inbound' AND read_at IS NULL`
    )
    .get(companyId, id)) as { n: number } | undefined;

  const lifetime_revenue_cents = jobs
    .filter((j) => !!j.completed_at)
    .reduce((sum, j) => sum + (j.paid_total_cents || 0), 0);
  const completedJobs = jobs.filter((j) => !!j.completed_at);
  const avg_job_cents = completedJobs.length
    ? Math.round(
        completedJobs.reduce((s, j) => s + (j.price_cents || 0), 0) /
          completedJobs.length
      )
    : 0;
  const last_service_at =
    completedJobs[0]?.completed_at ||
    completedJobs[0]?.scheduled_at ||
    null;
  const outstanding_cents = jobs
    .filter((j) => !!j.completed_at)
    .reduce(
      (sum, j) =>
        sum + Math.max(0, (j.price_cents || 0) - (j.paid_total_cents || 0)),
      0
    );

  return NextResponse.json({
    customer,
    stats: {
      jobs_count: jobs.length,
      lifetime_revenue_cents,
      avg_job_cents,
      last_service_at,
      outstanding_cents,
    },
    jobs,
    estimates,
    invoices,
    subscriptions,
    last_message: lastMessage,
    unread_message_count: unreadRow?.n || 0,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<Customer>;
  const existing = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Customer | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const first = (body.first_name ?? existing.first_name ?? "").trim();
  const last = (body.last_name ?? existing.last_name ?? "").trim();
  if (!first || !last) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }
  const name = buildName(first, last);

  // Treat any address-related field provided in the request as part of
  // the new structured address. If none of the new fields are present,
  // keep the existing structured address as-is.
  const anyStructuredProvided =
    body.address_line1 !== undefined ||
    body.unit !== undefined ||
    body.city !== undefined ||
    body.state !== undefined ||
    body.zip !== undefined ||
    body.latitude !== undefined ||
    body.longitude !== undefined ||
    body.formatted_address !== undefined ||
    body.address !== undefined;

  const addr = anyStructuredProvided
    ? normalizeAddress(
        {
          address_line1: pick(body.address_line1, existing.address_line1),
          unit: pick(body.unit, existing.unit),
          city: pick(body.city, existing.city),
          state: pick(body.state, existing.state),
          zip: pick(body.zip, existing.zip),
          latitude: pick(body.latitude, existing.latitude),
          longitude: pick(body.longitude, existing.longitude),
          formatted_address: pick(
            body.formatted_address,
            existing.formatted_address
          ),
        },
        { legacyAddress: pick(body.address, existing.address) }
      )
    : {
        address: existing.address,
        address_line1: existing.address_line1,
        unit: existing.unit,
        city: existing.city,
        state: existing.state,
        zip: existing.zip,
        latitude: existing.latitude,
        longitude: existing.longitude,
        formatted_address: existing.formatted_address,
      };

  await db.prepare(
    `UPDATE customers
     SET name = ?, first_name = ?, last_name = ?, phone = ?, email = ?,
         address = ?, address_line1 = ?, unit = ?, city = ?, state = ?, zip = ?,
         latitude = ?, longitude = ?, formatted_address = ?, notes = ?
     WHERE id = ? AND company_id = ?`
  ).run(
    name,
    first,
    last,
    body.phone ?? existing.phone,
    body.email ?? existing.email,
    addr.address,
    addr.address_line1,
    addr.unit,
    addr.city,
    addr.state,
    addr.zip,
    addr.latitude,
    addr.longitude,
    addr.formatted_address,
    body.notes ?? existing.notes,
    id,
    companyId
  );
  const updated = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Customer;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM customers WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return NextResponse.json({ ok: true });
}
