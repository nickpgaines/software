export function isForgeBillingEnabled(): boolean { return process.env.FORGE_BILLING_ENABLED === 'true'; }
export const DEFAULT_BILLING_CUTOFF = '2026-09-26T05:00:00.000Z';
export function billingCutoff(): string {
  const value = process.env.FORGE_BILLING_CUTOFF_AT || DEFAULT_BILLING_CUTOFF;
  if (!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Invalid Forge billing cutoff');
  return new Date(value).toISOString();
}
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
