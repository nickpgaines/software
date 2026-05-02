import { NextResponse } from "next/server";
import {
  getDb,
  type CustomerSubscription,
  type SubscriptionInterval,
  type SubscriptionTemplate,
  type SubscriptionTerms,
} from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_INTERVALS: SubscriptionInterval[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "triannually",
  "semiannually",
  "yearly",
];

function intervalLabel(i: SubscriptionInterval): string {
  switch (i) {
    case "weekly":
      return "week";
    case "biweekly":
      return "2 weeks";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    case "triannually":
      return "4 months";
    case "semiannually":
      return "6 months";
    case "yearly":
      return "year";
  }
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function GET(req: Request) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");

  let rows: CustomerSubscription[];
  if (customerId) {
    rows = (await db
      .prepare(
        `SELECT * FROM customer_subscriptions
         WHERE customer_id = ?
         ORDER BY created_at DESC, id DESC`
      )
      .all(Number(customerId))) as CustomerSubscription[];
  } else {
    rows = (await db
      .prepare(
        `SELECT * FROM customer_subscriptions
         ORDER BY created_at DESC, id DESC`
      )
      .all()) as CustomerSubscription[];
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
    template_id: number;
    action: "send" | "accept";
    name: string;
    description: string | null;
    price_cents: number;
    interval: SubscriptionInterval;
    signature_data: string;
    signature_name: string;
    start_date: string;
    sold_by_id: number | null;
  }>;

  const customerId = Number(body.customer_id);
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }
  const action = body.action === "accept" ? "accept" : "send";

  let name = (body.name || "").trim();
  let description = body.description?.toString().trim() || null;
  const priceProvided = body.price_cents !== undefined;
  let price_cents = priceProvided
    ? Math.max(0, Number(body.price_cents) || 0)
    : 0;
  if (priceProvided && price_cents <= 0) {
    return NextResponse.json(
      { error: "price must be greater than zero" },
      { status: 400 }
    );
  }
  if (!body.interval || !VALID_INTERVALS.includes(body.interval)) {
    return NextResponse.json(
      { error: "interval is required" },
      { status: 400 }
    );
  }
  const interval: SubscriptionInterval = body.interval;
  let templateId: number | null = null;
  let termsSnapshot: string | null = null;
  let requireSignature = 0;

  if (body.template_id) {
    const tpl = (await db
      .prepare("SELECT * FROM subscription_templates WHERE id = ?")
      .get(Number(body.template_id))) as SubscriptionTemplate | undefined;
    if (!tpl) {
      return NextResponse.json(
        { error: "template not found" },
        { status: 404 }
      );
    }
    templateId = tpl.id;
    if (!name) name = tpl.name;
    if (!description) description = tpl.description;
    requireSignature = tpl.require_signature ? 1 : 0;
    if (tpl.terms_id) {
      const terms = (await db
        .prepare("SELECT * FROM subscription_terms WHERE id = ?")
        .get(tpl.terms_id)) as SubscriptionTerms | undefined;
      if (terms) {
        termsSnapshot = `${terms.name}\n\n${terms.body}`;
      }
    }
  }

  if (!priceProvided || price_cents <= 0) {
    return NextResponse.json(
      { error: "price is required" },
      { status: 400 }
    );
  }

  const signatureData =
    typeof body.signature_data === "string" && body.signature_data.trim()
      ? body.signature_data.trim()
      : null;
  const signatureName =
    typeof body.signature_name === "string" && body.signature_name.trim()
      ? body.signature_name.trim()
      : null;

  if (action === "accept" && requireSignature && !signatureData) {
    return NextResponse.json(
      { error: "signature is required for this subscription" },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: "name or template_id is required" },
      { status: 400 }
    );
  }

  const customer = await db
    .prepare("SELECT id FROM customers WHERE id = ?")
    .get<{ id: number }>(customerId);
  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const status = action === "accept" ? "active" : "pending";
  const sentAt = action === "send" ? now : null;
  const acceptedAt = action === "accept" ? now : null;
  const signedAt = signatureData ? now : null;
  const startDate =
    typeof body.start_date === "string" && body.start_date.trim()
      ? body.start_date.trim()
      : null;
  const soldById =
    body.sold_by_id === undefined || body.sold_by_id === null
      ? null
      : Number(body.sold_by_id) || null;

  const result = await db
    .prepare(
      `INSERT INTO customer_subscriptions
         (customer_id, template_id, name, description, price_cents, interval,
          status, sent_at, accepted_at, created_by,
          terms_snapshot, require_signature,
          signature_data, signature_name, signed_at,
          start_date, sold_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      customerId,
      templateId,
      name,
      description,
      price_cents,
      interval,
      status,
      sentAt,
      acceptedAt,
      user,
      termsSnapshot,
      requireSignature,
      signatureData,
      signatureName,
      signedAt,
      startDate,
      soldById
    );

  if (action === "send") {
    const offerLine = `${name} — ${formatPrice(price_cents)} / ${intervalLabel(interval)}`;
    const desc = description ? `\n${description}` : "";
    const messageBody =
      `Hi! Here's a subscription offer from us:\n${offerLine}${desc}\n` +
      `Reply YES to accept and we'll get you set up.`;
    await db
      .prepare(
        `INSERT INTO messages (customer_id, body, direction)
         VALUES (?, ?, 'outbound')`
      )
      .run(customerId, messageBody);
  }

  const row = (await db
    .prepare("SELECT * FROM customer_subscriptions WHERE id = ?")
    .get(result.lastInsertRowid)) as CustomerSubscription;
  return NextResponse.json(row, { status: 201 });
}
