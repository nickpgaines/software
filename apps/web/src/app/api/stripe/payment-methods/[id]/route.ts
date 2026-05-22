import { NextResponse } from "next/server";
import { getDb, type StripePaymentMethod } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { getStripe, isStripeConfigured, getCompany } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function loadPm(
  id: number,
  companyId: number
): Promise<StripePaymentMethod | undefined> {
  const db = await getDb();
  return (await db
    .prepare(
      "SELECT * FROM stripe_payment_methods WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(id, companyId)) as StripePaymentMethod | undefined;
}

/** Set this saved card as the default for its customer. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const pm = await loadPm(id, companyId);
  if (!pm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    is_default: boolean;
  }>;
  if (body.is_default !== true) {
    return NextResponse.json(
      { error: "Only is_default=true is supported" },
      { status: 400 }
    );
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .prepare(
        "UPDATE stripe_payment_methods SET is_default = 0 WHERE company_id = ? AND customer_id = ?"
      )
      .run(companyId, pm.customer_id);
    await tx
      .prepare(
        "UPDATE stripe_payment_methods SET is_default = 1 WHERE id = ? AND company_id = ?"
      )
      .run(id, companyId);
  });

  if (isStripeConfigured()) {
    try {
      const company = await getCompany(companyId);
      if (company.stripe_account_id) {
        const stripe = getStripe();
        await stripe.customers.update(
          pm.stripe_customer_id,
          {
            invoice_settings: {
              default_payment_method: pm.stripe_payment_method_id,
            },
          },
          { stripeAccount: company.stripe_account_id }
        );
      }
    } catch (e) {
      console.warn("Could not mirror default PM to Stripe:", e);
    }
  }

  return NextResponse.json({ ok: true });
}

/** Detach a saved card from the Stripe Customer and drop our row. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }
  const companyId = await requireCompanyId();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const pm = await loadPm(id, companyId);
  if (!pm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      { error: "No connected Stripe account" },
      { status: 400 }
    );
  }
  const stripe = getStripe();
  try {
    await stripe.paymentMethods.detach(
      pm.stripe_payment_method_id,
      undefined,
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    // If Stripe already detached or the PM was deleted, fall through to
    // delete our row. Real errors get surfaced below.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/No such PaymentMethod|already been detached/i.test(msg)) {
      return NextResponse.json(
        { error: `Could not detach card: ${msg}` },
        { status: 502 }
      );
    }
  }
  const db = await getDb();
  await db
    .prepare(
      "DELETE FROM stripe_payment_methods WHERE id = ? AND company_id = ?"
    )
    .run(id, companyId);

  // If we dropped the only default, promote the most recent remaining
  // card so the customer still has a default for off-session charges.
  if (pm.is_default) {
    const next = (await db
      .prepare(
        `SELECT id, stripe_payment_method_id FROM stripe_payment_methods
         WHERE company_id = ? AND customer_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`
      )
      .get(companyId, pm.customer_id)) as
      | { id: number; stripe_payment_method_id: string }
      | undefined;
    if (next) {
      await db
        .prepare(
          "UPDATE stripe_payment_methods SET is_default = 1 WHERE id = ?"
        )
        .run(next.id);
      try {
        await stripe.customers.update(
          pm.stripe_customer_id,
          {
            invoice_settings: {
              default_payment_method: next.stripe_payment_method_id,
            },
          },
          { stripeAccount: company.stripe_account_id }
        );
      } catch {
        // best-effort
      }
    }
  }

  return NextResponse.json({ ok: true });
}
