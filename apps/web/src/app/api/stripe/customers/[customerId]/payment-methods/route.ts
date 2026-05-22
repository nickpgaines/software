import { NextResponse } from "next/server";
import { getDb, type StripePaymentMethod } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  isStripeConfigured,
  getCompany,
  savePaymentMethodForCustomer,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** List saved cards for an internal customer (this tenant only). */
export async function GET(
  _req: Request,
  { params }: { params: { customerId: string } }
) {
  const companyId = await requireCompanyId();
  const customerId = Number(params.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return NextResponse.json(
      { error: "Invalid customer id" },
      { status: 400 }
    );
  }
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT * FROM stripe_payment_methods
       WHERE company_id = ? AND customer_id = ?
       ORDER BY is_default DESC, created_at DESC, id DESC`
    )
    .all(companyId, customerId)) as StripePaymentMethod[];
  return NextResponse.json({ payment_methods: rows });
}

/**
 * Persist a SetupIntent's confirmed PaymentMethod against this customer.
 * Body: { setup_intent_id?: string, payment_method_id?: string, make_default?: boolean }.
 * Either id is acceptable — we re-resolve the PaymentMethod from Stripe
 * before writing, so the frontend can't lie about which card to save.
 */
export async function POST(
  req: Request,
  { params }: { params: { customerId: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured" },
      { status: 503 }
    );
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      { error: "No connected Stripe account" },
      { status: 400 }
    );
  }

  const customerId = Number(params.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return NextResponse.json(
      { error: "Invalid customer id" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    setup_intent_id: string;
    payment_method_id: string;
    make_default: boolean;
  }>;

  let paymentMethodId = body.payment_method_id?.trim() || "";
  if (!paymentMethodId && body.setup_intent_id?.trim()) {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const si = await stripe.setupIntents.retrieve(
      body.setup_intent_id.trim(),
      undefined,
      { stripeAccount: company.stripe_account_id }
    );
    if (si.status !== "succeeded") {
      return NextResponse.json(
        { error: `SetupIntent not succeeded (status: ${si.status})` },
        { status: 400 }
      );
    }
    paymentMethodId =
      typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id || "";
  }
  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "Provide setup_intent_id or payment_method_id" },
      { status: 400 }
    );
  }

  try {
    const saved = await savePaymentMethodForCustomer({
      companyId,
      customerId,
      stripeAccountId: company.stripe_account_id,
      stripePaymentMethodId: paymentMethodId,
      makeDefault: Boolean(body.make_default),
    });
    return NextResponse.json({ payment_method: saved }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not save card: ${message}` },
      { status: 400 }
    );
  }
}
