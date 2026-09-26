import { terminalResponse, terminalSession, TerminalError } from '@/lib/terminal-http';
import { requireTapToPayEnabled } from '@/lib/terminal-rollout';
import { getDb } from '@/lib/db';
import { canManageTerminalSetup } from '@/lib/terminal-location';
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived Stripe Terminal ConnectionToken for a Tap to Pay
 * on iPhone (or any Terminal) reader to authenticate against the
 * merchant's connected Stripe account.
 *
 * The native iOS app fetches this on demand and hands it to
 * `STPTerminal.shared.discoverReaders(...)` etc.
 */
export async function POST(req: Request) {
  return terminalResponse(async () => {
    const auth = await terminalSession(req);
    requireTapToPayEnabled();
    const company = await getCompany(auth.companyId);
    if (!isStripeConfigured()) throw new TerminalError('Stripe is not configured',503);
    if (!company.stripe_account_id || !company.stripe_charges_enabled) throw new TerminalError('Complete Stripe onboarding before using Tap to Pay',409);
    if (req.headers.get('X-Forge-Stripe-Account') !== company.stripe_account_id) throw new TerminalError('Stripe account does not match this Terminal session',409);
    const purpose = req.headers.get('X-Forge-Terminal-Purpose') ?? 'collection';
    const confirmation = req.headers.get('X-Forge-Authorized-Representative');
    if (!['collection','preparation'].includes(purpose) || (confirmation !== null && confirmation !== 'true' && confirmation !== 'false')
      || (purpose !== 'preparation' && confirmation === 'true')) throw new TerminalError('Invalid Terminal preparation request');
    const permitsTerms = purpose === 'preparation' && confirmation === 'true';
    if (permitsTerms && !await canManageTerminalSetup(await getDb(),auth)) throw new TerminalError('An authorized administrator must complete merchant setup.',403);
    const token = await getStripe().terminal.connectionTokens.create({}, { stripeAccount: company.stripe_account_id });
    const current = await getCompany(auth.companyId);
    if (current.stripe_account_id !== company.stripe_account_id || !current.stripe_charges_enabled) throw new TerminalError('Stripe account changed. Reload setup.',409);
    if (permitsTerms && !await canManageTerminalSetup(await getDb(),auth)) throw new TerminalError('Administrator permission changed. Reload setup.',403);
    return { secret: token.secret, stripe_account: company.stripe_account_id, tos_acceptance_permitted:permitsTerms };
  });
}
