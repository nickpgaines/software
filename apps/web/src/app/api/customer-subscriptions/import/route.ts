import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  getDb,
  type SubscriptionInterval,
  type CustomerSubscriptionStatus,
  type SubscriptionBillingStatus,
} from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  savePaymentMethodForCustomer,
} from "@/lib/stripe";
import { firstChargeOnOrAfter } from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";

// One source row from a Homebase360 (or similar) subscriptions export. The
// client parses the CSV and may join the customer's email/phone from the
// customers export to improve Stripe matching.
type ImportSubRow = {
  customer_name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  plan_name?: string | null;
  amount_cents?: number | null;
  interval?: string | null; // raw frequency text, mapped here
  status?: string | null; // raw source status, mapped here
  start_date?: string | null; // MM/DD/YYYY or ISO
  sold_by?: string | null;
};

type Confidence = "auto" | "review" | "none";

type ReportRow = {
  row: number;
  customer_name: string;
  plan_name: string;
  amount_cents: number;
  interval: SubscriptionInterval;
  status: CustomerSubscriptionStatus;
  billing_status: SubscriptionBillingStatus;
  needs_card: boolean;
  customer_id: number | null;
  customer_will_be_created: boolean;
  stripe_customer_id: string | null;
  payment_method_id: string | null;
  card: { brand: string | null; last4: string | null } | null;
  sold_by_id: number | null;
  next_charge_at: string | null;
  confidence: Confidence;
  issues: string[];
  skipped?: string; // set in commit mode when the row was not written
  created_subscription_id?: number;
};

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function norm(v: unknown): string {
  return clean(v).toLowerCase().replace(/\s+/g, " ");
}

function mapInterval(raw: string): { interval: SubscriptionInterval; ok: boolean } {
  const s = norm(raw).replace(/[-_]/g, " ");
  if (/(^|\b)(weekly|every week)\b/.test(s)) return { interval: "weekly", ok: true };
  if (/(biweekly|bi weekly|every 2 weeks|fortnight)/.test(s))
    return { interval: "biweekly", ok: true };
  if (/(quarter)/.test(s)) return { interval: "quarterly", ok: true };
  if (/(6 month|six month|semi annual|semiannual|bi annual|biannual|twice a year)/.test(s))
    return { interval: "semiannually", ok: true };
  if (/(4 month|four month|tri annual|triannual)/.test(s))
    return { interval: "triannually", ok: true };
  if (/(year|annual)/.test(s)) return { interval: "yearly", ok: true };
  if (/(month)/.test(s)) return { interval: "monthly", ok: true };
  return { interval: "monthly", ok: false };
}

function mapStatus(raw: string): {
  status: CustomerSubscriptionStatus;
  billing: SubscriptionBillingStatus;
} {
  const s = norm(raw);
  if (s === "active") return { status: "active", billing: "current" };
  if (s === "past_due" || s === "pastdue" || s === "past due")
    return { status: "active", billing: "past_due" };
  if (s === "canceled" || s === "cancelled")
    return { status: "canceled", billing: "current" };
  if (s === "declined") return { status: "declined", billing: "current" };
  return { status: "pending", billing: "current" }; // "sent" and unknowns
}

// MM/DD/YYYY -> YYYY-MM-DD; passes through ISO/other parseable dates.
function parseStartDate(raw: string): string | null {
  const s = clean(raw);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as {
    mode?: "reconcile" | "commit";
    rows?: ImportSubRow[];
    approve?: number[];
  };
  const mode = body.mode === "commit" ? "commit" : "reconcile";
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json(
      { error: "Too many rows in one batch (max 1000)" },
      { status: 400 }
    );
  }
  const approve = new Set<number>(Array.isArray(body.approve) ? body.approve : []);

  const company = await getCompany(companyId);
  const stripeReady = Boolean(
    isStripeConfigured() &&
      company.stripe_account_id &&
      company.stripe_charges_enabled
  );
  const stripeAccountId = company.stripe_account_id || "";
  const defaultTaxBps = company.tax_applied_by_default
    ? company.default_tax_rate_bps || 0
    : 0;

  // Existing customers for name/email/phone matching.
  const existingCustomers = (await db
    .prepare(
      "SELECT id, name, email, phone FROM customers WHERE company_id = ?"
    )
    .all(companyId)) as {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
  }[];
  const byName = new Map<string, number[]>();
  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  for (const c of existingCustomers) {
    if (c.name) {
      const k = norm(c.name);
      byName.set(k, [...(byName.get(k) || []), c.id]);
    }
    if (c.email) byEmail.set(norm(c.email), c.id);
    if (c.phone) byPhone.set(c.phone.replace(/\D/g, ""), c.id);
  }

  const staff = (await db
    .prepare("SELECT id, name, first_name, last_name FROM staff WHERE company_id = ?")
    .all(companyId)) as {
    id: number;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  }[];
  function matchStaff(name: string): number | null {
    const n = norm(name);
    if (!n) return null;
    for (const s of staff) {
      const full = norm(s.name || `${s.first_name || ""} ${s.last_name || ""}`);
      if (full && full === n) return s.id;
    }
    return null;
  }

  const stripe = stripeReady ? getStripe() : null;
  // Cache Stripe lookups within the batch so repeated customers don't re-hit.
  const stripeCustCache = new Map<string, string | null>();

  async function findStripeCustomer(
    customerId: number | null,
    email: string,
    name: string
  ): Promise<{ id: string | null; ambiguous: boolean }> {
    // Already linked?
    if (customerId) {
      const linked = (await db
        .prepare(
          "SELECT stripe_customer_id FROM stripe_customers WHERE company_id = ? AND customer_id = ? LIMIT 1"
        )
        .get(companyId, customerId)) as { stripe_customer_id: string } | undefined;
      if (linked?.stripe_customer_id)
        return { id: linked.stripe_customer_id, ambiguous: false };
    }
    if (!stripe) return { id: null, ambiguous: false };
    const cacheKey = `${email}|${name}`;
    if (stripeCustCache.has(cacheKey))
      return { id: stripeCustCache.get(cacheKey)!, ambiguous: false };

    try {
      if (email) {
        const list = await stripe.customers.list(
          { email, limit: 2 },
          { stripeAccount: stripeAccountId }
        );
        if (list.data.length === 1) {
          stripeCustCache.set(cacheKey, list.data[0].id);
          return { id: list.data[0].id, ambiguous: false };
        }
        if (list.data.length > 1) return { id: null, ambiguous: true };
      }
      if (name) {
        const search = await stripe.customers.search(
          { query: `name:"${name.replace(/"/g, "")}"`, limit: 2 },
          { stripeAccount: stripeAccountId }
        );
        if (search.data.length === 1) {
          stripeCustCache.set(cacheKey, search.data[0].id);
          return { id: search.data[0].id, ambiguous: false };
        }
        if (search.data.length > 1) return { id: null, ambiguous: true };
      }
    } catch {
      // Stripe lookup failure shouldn't abort the whole import — surface as
      // "needs review" for this row.
      return { id: null, ambiguous: true };
    }
    stripeCustCache.set(cacheKey, null);
    return { id: null, ambiguous: false };
  }

  async function findDefaultCard(
    stripeCustomerId: string
  ): Promise<{ id: string; brand: string | null; last4: string | null } | null> {
    if (!stripe) return null;
    try {
      const cust = (await stripe.customers.retrieve(stripeCustomerId, undefined, {
        stripeAccount: stripeAccountId,
      })) as { invoice_settings?: { default_payment_method?: string | null } };
      const defaultPm = cust.invoice_settings?.default_payment_method || null;
      const pms = await stripe.paymentMethods.list(
        { customer: stripeCustomerId, type: "card", limit: 10 },
        { stripeAccount: stripeAccountId }
      );
      if (pms.data.length === 0) return null;
      const chosen =
        pms.data.find((p) => p.id === defaultPm) || pms.data[0];
      return {
        id: chosen.id,
        brand: chosen.card?.brand ?? null,
        last4: chosen.card?.last4 ?? null,
      };
    } catch {
      return null;
    }
  }

  const report: ReportRow[] = [];
  const batchId = `hb360-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString("hex")}`;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const issues: string[] = [];
    const customerName = clean(raw.customer_name);
    const planName = clean(raw.plan_name) || "Subscription";
    const email = clean(raw.email);
    const phone = clean(raw.phone);
    const amountCents = Math.max(0, Math.round(Number(raw.amount_cents) || 0));
    const { interval, ok: intervalOk } = mapInterval(clean(raw.interval));
    if (!intervalOk && clean(raw.interval))
      issues.push(`Unrecognized frequency "${clean(raw.interval)}" — defaulted to monthly`);
    const { status, billing } = mapStatus(clean(raw.status));
    const startDate = parseStartDate(clean(raw.start_date));
    const soldById = matchStaff(clean(raw.sold_by));
    // Card needed only for agreements that bill (active / past_due).
    const needsCard = status === "active";

    if (!customerName) issues.push("Missing customer name");
    if (amountCents <= 0) issues.push("Missing or zero amount");

    // Match the customer.
    let customerId: number | null = null;
    if (email && byEmail.has(norm(email))) customerId = byEmail.get(norm(email))!;
    if (!customerId && phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits && byPhone.has(digits)) customerId = byPhone.get(digits)!;
    }
    let nameAmbiguous = false;
    if (!customerId && customerName) {
      const matches = byName.get(norm(customerName)) || [];
      if (matches.length === 1) customerId = matches[0];
      else if (matches.length > 1) nameAmbiguous = true;
    }
    if (nameAmbiguous)
      issues.push("Multiple existing customers match this name — pick one");
    const willCreate = !customerId && !nameAmbiguous && !!customerName;

    // Resolve Stripe customer + card for billing agreements.
    let stripeCustomerId: string | null = null;
    let card: { brand: string | null; last4: string | null } | null = null;
    let paymentMethodId: string | null = null;
    if (needsCard) {
      if (!stripeReady) {
        issues.push("Stripe account not connected — can't locate the saved card");
      } else {
        const found = await findStripeCustomer(customerId, email, customerName);
        if (found.ambiguous) {
          issues.push("Couldn't uniquely match a Stripe customer — needs review");
        } else if (found.id) {
          stripeCustomerId = found.id;
          const c = await findDefaultCard(found.id);
          if (c) {
            card = { brand: c.brand, last4: c.last4 };
            paymentMethodId = c.id;
          } else {
            issues.push("Stripe customer found but no saved card on file");
          }
        } else {
          issues.push("No matching Stripe customer found");
        }
      }
    }

    const nextChargeAt =
      status === "active" && startDate
        ? firstChargeOnOrAfter(`${startDate}T12:00:00.000Z`, interval)
        : null;

    let confidence: Confidence;
    if (issues.some((s) => s.startsWith("Missing"))) confidence = "none";
    else if (needsCard && !paymentMethodId) confidence = nameAmbiguous ? "review" : "none";
    else if (nameAmbiguous) confidence = "review";
    else confidence = "auto";

    const rowReport: ReportRow = {
      row: i + 1,
      customer_name: customerName,
      plan_name: planName,
      amount_cents: amountCents,
      interval,
      status,
      billing_status: billing,
      needs_card: needsCard,
      customer_id: customerId,
      customer_will_be_created: willCreate,
      stripe_customer_id: stripeCustomerId,
      payment_method_id: paymentMethodId,
      card,
      sold_by_id: soldById,
      next_charge_at: nextChargeAt,
      confidence,
      issues,
    };

    if (mode === "commit") {
      const shouldWrite = approve.size === 0 ? confidence === "auto" : approve.has(i);
      if (!shouldWrite) {
        rowReport.skipped = "not approved";
        report.push(rowReport);
        continue;
      }
      if (issues.some((s) => s.startsWith("Missing"))) {
        rowReport.skipped = "missing required fields";
        report.push(rowReport);
        continue;
      }
      try {
        // Resolve / create the customer.
        let cid = customerId;
        if (!cid) {
          const res = await db
            .prepare(
              `INSERT INTO customers (company_id, name, phone, email, address, address_line1, formatted_address)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              companyId,
              customerName,
              phone || null,
              email || null,
              clean(raw.address) || null,
              clean(raw.address) || null,
              clean(raw.address) || null
            );
          cid = Number(res.lastInsertRowid);
        }

        // Skip if this customer already has a subscription with the same plan
        // name (idempotent re-runs).
        const dupe = (await db
          .prepare(
            "SELECT id FROM customer_subscriptions WHERE company_id = ? AND customer_id = ? AND name = ? LIMIT 1"
          )
          .get(companyId, cid, planName)) as { id: number } | undefined;
        if (dupe) {
          rowReport.customer_id = cid;
          rowReport.skipped = "already imported";
          report.push(rowReport);
          continue;
        }

        // Link Stripe customer + save the card so off-session charges work.
        let lockedPmId: string | null = null;
        if (stripeCustomerId && paymentMethodId) {
          await db
            .prepare(
              `INSERT OR IGNORE INTO stripe_customers (company_id, customer_id, stripe_customer_id)
               VALUES (?, ?, ?)`
            )
            .run(companyId, cid, stripeCustomerId);
          try {
            await savePaymentMethodForCustomer({
              companyId,
              customerId: cid,
              stripeAccountId,
              stripePaymentMethodId: paymentMethodId,
              makeDefault: true,
            });
            lockedPmId = paymentMethodId;
          } catch (e) {
            rowReport.issues.push(
              `Card link failed: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        }

        // Auto-bill only when an active agreement has a usable card.
        const autoBill = status === "active" && lockedPmId ? 1 : 0;
        const acceptToken = randomBytes(24).toString("base64url");
        const acceptedAt = status === "active" ? new Date().toISOString() : null;

        const res = await db
          .prepare(
            `INSERT INTO customer_subscriptions
               (company_id, customer_id, name, description, price_cents, interval,
                service_interval, status, billing_status, auto_bill, accepted_at,
                created_by, start_date, sold_by_id, tax_rate_bps, accept_token,
                default_payment_method_id, next_charge_at, imported_from, import_batch)
             VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'import', ?, ?, ?, ?, ?, ?, 'homebase360', ?)`
          )
          .run(
            companyId,
            cid,
            planName,
            amountCents,
            interval,
            interval,
            status,
            billing,
            autoBill,
            acceptedAt,
            startDate,
            soldById,
            defaultTaxBps,
            acceptToken,
            lockedPmId,
            nextChargeAt,
            batchId
          );
        rowReport.customer_id = cid;
        rowReport.created_subscription_id = Number(res.lastInsertRowid);
      } catch (e) {
        rowReport.skipped = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    report.push(rowReport);
  }

  const summary = {
    total: report.length,
    auto: report.filter((r) => r.confidence === "auto").length,
    review: report.filter((r) => r.confidence === "review").length,
    none: report.filter((r) => r.confidence === "none").length,
    created: report.filter((r) => r.created_subscription_id).length,
    skipped: report.filter((r) => r.skipped).length,
  };

  return NextResponse.json({
    mode,
    batch_id: mode === "commit" ? batchId : null,
    stripe_ready: stripeReady,
    summary,
    rows: report,
  });
}
