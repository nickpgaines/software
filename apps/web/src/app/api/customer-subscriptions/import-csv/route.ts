import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb, type SubscriptionInterval } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";

export const dynamic = "force-dynamic";

/**
 * CSV-based subscription plan import. Used when the merchant is migrating
 * from a CRM (Homebase360, Jobber) whose Stripe account is owned by that
 * CRM as a Connect platform — Forge can't list those Stripe Subs directly.
 *
 * Each CSV row becomes a pending Forge subscription with the right plan
 * details and a scheduled future visit. No Stripe Subscription is created
 * up-front; that happens later when the customer signs the accept link
 * (typically at the next service visit, handed to them by the tech). This
 * matches the Flyra-style "everything but the card transfers" model.
 *
 * Customer matching is by normalized name only — Homebase360's
 * subscriptions export doesn't include email/phone. Rows with no matching
 * Forge customer (or a canceled source status) are skipped with a clear
 * reason; nothing's silently dropped.
 */

type ImportRow = {
  // ISO; client pre-normalizes from "MM/DD/YYYY" via Date()
  start_date?: string | null;
  customer_name?: string | null;
  plan_name?: string | null;
  amount_cents?: number | null;
  interval?: SubscriptionInterval | null;
  // Raw source-status text — used to skip canceled rows; everything else
  // imports as Forge `pending` regardless of source value
  status?: string | null;
  sold_by?: string | null;
};

type Skipped = { row: number; reason: string };
type ErrorEntry = { row: number; reason: string };

function makeAcceptToken() {
  return randomBytes(24).toString("base64url");
}

function normalizeName(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
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
  let inserted = 0;

  const batchTag = `csv-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const rowNum = i + 1;

      const customerName = (raw.customer_name || "").toString().trim();
      if (!customerName) {
        errors.push({ row: rowNum, reason: "Missing customer name" });
        continue;
      }

      const status = (raw.status || "").toLowerCase().trim();
      if (status === "canceled" || status === "cancelled") {
        skippedReasons.push({
          row: rowNum,
          reason: `Status "${status}" — skipped`,
        });
        continue;
      }

      const customerId = customerByName.get(normalizeName(customerName));
      if (!customerId) {
        skippedReasons.push({
          row: rowNum,
          reason: `Customer "${customerName}" not in Forge — import customers first`,
        });
        continue;
      }

      const interval = raw.interval || null;
      if (!interval) {
        errors.push({
          row: rowNum,
          reason:
            "Frequency couldn't be mapped (supported: weekly, biweekly, monthly, quarterly, 4-monthly, 6-monthly, yearly)",
        });
        continue;
      }

      const amountCents = Math.round(Number(raw.amount_cents) || 0);
      if (amountCents <= 0) {
        errors.push({ row: rowNum, reason: "Amount must be greater than zero" });
        continue;
      }

      const planName =
        (raw.plan_name || "").toString().trim() || "Service plan";
      const startDateRaw = (raw.start_date || "").toString().trim();
      const startDate = startDateRaw ? startDateRaw.slice(0, 10) : null;
      const soldById = raw.sold_by
        ? staffByName.get(normalizeName(raw.sold_by)) ?? null
        : null;
      const acceptToken = makeAcceptToken();

      let subscriptionId: number;
      try {
        const result = await db
          .prepare(
            `INSERT INTO customer_subscriptions
               (company_id, customer_id, name, price_cents, interval,
                service_interval, status, start_date, sold_by_id,
                tax_rate_bps, accept_token, created_by,
                imported_from, import_batch)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, 'csv-import', 'homebase360', ?)`
          )
          .run(
            companyId,
            customerId,
            planName,
            amountCents,
            interval,
            interval,
            startDate,
            soldById,
            acceptToken,
            batchTag
          );
        subscriptionId = Number(result.lastInsertRowid);
      } catch (e) {
        errors.push({
          row: rowNum,
          reason: e instanceof Error ? e.message : "Insert failed",
        });
        continue;
      }

      // Seed a rolling visit window so the next service date is on the
      // calendar — that's the visit the tech uses to collect the card.
      // Best-effort: a scheduler hiccup shouldn't roll back the row.
      try {
        await ensureRollingVisits(db, {
          subscriptionId,
          customerId,
          companyId,
          startDateIso: startDateToIso(startDate || new Date().toISOString()),
          serviceInterval: interval,
          pricePerVisitCents: amountCents,
          visitName: planName,
          visitDescription: null,
          soldById,
          technicianId: null,
        });
      } catch (e) {
        console.error(
          `ensureRollingVisits failed for sub ${subscriptionId}:`,
          e
        );
      }

      inserted++;
    }
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
    batch: batchTag,
    inserted,
    skipped: skippedReasons.length,
    skippedReasons,
    errors,
  });
}
