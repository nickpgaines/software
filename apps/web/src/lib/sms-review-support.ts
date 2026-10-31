// Public, allowlisted support information. Never include the registration form
// or raw provider response (both can contain private business information).
export type SmsReviewSupport = {
  state: string;
  stage: string;
  providerStatus: string;
  lastUpdatedAt: string;
  checkedAt: string;
  companyName: string;
  accountSid: string;
  resourceSid: string;
  messagingServiceSid: string | null;
};

export const TWILIO_SUPPORT_URL = "https://help.twilio.com/articles/360048500694";

export function smsReviewSupportSummary(details: SmsReviewSupport): string {
  return [
    "A2P 10DLC registration review status request",
    `Business: ${details.companyName}`,
    "Platform: Forge CRM (Twilio subaccount)",
    `Twilio account SID: ${details.accountSid}`,
    `Review stage: ${details.stage}`,
    `Registration resource SID: ${details.resourceSid}`,
    ...(details.messagingServiceSid ? [`Messaging Service SID: ${details.messagingServiceSid}`] : []),
    `Twilio status: ${details.providerStatus}`,
    `Last updated by Twilio: ${details.lastUpdatedAt}`,
    `Status checked: ${details.checkedAt}`,
    "Please check the status of this registration and advise whether any further information is required.",
  ].join("\n");
}
