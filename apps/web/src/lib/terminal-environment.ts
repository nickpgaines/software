import 'server-only';
import { getStripeCredentialMode } from '@/lib/stripe';
import { TerminalError } from '@/lib/terminal-http';

/** Does not change configuration or initialize a Stripe client. No secrets leave this boundary. */
export function requireTerminalEnvironment(expected?: string | null): 'test' | 'live' {
  const mode = process.env.TAP_TO_PAY_MODE ?? 'live';
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if ((mode !== 'live' && mode !== 'test') || getStripeCredentialMode() !== mode
    || !publishable?.startsWith(`pk_${mode}_`) || publishable.length <= `pk_${mode}_`.length) {
    throw new TerminalError('Tap to Pay configuration is unavailable. Use another payment method and contact support.',503);
  }
  if (expected !== undefined && expected !== null && expected !== mode) {
    throw new TerminalError('This app and payment server use different environments. Reopen the correct Forge build.',409);
  }
  return mode;
}
