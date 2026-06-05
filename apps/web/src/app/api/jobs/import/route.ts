import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Historical job import — populates a customer's past service history
 * from a Homebase360 (or similar CRM) Jobs export. Each row becomes a
 * Forge Job row, optionally with a linked Payment row when the source
 * marked the job as Paid.
 *
 * Matches each row to a Forge customer by name (normalized: lowercase +
 * collapsed whitespace). Rows whose customer doesn't already exist in
 * Forge are skipped — run the customer import first.
 */

type ImportRow = {
  customer_name?: string | null;
  // ISO timestamps. Client normalizes; server validates and falls back
  // if a row's value is unparseable rather than rejecting the row.
  scheduled_at?: string | null;
  date_added?: string | null;
  status?: string | null;
  payment_method?: string | null;
  amount_cents?: number | null;
  tip_cents?: number | null;
  lead_source?: string | null;
  dispatched_to?: string | null;
  recurrence?: string | null;
};

type Skipped = { row: number; reason: string };
type ErrorEntry = { row: number; reason: string };

function normalizeName(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Forge job statuses are open-ended (TEXT, no CHECK), but the rest of
// the UI generally treats 'completed' / 'canceled' / 'scheduled'. Map
// each Homebase360 status onto a Forge status. Anything we don't know
// becomes 'completed' since this importer is for historical data only.
function mapStatus(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase().trim();
  if (s.includes("cancel")) return "canceled";
  if (s.includes("finish") || s.includes("paid") || s.includes("complete"))
    return "completed";
  if (s.includes("schedul")) return "scheduled";
  return "completed";
}

// payments.method has a CHECK constraint: card/cash/check/e_transfer/other.
// Map common Homebase360 payment-method strings onto that set. Empty /
// "none" returns null so the caller skips inserting a Payment row.
function mapPaymentMethod(
  raw: string | null | undefined
):
  | "card"
  | "cash"
  | "check"
  | "e_transfer"
  | "other"
  | null {
  const s = (raw || "").toLowerCase().trim();
  if (!s || s === "none") return null;
  if (s.includes("check")) return "check";
  if (s.includes("cash")) return "cash";
  if (s.includes("card") || s.includes("credit") || s.includes("debit"))
    return "card";
  if (s.includes("transfer") || s.includes("e-transfer") || s.includes("etransfer"))
    return "e_transfer";
  return "other";
}

function toIsoOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as { rows?: ImportRow[] };
  const rows = body.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: "rows array is required" },
      { status: 400 }
    );
  }

  // Build name → customer_id and name → staff_id lookups once. Customer
  // sets are typically a few hundred; staff a handful — fine to keep in
  // memory for the duration of the import.
  const customers = (await db
    .prepare("SELECT id, name FROM customers WHERE company_id = ?")
    .all(companyId)) as { id: number; name: string }[];
  const customerByName = new Map<string, number>();
  for (const c of customers) {
    const k = normalizeName(c.name);
    if (k && !customerByName.has(k)) customerByName.set(k, c.id);
  }

  const staff = (await db
    .prepare("SELECT id, name FROM staff WHERE company_id = ?")
    .all(companyId)) as { id: number; name: string }[];
  const staffByName = new Map<string, number>();
  for (const s of staff) {
    const k = normalizeName(s.name);
    if (k && !staffByName.has(k)) staffByName.set(k, s.id);
  }

  const skippedReasons: Skipped[] = [];
  const errors: ErrorEntry[] = [];
  let insertedJobs = 0;
  let insertedPayments = 0;

  try {
    await db.transaction(async (tx) => {
      const insertJob = tx.prepare(
        `INSERT INTO jobs
           (customer_id, scheduled_at, duration_minutes, price_cents,
            status, notes, lead_source, technician_id, salesperson_id,
            completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
      );
      const insertPayment = tx.prepare(
        `INSERT INTO payments
           (company_id, job_id, amount_cents, tip_cents, method,
            payment_date, notes, send_email, send_sms, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'import')`
      );

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const rowNum = i + 1;

        const customerName = (raw.customer_name || "").toString();
        const lookup = normalizeName(customerName);
        if (!lookup) {
          errors.push({ row: rowNum, reason: "Missing customer name" });
          continue;
        }
        const customerId = customerByName.get(lookup);
        if (!customerId) {
          skippedReasons.push({
            row: rowNum,
            reason: `Customer "${customerName.trim()}" not found in Forge — import customers first`,
          });
          continue;
        }

        const scheduledAt =
          toIsoOrNull(raw.scheduled_at) || new Date().toISOString();
        const dateAdded = toIsoOrNull(raw.date_added);
        const status = mapStatus(raw.status);
        const method = mapPaymentMethod(raw.payment_method);
        const amount = Math.round(
          Number(raw.amount_cents ?? 0) || 0
        );
        const tip = Math.round(Number(raw.tip_cents ?? 0) || 0);

        const technicianId = raw.dispatched_to
          ? staffByName.get(normalizeName(raw.dispatched_to)) ?? null
          : null;
        const salespersonId = raw.lead_source
          ? staffByName.get(normalizeName(raw.lead_source)) ?? null
          : null;

        // Stash any source-side metadata the job row can't represent
        // structurally — recurrence, the lead-source text when it
        // didn't map to a staff row, the technician name when same.
        const notesParts: string[] = [];
        if (raw.recurrence && raw.recurrence.toLowerCase() !== "none") {
          notesParts.push(`Recurrence: ${raw.recurrence}`);
        }
        if (raw.dispatched_to && !technicianId) {
          notesParts.push(`Dispatched to: ${raw.dispatched_to}`);
        }
        const notes = notesParts.length ? notesParts.join(" · ") : null;

        const completedAt = status === "completed" ? scheduledAt : null;

        const jobRes = await insertJob.run(
          customerId,
          scheduledAt,
          60,
          amount,
          status,
          notes,
          raw.lead_source && !salespersonId ? raw.lead_source : null,
          technicianId,
          salespersonId,
          completedAt,
          dateAdded
        );
        const jobId = Number(jobRes.lastInsertRowid);
        insertedJobs++;

        // Record a Payment row when the source said Paid AND we got a
        // concrete method + amount. "Finished" without a method is a
        // completed-but-unpaid job — leave it as just a Job row.
        if (method && amount > 0) {
          await insertPayment.run(
            companyId,
            jobId,
            amount,
            tip,
            method,
            scheduledAt.slice(0, 10),
            "Imported from prior CRM"
          );
          insertedPayments++;
        }
      }
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Import failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    inserted_jobs: insertedJobs,
    inserted_payments: insertedPayments,
    skipped: skippedReasons.length,
    skippedReasons,
    errors,
  });
}
