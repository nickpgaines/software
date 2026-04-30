import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server" },
      { status: 503 }
    );
  }

  const db = await getDb();
  const jobId = Number(params.id);
  const job = (await db
    .prepare(
      "SELECT j.id, j.customer_id, c.first_name, c.last_name, c.name, c.email FROM jobs j JOIN customers c ON c.id = j.customer_id WHERE j.id = ?"
    )
    .get(jobId)) as
    | {
        id: number;
        customer_id: number;
        first_name: string | null;
        last_name: string | null;
        name: string | null;
        email: string | null;
      }
    | undefined;
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
    tip_cents: number;
  }>;

  const amount = Number(body.amount_cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 }
    );
  }
  const tip = Number(body.tip_cents ?? 0);
  if (!Number.isFinite(tip) || tip < 0) {
    return NextResponse.json(
      { error: "Tip must be zero or greater" },
      { status: 400 }
    );
  }

  const total = Math.round(amount) + Math.round(tip);

  const customerName =
    [job.first_name, job.last_name].filter(Boolean).join(" ").trim() ||
    job.name ||
    `Customer #${job.customer_id}`;

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: total,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: `Job #${jobId} — ${customerName}`,
    metadata: {
      job_id: String(jobId),
      customer_id: String(job.customer_id),
      amount_cents: String(Math.round(amount)),
      tip_cents: String(Math.round(tip)),
    },
    receipt_email: job.email || undefined,
  });

  return NextResponse.json({
    client_secret: intent.client_secret,
    payment_intent_id: intent.id,
  });
}
