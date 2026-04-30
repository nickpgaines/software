import "server-only";
import Stripe from "stripe";
import { getDb, type Company } from "./db";

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

export async function getCompany(): Promise<Company> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = 1")
    .get()) as Company | undefined;
  if (!row) {
    throw new Error("Company row not found");
  }
  return row;
}

export async function getConnectedAccountId(): Promise<string | null> {
  const c = await getCompany();
  return c.stripe_account_id || null;
}

/**
 * Sync the on-disk view of the connected account (charges/payouts/details
 * flags). Call this whenever we get fresh data from Stripe (after onboarding
 * return, after a webhook).
 */
export async function syncAccountStatus(
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
       WHERE id = 1`
    )
    .run(
      accountId,
      account.charges_enabled ? 1 : 0,
      account.payouts_enabled ? 1 : 0,
      account.details_submitted ? 1 : 0
    );
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
