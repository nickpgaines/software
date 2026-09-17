import 'server-only';
import { TerminalError } from '@/lib/terminal-http';

// Server runtime flag, independent of the native provisioning/build flag.
// Missing, misspelled and false values must never enable live collection.
export function isTapToPayEnabled(): boolean {
  return process.env.TAP_TO_PAY_ENABLED === 'true';
}

export function requireTapToPayEnabled() {
  if (!isTapToPayEnabled()) {
    throw new TerminalError('Tap to Pay is coming soon. Use another payment method for now.', 409);
  }
}
