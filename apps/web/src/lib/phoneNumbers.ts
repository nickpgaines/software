import { getDb, type PhoneNumber } from "@/lib/db";
import {
  basicAuthHeader,
  getPlatformTwilioCreds,
} from "@/lib/twilio";

export type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

export async function listCompanyNumbers(
  companyId: number
): Promise<PhoneNumber[]> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT * FROM phone_numbers
        WHERE company_id = ? AND status = 'active'
        ORDER BY is_primary DESC, purchased_at ASC, id ASC`
    )
    .all(companyId)) as PhoneNumber[];
  return rows;
}

export async function getPrimaryNumber(
  companyId: number
): Promise<PhoneNumber | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT * FROM phone_numbers
        WHERE company_id = ? AND status = 'active'
        ORDER BY is_primary DESC, purchased_at ASC, id ASC
        LIMIT 1`
    )
    .get(companyId)) as PhoneNumber | undefined;
  return row ?? null;
}

export async function findCompanyByPhone(
  phone: string
): Promise<PhoneNumber | null> {
  if (!phone) return null;
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT * FROM phone_numbers
        WHERE phone_number = ? AND status = 'active' LIMIT 1`
    )
    .get(phone)) as PhoneNumber | undefined;
  return row ?? null;
}

// Search Twilio's catalog for numbers we could buy. Country defaults to US.
// `areaCode`, `contains`, `region` are optional filters.
export async function searchAvailableNumbers(args: {
  country?: string;
  areaCode?: string;
  contains?: string;
  region?: string;
  limit?: number;
}): Promise<AvailableNumber[]> {
  const creds = getPlatformTwilioCreds();
  const country = (args.country || "US").toUpperCase();
  const params = new URLSearchParams();
  if (args.areaCode) params.set("AreaCode", args.areaCode);
  if (args.contains) params.set("Contains", args.contains);
  if (args.region) params.set("InRegion", args.region);
  params.set("SmsEnabled", "true");
  params.set("VoiceEnabled", "true");
  params.set("PageSize", String(Math.min(args.limit ?? 20, 50)));

  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      creds.accountSid
    )}/AvailablePhoneNumbers/${encodeURIComponent(country)}/Local.json?` +
    params.toString();

  const res = await fetch(url, {
    headers: { Authorization: basicAuthHeader(creds.accountSid, creds.authToken) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    available_phone_numbers?: Array<{
      phone_number: string;
      friendly_name: string;
      locality: string | null;
      region: string | null;
      postal_code: string | null;
      capabilities: { voice?: boolean; SMS?: boolean; sms?: boolean; MMS?: boolean; mms?: boolean };
    }>;
  };
  return (data.available_phone_numbers || []).map((n) => ({
    phone_number: n.phone_number,
    friendly_name: n.friendly_name,
    locality: n.locality,
    region: n.region,
    postal_code: n.postal_code,
    capabilities: {
      voice: !!n.capabilities.voice,
      sms: !!(n.capabilities.SMS ?? n.capabilities.sms),
      mms: !!(n.capabilities.MMS ?? n.capabilities.mms),
    },
  }));
}

export type PurchasedNumber = {
  twilio_sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: { voice: boolean; sms: boolean };
};

// Purchase a number from Twilio and configure its inbound webhooks to point
// at this app. The purchased number lives in the platform's master account.
export async function purchaseNumber(args: {
  phoneNumber: string;
  baseUrl: string;
  friendlyName?: string;
}): Promise<PurchasedNumber> {
  const creds = getPlatformTwilioCreds();
  const base = args.baseUrl.replace(/\/+$/, "");
  const form = new URLSearchParams();
  form.set("PhoneNumber", args.phoneNumber);
  if (args.friendlyName) form.set("FriendlyName", args.friendlyName);
  form.set("SmsUrl", `${base}/api/messages/webhook`);
  form.set("SmsMethod", "POST");
  form.set("VoiceUrl", `${base}/api/voice/inbound`);
  form.set("VoiceMethod", "POST");
  form.set("StatusCallback", `${base}/api/voice/status`);
  form.set("StatusCallbackMethod", "POST");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    creds.accountSid
  )}/IncomingPhoneNumbers.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(creds.accountSid, creds.authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    sid?: string;
    phone_number?: string;
    friendly_name?: string;
    capabilities?: { voice?: boolean; sms?: boolean; SMS?: boolean };
    message?: string;
  };
  if (!res.ok || !data.sid) {
    throw new Error(data.message || `Twilio purchase failed (${res.status})`);
  }
  return {
    twilio_sid: data.sid,
    phone_number: data.phone_number || args.phoneNumber,
    friendly_name: data.friendly_name || "",
    capabilities: {
      voice: !!data.capabilities?.voice,
      sms: !!(data.capabilities?.SMS ?? data.capabilities?.sms),
    },
  };
}

export async function releaseNumber(twilioSid: string): Promise<void> {
  const creds = getPlatformTwilioCreds();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    creds.accountSid
  )}/IncomingPhoneNumbers/${encodeURIComponent(twilioSid)}.json`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: basicAuthHeader(creds.accountSid, creds.authToken) },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio release failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function recordPurchasedNumber(args: {
  companyId: number;
  purchase: PurchasedNumber;
}): Promise<PhoneNumber> {
  const db = await getDb();
  const { companyId, purchase } = args;
  const existing = (await db
    .prepare(
      `SELECT id FROM phone_numbers WHERE company_id = ? AND status = 'active' LIMIT 1`
    )
    .get(companyId)) as { id: number } | undefined;
  const isPrimary = existing ? 0 : 1;

  const insert = await db
    .prepare(
      `INSERT INTO phone_numbers
         (company_id, phone_number, twilio_sid, friendly_name,
          capabilities_voice, capabilities_sms, is_primary, status, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`
    )
    .run(
      companyId,
      purchase.phone_number,
      purchase.twilio_sid,
      purchase.friendly_name || null,
      purchase.capabilities.voice ? 1 : 0,
      purchase.capabilities.sms ? 1 : 0,
      isPrimary
    );
  const row = (await db
    .prepare("SELECT * FROM phone_numbers WHERE id = ?")
    .get(insert.lastInsertRowid)) as PhoneNumber;
  return row;
}

export async function setPrimaryNumber(args: {
  companyId: number;
  phoneNumberId: number;
}): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .prepare(
        `UPDATE phone_numbers SET is_primary = 0
          WHERE company_id = ? AND status = 'active'`
      )
      .run(args.companyId);
    await tx
      .prepare(
        `UPDATE phone_numbers SET is_primary = 1
          WHERE id = ? AND company_id = ?`
      )
      .run(args.phoneNumberId, args.companyId);
  });
}

export async function markReleased(args: {
  companyId: number;
  phoneNumberId: number;
}): Promise<PhoneNumber | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT * FROM phone_numbers WHERE id = ? AND company_id = ? AND status = 'active'`
    )
    .get(args.phoneNumberId, args.companyId)) as PhoneNumber | undefined;
  if (!row) return null;
  await db
    .prepare(
      `UPDATE phone_numbers
          SET status = 'released',
              is_primary = 0,
              released_at = datetime('now')
        WHERE id = ?`
    )
    .run(row.id);
  if (row.is_primary === 1) {
    // Promote the next active number for this company to primary.
    const next = (await db
      .prepare(
        `SELECT id FROM phone_numbers
          WHERE company_id = ? AND status = 'active'
          ORDER BY purchased_at ASC, id ASC LIMIT 1`
      )
      .get(args.companyId)) as { id: number } | undefined;
    if (next) {
      await db
        .prepare(`UPDATE phone_numbers SET is_primary = 1 WHERE id = ?`)
        .run(next.id);
    }
  }
  return row;
}
