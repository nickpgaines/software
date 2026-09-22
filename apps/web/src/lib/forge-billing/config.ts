export function isForgeBillingEnabled(): boolean { return process.env.FORGE_BILLING_ENABLED === 'true'; }
export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
export function requireBillingEnabled() { if (!isForgeBillingEnabled()) throw new BillingError('Billing is not enabled', 404); }
export function requiredConfig(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function billingOrigin(): string {
  const value = requiredConfig('FORGE_BILLING_SITE_ORIGIN');
  const url = new URL(value);
  if (url.origin !== value || url.protocol !== 'https:') throw new Error('Forge billing requires an HTTPS site origin');
  return value;
}

// Operator-controlled rollout, NOT storefront detection. Keep off until the
// app's distribution and external-purchase policy have been verified.
export function nativeBillingWebsiteUrl(): string | null {
  if (!isForgeBillingEnabled() || process.env.FORGE_BILLING_NATIVE_WEBSITE_ENABLED !== 'true') return null;
  try {
    return `${billingOrigin()}/billing`;
  } catch {
    // A missing/invalid link destination must not break account recovery.
    return null;
  }
}
