import { terminalResponse, terminalSession, TerminalError } from '@/lib/terminal-http';
import { requireTapToPayEnabled } from '@/lib/terminal-rollout';
import { requireTerminalEnvironment } from '@/lib/terminal-environment';
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
    // Earlier native builds leave the SDK's terms permission at its unsafe YES
    // default and ignore our response flag. Never mint a token for that protocol.
    const purpose = req.headers.get('X-Forge-Terminal-Purpose');
    if (!purpose) throw new TerminalError('Update Forge to use Tap to Pay. Pay with card is still available.',409);
    const confirmation = req.headers.get('X-Forge-Authorized-Representative');
    if (!['collection','preparation','warmup'].includes(purpose) || (confirmation !== null && confirmation !== 'true' && confirmation !== 'false')
      || (purpose !== 'preparation' && confirmation === 'true')) throw new TerminalError('Invalid Terminal preparation request');
    const permitsTerms = purpose === 'preparation' && confirmation === 'true';
    if (permitsTerms && !await canManageTerminalSetup(await getDb(),auth)) throw new TerminalError('An authorized administrator must complete merchant setup.',403);
    const token = await getStripe().terminal.connectionTokens.create({}, { stripeAccount: company.stripe_account_id });
    const current = await getCompany(auth.companyId);
    requireTapToPayEnabled();
    if (current.stripe_account_id !== company.stripe_account_id || !current.stripe_charges_enabled) throw new TerminalError('Stripe account changed. Reload setup.',409);
    if (permitsTerms && !await canManageTerminalSetup(await getDb(),auth)) throw new TerminalError('Administrator permission changed. Reload setup.',403);
    return { secret: token.secret, stripe_account: company.stripe_account_id, tos_acceptance_permitted:permitsTerms, provider_mode:requireTerminalEnvironment(req.headers.get('X-Forge-Terminal-Mode')) };
  });
}
