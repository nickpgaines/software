import type { Company, SmsBrandRegistration } from "@/lib/db";
import { SmsRegistrationLeaseLostError, type SmsRegistrationLease } from "@/lib/sms-registration-lease";
import {
  attachNumberToMessagingService, findAvailableLocalNumber, findOwnedPhoneNumber,
  isNumberAttachedToMessagingService, purchasePhoneNumber, type TwilioCreds,
} from "@/lib/twilio-trust-hub";

type NumberProvisioning = { phone_number: string; phone_sid: string | null; status: string };

export async function provisionDedicatedNumber(input: {
  company: Company; registration: SmsBrandRegistration; creds: TwilioCreds;
  lease: SmsRegistrationLease; smsUrl: string | null; voiceUrl: string | null;
}): Promise<string | null> {
  const { company, registration, creds, lease } = input;
  let stage = "search";
  try {
    let reserved = await lease.transaction(tx => tx.prepare(
      "SELECT phone_number, phone_sid, status FROM sms_number_provisioning WHERE company_id = ?"
    ).get<NumberProvisioning>(company.id));
    let mayPurchase = false;
    if (!reserved) {
      const areaCode = (registration.business_phone.replace(/\D/g, "").match(/\d{10}$/)?.[0] ?? "").slice(0, 3) || "843";
      const number = await findAvailableLocalNumber({ creds, areaCode });
      if (!number) return `No phone numbers are currently available in area code ${areaCode}. Refresh status to retry phone number provisioning.`;
      // Commit the exact candidate before starting its billable purchase.
      // After interruption, only a positive ownership lookup may advance it.
      await lease.transaction(tx => tx.prepare(`INSERT INTO sms_number_provisioning
        (company_id, phone_number) VALUES (?, ?)`
      ).run(company.id, number));
      reserved = { phone_number: number, phone_sid: null, status: "purchasing" };
      mayPurchase = true;
    }
    stage = "purchase";
    if (!reserved.phone_sid) {
      let purchased;
      if (mayPurchase) {
        try {
          purchased = await purchasePhoneNumber({ creds, phoneNumber: reserved.phone_number,
            friendlyName: `nick360:${company.id}:${registration.legal_company_name}`,
            smsUrl: input.smsUrl, voiceUrl: input.voiceUrl });
        } catch (error) {
          // A definite client rejection did not allocate a number. A timeout,
          // 5xx, lost response, or lost lease must keep its durable reservation.
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) {
            await lease.transaction(tx => tx.prepare(
              "DELETE FROM sms_number_provisioning WHERE company_id = ? AND phone_sid IS NULL"
            ).run(company.id));
          }
          throw error;
        }
      } else {
        purchased = await findOwnedPhoneNumber({ creds, phoneNumber: reserved.phone_number });
        if (!purchased) return "Phone number purchase is unconfirmed. Refresh status to reconcile the reserved number, or contact support. No additional number will be purchased while this attempt is unresolved.";
      }
      if (!purchased.sid || purchased.phone_number !== reserved.phone_number) {
        throw new Error("Twilio did not confirm the reserved phone number and SID; refresh status to reconcile this purchase.");
      }
      await lease.transaction(tx => tx.prepare(`UPDATE sms_number_provisioning
        SET phone_sid = ?, status = 'purchased', updated_at = datetime('now')
        WHERE company_id = ? AND phone_number = ?`
      ).run(purchased.sid, company.id, reserved.phone_number));
      reserved.phone_sid = purchased.sid;
    }
    stage = "attachment";
    const attachment = { creds, messagingServiceSid: company.twilio_messaging_service_sid!, phoneNumberSid: reserved.phone_sid };
    try {
      await attachNumberToMessagingService(attachment);
    } catch (error) {
      if (error instanceof SmsRegistrationLeaseLostError) throw error;
      // The previous POST may have attached the sender before its response was
      // lost. Confirm the exact service/SID before treating a duplicate as done.
      const attached = await isNumberAttachedToMessagingService(attachment).catch(cause => {
        if (cause instanceof SmsRegistrationLeaseLostError) throw cause;
        return false;
      });
      if (!attached) throw error;
    }
    await lease.transaction(async tx => {
      await tx.prepare(`UPDATE sms_number_provisioning SET status = 'attached', updated_at = datetime('now') WHERE company_id = ?`).run(company.id);
      // Keep the public sender inactive until its purchased number is attached.
      await tx.prepare(`UPDATE company SET sms_dedicated_number = ?, sms_dedicated_number_sid = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(reserved!.phone_number, reserved!.phone_sid, company.id);
    });
    return null;
  } catch (error) {
    if (error instanceof SmsRegistrationLeaseLostError) throw error;
    return `Phone number ${stage} failed: ${(error as Error).message}. The campaign remains approved; refresh status to retry or reconcile phone number provisioning.`;
  }
}
