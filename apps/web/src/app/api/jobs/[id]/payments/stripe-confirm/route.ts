import { NextResponse } from "next/server";
import { getDb, type Payment } from "@/lib/db";
import { autoCompleteSteps } from "@/lib/jobs";
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

  const job = await db.prepare("SELECT id FROM jobs WHERE id = ?").get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    payment_intent_id: string;
    notes: string | null;
    send_email: boolean | number;
    send_sms: boolean | number;
  }>;

  const intentId = String(body.payment_intent_id || "");
  if (!intentId) {
    return NextResponse.json(
      { error: "payment_intent_id is required" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(intentId);

  if (intent.status !== "succeeded") {
    return NextResponse.json(
      { error: `Payment not completed (status: ${intent.status})` },
      { status: 400 }
    );
  }

  if (intent.metadata?.job_id && Number(intent.metadata.job_id) !== jobId) {
    return NextResponse.json(
      { error: "Payment intent is for a different job" },
      { status: 400 }
    );
  }

  // Idempotency: if we already recorded this intent, return the existing row.
  const existing = (await db
    .prepare(
      "SELECT * FROM payments WHERE stripe_payment_intent_id = ? LIMIT 1"
    )
    .get(intentId)) as Payment | undefined;
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const amountCents = Number(intent.metadata?.amount_cents);
  const tipCents = Number(intent.metadata?.tip_cents ?? 0);
  // Trust the intent's actual charged amount as the source of truth for the
  // grand total; split it into amount/tip using the metadata. If metadata is
  // missing for some reason, attribute everything to amount.
  const total = intent.amount_received || intent.amount;
  const finalAmount =
    Number.isFinite(amountCents) && amountCents > 0
      ? amountCents
      : total - (Number.isFinite(tipCents) ? tipCents : 0);
  const finalTip =
    Number.isFinite(tipCents) && tipCents >= 0 ? tipCents : 0;

  const send_email = body.send_email ? 1 : 0;
  const send_sms = body.send_sms ? 1 : 0;
  const payment_date = new Date().toISOString().slice(0, 10);
  const notes = body.notes ? String(body.notes) : null;

  const insertedId = await db.transaction(async (tx) => {
    const result = await tx
      .prepare(
        `INSERT INTO payments
           (job_id, amount_cents, tip_cents, method, payment_date, notes,
            send_email, send_sms, stripe_payment_intent_id)
         VALUES (?, ?, ?, 'card', ?, ?, ?, ?, ?)`
      )
      .run(
        jobId,
        finalAmount,
        finalTip,
        payment_date,
        notes,
        send_email,
        send_sms,
        intentId
      );
    await autoCompleteSteps(tx, jobId);
    return Number(result.lastInsertRowid);
  });

  const created = (await db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(insertedId)) as Payment;

  if (send_email) {
    console.log(
      "TODO: Send email receipt for payment",
      created.id,
      "on job",
      jobId
    );
  }
  if (send_sms) {
    console.log(
      "TODO: Send SMS receipt for payment",
      created.id,
      "on job",
      jobId
    );
  }

  return NextResponse.json(created, { status: 201 });
}
