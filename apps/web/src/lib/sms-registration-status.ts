import type { Company } from "@/lib/db";

export type SmsRoutingStatus = Pick<Company,
  "a2p_registration_state" | "sms_tier" | "sms_dedicated_number" |
  "sms_dedicated_number_sid" | "twilio_messaging_service_sid" | "twilio_campaign_sid"
>;

// Approval alone isn't activation: provisioning must finish and switch the
// routing tier used by both outgoing messages and incoming replies.
export function isSmsTwoWayReady(company: SmsRoutingStatus | null | undefined): boolean {
  return !!company && company.a2p_registration_state === "campaign_approved" &&
    company.sms_tier === "paid_approved" && !!company.sms_dedicated_number &&
    !!company.sms_dedicated_number_sid && !!company.twilio_messaging_service_sid &&
    !!company.twilio_campaign_sid;
}
