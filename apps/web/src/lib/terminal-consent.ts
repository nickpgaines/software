export const TERMINAL_CONSENT_VERSION = 'terminal-save-v1' as const;

/** Shared verbatim by the consent UI and durable server audit record. */
export function terminalConsentText(merchantName: string): string {
  return `I authorize ${merchantName} to save my card for future payments I separately agree to. Saving my card is optional and does not start a subscription. Any recurring billing requires my separate agreement to the amount, schedule, and cancellation terms.`;
}
