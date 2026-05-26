// Single source of truth for the SMS opt-in disclosure. The same text is shown
// at the estimate consent checkbox, recorded verbatim on the estimate when the
// customer opts in, published on /sms-consent, and described in the A2P
// campaign CTA. A carrier reviewer cross-checks these, so they must match —
// keep every surface reading from here.
export function buildSmsConsentText(businessName: string): string {
  const name = businessName.trim() || "this business";
  return (
    `I agree to receive calls and texts from ${name} at the phone number I ` +
    `provided. ${name} sends appointment confirmations, reminders, on-the-way ` +
    `and arrival notifications, receipts, follow-ups, two-way replies, and ` +
    `occasional promotional or re-engagement messages. Message frequency ` +
    `varies. Message and data rates may apply. Reply STOP to opt out at any ` +
    `time or HELP for help. Consent is not a condition of purchase.`
  );
}
