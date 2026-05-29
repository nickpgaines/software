// Single source of truth for the two SMS opt-in disclosures presented at
// estimate acceptance. A2P 10DLC carrier review requires consent for
// transactional/service messages and consent for marketing/promotional
// messages to be collected separately, neither pre-selected, and neither a
// condition of purchase. The same text is shown at the estimate consent
// checkboxes, recorded verbatim on the estimate when the customer opts in,
// published on /sms-consent and /sms-opt-in, and described in the A2P
// campaign CTA. A carrier reviewer cross-checks these, so they must match —
// keep every surface reading from here.

function biz(name: string): string {
  return name.trim() || "this business";
}

export function buildTransactionalSmsConsentText(businessName: string): string {
  const name = biz(businessName);
  return (
    `I agree to receive transactional and informational text messages from ` +
    `${name} at the phone number I provided — appointment confirmations, ` +
    `reminders, on-the-way and arrival notifications, receipts, follow-ups, ` +
    `and two-way replies about my job. Message frequency varies. Message and ` +
    `data rates may apply. Reply STOP to opt out at any time or HELP for ` +
    `help. Consent is not a condition of purchase.`
  );
}

export function buildPromotionalSmsConsentText(businessName: string): string {
  const name = biz(businessName);
  return (
    `I agree to receive marketing and promotional text messages from ${name} ` +
    `at the phone number I provided — occasional offers, seasonal service ` +
    `reminders, and re-engagement messages. Message frequency varies. ` +
    `Message and data rates may apply. Reply STOP to opt out at any time or ` +
    `HELP for help. Consent is not a condition of purchase.`
  );
}
