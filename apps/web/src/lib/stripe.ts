import "server-only";
import Stripe from "stripe";
import {
  getDb,
  type Company,
  type Customer,
  type StripeCustomer,
  type StripePaymentMethod,
  type StripeTerminalLocation,
} from "./db";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to apps/web/.env to enable card payments."
    );
  }
  _stripe = new Stripe(key);
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
}

export async function getCompany(companyId: number): Promise<Company> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as Company | undefined;
  if (!row) {
    throw new Error("Company row not found");
  }
  return row;
}

export async function getConnectedAccountId(
  companyId: number
): Promise<string | null> {
  const c = await getCompany(companyId);
  return c.stripe_account_id || null;
}

// Look up the company that owns a given Stripe connected account. Used by the
// webhook handler, which knows the account id but not the session.
export async function getCompanyByStripeAccount(
  accountId: string
): Promise<Company | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT * FROM company WHERE stripe_account_id = ? LIMIT 1"
    )
    .get(accountId)) as Company | undefined;
  return row ?? null;
}

/**
 * Sync the on-disk view of the connected account (charges/payouts/details
 * flags). Call this whenever we get fresh data from Stripe (after onboarding
 * return, after a webhook).
 */
export async function syncAccountStatus(
  companyId: number,
  accountId: string,
  account: Stripe.Account
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE company
         SET stripe_account_id = ?,
             stripe_charges_enabled = ?,
             stripe_payouts_enabled = ?,
             stripe_details_submitted = ?,
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      accountId,
      account.charges_enabled ? 1 : 0,
      account.payouts_enabled ? 1 : 0,
      account.details_submitted ? 1 : 0,
      companyId
    );
}

/**
 * Resolve (or lazily provision) the Stripe Customer that represents an
 * internal customer on a connected account. Direct charges require the
 * Customer + PaymentMethod to live on the merchant's connected Stripe
 * account, not the platform — so we always pass `stripeAccount`.
 */
export async function getOrCreateStripeCustomer(
  companyId: number,
  customerId: number,
  stripeAccountId: string
): Promise<string> {
  const db = await getDb();
  const existing = (await db
    .prepare(
      "SELECT stripe_customer_id FROM stripe_customers WHERE company_id = ? AND customer_id = ? LIMIT 1"
    )
    .get(companyId, customerId)) as
    | { stripe_customer_id: string }
    | undefined;
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const cust = (await db
    .prepare(
      "SELECT id, name, email, phone, formatted_address, address FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(customerId, companyId)) as Pick<
    Customer,
    "id" | "name" | "email" | "phone" | "formatted_address" | "address"
  > | undefined;
  if (!cust) {
    throw new Error("Customer not found");
  }

  const stripe = getStripe();
  const created = await stripe.customers.create(
    {
      name: cust.name || undefined,
      email: cust.email || undefined,
      phone: cust.phone || undefined,
      // Free-form, doesn't need structured address.
      description: cust.formatted_address || cust.address || undefined,
      metadata: {
        company_id: String(companyId),
        customer_id: String(customerId),
      },
    },
    { stripeAccount: stripeAccountId }
  );

  await db
    .prepare(
      `INSERT INTO stripe_customers (company_id, customer_id, stripe_customer_id)
       VALUES (?, ?, ?)`
    )
    .run(companyId, customerId, created.id);

  return created.id;
}

/**
 * Persist a confirmed Stripe PaymentMethod against our internal
 * customer. Pulls the canonical PM record from Stripe (so the caller
 * doesn't have to trust whatever the client sent) and writes a row to
 * `stripe_payment_methods`. If `makeDefault` is true (or this is the
 * customer's first PM), the row is set as the default and any prior
 * default is unset.
 */
export async function savePaymentMethodForCustomer(args: {
  companyId: number;
  customerId: number;
  stripeAccountId: string;
  stripePaymentMethodId: string;
  makeDefault?: boolean;
}): Promise<StripePaymentMethod> {
  const { companyId, customerId, stripeAccountId, stripePaymentMethodId } =
    args;
  const db = await getDb();
  const stripe = getStripe();
  const pm = await stripe.paymentMethods.retrieve(
    stripePaymentMethodId,
    undefined,
    { stripeAccount: stripeAccountId }
  );
  if (!pm.customer || typeof pm.customer !== "string") {
    throw new Error(
      "Payment method is not attached to a Stripe Customer — confirm the SetupIntent first."
    );
  }
  const pmCustomerId: string = pm.customer;
  // Defense-in-depth: make sure the PM is attached to the same Stripe
  // Customer we tracked for this internal customer. Stops cross-tenant
  // PM hijack if a token leaked.
  const mapping = (await db
    .prepare(
      "SELECT stripe_customer_id FROM stripe_customers WHERE company_id = ? AND customer_id = ? LIMIT 1"
    )
    .get(companyId, customerId)) as
    | { stripe_customer_id: string }
    | undefined;
  if (!mapping || mapping.stripe_customer_id !== pmCustomerId) {
    throw new Error("Payment method does not belong to this customer");
  }

  const card = pm.card ?? null;
  const wallet = card?.wallet?.type ?? null;

  const existingCount = (await db
    .prepare(
      "SELECT COUNT(*) AS n FROM stripe_payment_methods WHERE company_id = ? AND customer_id = ?"
    )
    .get(companyId, customerId)) as { n: number };
  const shouldDefault = args.makeDefault || existingCount.n === 0;

  await db.transaction(async (tx) => {
    if (shouldDefault) {
      await tx
        .prepare(
          "UPDATE stripe_payment_methods SET is_default = 0 WHERE company_id = ? AND customer_id = ?"
        )
        .run(companyId, customerId);
    }
    await tx
      .prepare(
        `INSERT INTO stripe_payment_methods
            (company_id, customer_id, stripe_customer_id,
             stripe_payment_method_id, brand, last4,
             exp_month, exp_year, wallet_type, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(company_id, stripe_payment_method_id) DO UPDATE SET
            brand = excluded.brand,
            last4 = excluded.last4,
            exp_month = excluded.exp_month,
            exp_year = excluded.exp_year,
            wallet_type = excluded.wallet_type,
            is_default = CASE WHEN ? = 1 THEN 1 ELSE stripe_payment_methods.is_default END`
      )
      .run(
        companyId,
        customerId,
        pmCustomerId,
        pm.id,
        card?.brand ?? null,
        card?.last4 ?? null,
        card?.exp_month ?? null,
        card?.exp_year ?? null,
        wallet,
        shouldDefault ? 1 : 0,
        shouldDefault ? 1 : 0
      );
  });

  if (shouldDefault) {
    // Mirror the default on the Stripe Customer so off-session charges
    // pick this PM automatically when we don't pass payment_method.
    try {
      await stripe.customers.update(
        pmCustomerId,
        { invoice_settings: { default_payment_method: pm.id } },
        { stripeAccount: stripeAccountId }
      );
    } catch (e) {
      // Non-fatal: we still have our own default flag and pass the PM
      // explicitly on every charge. Log and move on.
      console.warn("Could not set Stripe customer default PM:", e);
    }
  }

  const row = (await db
    .prepare(
      "SELECT * FROM stripe_payment_methods WHERE company_id = ? AND stripe_payment_method_id = ? LIMIT 1"
    )
    .get(companyId, stripePaymentMethodId)) as StripePaymentMethod;
  return row;
}

/**
 * Resolve (or lazily create) the Stripe Terminal Location for a
 * connected account. Required by Tap to Pay on iPhone and any other
 * Terminal reader — every PaymentIntent + ConnectionToken must reference
 * a Location belonging to the merchant's connected account.
 */
export async function getOrCreateTerminalLocation(
  companyId: number,
  stripeAccountId: string
): Promise<StripeTerminalLocation> {
  const db = await getDb();
  const existing = (await db
    .prepare(
      "SELECT * FROM stripe_terminal_locations WHERE company_id = ? LIMIT 1"
    )
    .get(companyId)) as StripeTerminalLocation | undefined;
  if (existing) return existing;

  const company = await getCompany(companyId);
  const stripe = getStripe();
  const location = await stripe.terminal.locations.create(
    {
      display_name: company.name?.trim() || `Company ${companyId}`,
      // Stripe requires a full address. Use the company address when
      // we have it, otherwise a placeholder the merchant can edit in
      // the Stripe dashboard.
      address: {
        line1: company.address?.trim() || "Unspecified",
        city: "Unspecified",
        state: "NA",
        country: "US",
        postal_code: "00000",
      },
    },
    { stripeAccount: stripeAccountId }
  );

  await db
    .prepare(
      `INSERT INTO stripe_terminal_locations
         (company_id, stripe_terminal_location_id, display_name)
       VALUES (?, ?, ?)`
    )
    .run(companyId, location.id, location.display_name ?? null);

  return (await db
    .prepare(
      "SELECT * FROM stripe_terminal_locations WHERE company_id = ? LIMIT 1"
    )
    .get(companyId)) as StripeTerminalLocation;
}

export function getAppOrigin(req: Request): string {
  const env = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  // Honor x-forwarded-* if a proxy injected them (Vercel does).
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}
