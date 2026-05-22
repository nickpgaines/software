import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getOrCreateTerminalLocation,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Create a `card_present` PaymentIntent for a job, to be collected by a
 * Stripe Terminal reader (Tap to Pay on iPhone). The native app calls
 * this, then `Terminal.shared.collectPaymentMethod(...)` and
 * `processPayment(...)`, then POSTs the intent id to
 * /api/jobs/[id]/payments/stripe-confirm to record the payment.
 *
 * NOTE: capture is automatic. Switch to capture_method='manual' if a
 * future tip-on-glass UX needs an explicit capture step.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      { error: "Connected Stripe account isn't ready to accept charges" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const jobId = Number(params.id);
  const job = (await db
    .prepare(
      "SELECT j.id, j.customer_id, c.name, c.email FROM jobs j JOIN customers c ON c.id = j.customer_id WHERE j.id = ? AND j.company_id = ?"
    )
    .get(jobId, companyId)) as
    | { id: number; customer_id: number; name: string | null; email: string | null }
    | undefined;
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
    tip_cents: number;
  }>;
  const amount = Math.round(Number(body.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 }
    );
  }
  const tip = Math.round(Number(body.tip_cents ?? 0));
  if (!Number.isFinite(tip) || tip < 0) {
    return NextResponse.json(
      { error: "Tip must be zero or greater" },
      { status: 400 }
    );
  }
  const total = amount + tip;

  const location = await getOrCreateTerminalLocation(
    companyId,
    company.stripe_account_id
  );

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((total * feeBps) / 10_000)
      : 0;

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create(
    {
      amount: total,
      currency: "usd",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      description: `Job #${jobId} — ${job.name ?? "Customer"} (Tap to Pay)`,
      metadata: {
        job_id: String(jobId),
        customer_id: String(job.customer_id),
        amount_cents: String(amount),
        tip_cents: String(tip),
        application_fee_cents: String(applicationFee),
        source: "terminal",
        terminal_location_id: location.stripe_terminal_location_id,
      },
      receipt_email: job.email || undefined,
      ...(applicationFee > 0
        ? { application_fee_amount: applicationFee }
        : {}),
    },
    { stripeAccount: company.stripe_account_id }
  );

  return NextResponse.json({
    client_secret: intent.client_secret,
    payment_intent_id: intent.id,
    stripe_account: company.stripe_account_id,
    terminal_location_id: location.stripe_terminal_location_id,
  });
}
