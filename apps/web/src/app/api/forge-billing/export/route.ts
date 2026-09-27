import { NextResponse } from "next/server";
import type { Db } from "@/lib/db";
import { getDb } from "@/lib/db";
import { billingResponse, billingSession } from "@/lib/forge-billing/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function all(db: Db, sql: string, companyId: number) {
  return db.prepare(sql).all<Record<string, unknown>>(companyId);
}

function exportFilename(companyName: unknown) {
  const slug = String(companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "company";
  return `forge-${slug}-export-${new Date().toISOString().slice(0, 10)}.json`;
}

async function companyExport(db: Db, companyId: number) {
  const company = await db
    .prepare(
      `SELECT id, name, address, phone, email, website, time_zone,
              default_tax_rate_bps, tax_applied_by_default
         FROM company WHERE id = ? LIMIT 1`
    )
    .get<Record<string, unknown>>(companyId);
  if (!company) throw new Error("Company not found");

  return {
    exportedAt: new Date().toISOString(),
    company,
    staff: await all(
      db,
      `SELECT id, name, first_name, last_name, phone, email, color,
              permission_level, photo_url, sales_commission_rate,
              tech_commission_rate, created_at, updated_at
         FROM staff WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    customers: await all(
      db,
      `SELECT id, name, first_name, last_name, phone, email, address,
              address_line1, unit, city, state, zip, latitude, longitude,
              formatted_address, notes, is_recurring, created_at, updated_at
         FROM customers WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    jobs: await all(
      db,
      `SELECT id, customer_id, scheduled_at, duration_minutes, price_cents,
              status, notes, salesperson_id, technician_id, end_time, anytime,
              schedule_later, lead_source, en_route_at, arrived_at, started_at,
              completed_at, recurring, subscription_id,
              subscription_visit_index, created_at
         FROM jobs WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    messages: await all(
      db,
      `SELECT id, customer_id, body, direction, created_at, read_at, status
         FROM messages WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    payments: await all(
      db,
      `SELECT id, job_id, amount_cents, tip_cents, method, payment_date,
              notes, source, created_at
         FROM payments WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    estimates: await all(
      db,
      `SELECT id, customer_id, title, notes, status, total_cents, tax_rate_bps,
              valid_until, sent_at, accepted_at, declined_at, sold_by_id,
              lead_source, created_by, created_at, updated_at
         FROM estimates WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    estimateItems: await all(
      db,
      `SELECT item.id, item.estimate_id, item.title, item.description,
              item.quantity, item.price_cents, item.taxable, item.position
         FROM estimate_items item
         JOIN estimates parent ON parent.id = item.estimate_id
        WHERE parent.company_id = ? ORDER BY item.id`,
      companyId
    ),
    invoices: await all(
      db,
      `SELECT id, customer_id, job_id, title, notes, status, total_cents,
              paid_cents, tax_rate_bps, due_date, sent_at, paid_at, voided_at,
              sold_by_id, created_by, lead_source, payment_method,
              created_at, updated_at
         FROM invoices WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    invoiceItems: await all(
      db,
      `SELECT item.id, item.invoice_id, item.title, item.description,
              item.quantity, item.price_cents, item.taxable, item.position
         FROM invoice_items item
         JOIN invoices parent ON parent.id = item.invoice_id
        WHERE parent.company_id = ? ORDER BY item.id`,
      companyId
    ),
    customerSubscriptions: await all(
      db,
      `SELECT id, customer_id, template_id, name, description, price_cents,
              interval, service_interval, status, sent_at, accepted_at,
              canceled_at, created_by, terms_snapshot, require_signature,
              signature_name, signed_at, start_date, sold_by_id, created_at
         FROM customer_subscriptions WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    leads: await all(
      db,
      `SELECT id, first_name, last_name, email, phone, address, source, stage,
              position, notes, customer_id, contacted_at, responded_at,
              estimate_sent_at, created_at, updated_at
         FROM leads WHERE company_id = ? ORDER BY id`,
      companyId
    ),
    tasks: await all(
      db,
      `SELECT id, created_by_user_id, title, details, start_at, end_at,
              assignee_user_id, is_team_task, recurrence,
              recurrence_parent_id, status, completed_at,
              completed_by_user_id, created_at, updated_at
         FROM tasks WHERE company_id = ? ORDER BY id`,
      companyId
    ),
  };
}

export async function GET(req: Request) {
  return billingResponse(async () => {
    const session = await billingSession(req, true);
    const payload = await companyExport(await getDb(), session.companyId);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(
          payload.company.name
        )}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
