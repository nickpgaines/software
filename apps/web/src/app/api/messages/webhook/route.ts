import { NextResponse } from "next/server";
import { getDb, type Customer, type MessagingSettings } from "@/lib/db";
import {
  isMessagingConfigured,
  normalizeUSPhone,
  verifyTwilioSignature,
} from "@/lib/sms";
import { recordInboundMessage } from "@/lib/usage";

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  // Tenant identification: Twilio sends AccountSid on every webhook. Look up
  // the messaging_settings row that holds it; that row's company_id is the
  // tenant the inbound SMS belongs to.
  const accountSid = params.AccountSid || "";
  if (!accountSid) {
    return new NextResponse("Missing AccountSid", { status: 400 });
  }
  const db = await getDb();
  const settings = (await db
    .prepare("SELECT * FROM messaging_settings WHERE account_sid = ? LIMIT 1")
    .get(accountSid)) as MessagingSettings | undefined;
  if (!settings || !isMessagingConfigured(settings)) {
    console.warn(
      `[messages/webhook] Webhook from unknown AccountSid ${accountSid}; dropping.`
    );
    return new NextResponse("Unknown account", { status: 404 });
  }
  const companyId = settings.company_id;

  const signature = req.headers.get("x-twilio-signature") || "";
  const url = buildPublicUrl(req);
  const valid = verifyTwilioSignature({
    authToken: settings.auth_token!,
    url,
    params,
    signature,
  });
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const fromPhone = params.From || "";
  const toPhone = params.To || "";
  const body = params.Body || "";
  const providerSid = params.MessageSid || null;

  const normalizedFrom = normalizeUSPhone(fromPhone) || fromPhone;

  const customers = (await db
    .prepare(
      "SELECT id, phone FROM customers WHERE company_id = ? AND phone IS NOT NULL AND TRIM(phone) != ''"
    )
    .all(companyId)) as Pick<Customer, "id" | "phone">[];

  const match = customers.find(
    (c) => normalizeUSPhone(c.phone) === normalizedFrom
  );

  if (!match) {
    console.warn(
      `[messages/webhook] Inbound SMS from unknown number ${fromPhone} for company ${companyId}; dropping.`
    );
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  await db
    .prepare(
      `INSERT INTO messages
         (company_id, customer_id, body, direction, status, provider_sid, to_phone, from_phone)
       VALUES (?, ?, ?, 'inbound', 'received', ?, ?, ?)`
    )
    .run(companyId, match.id, body, providerSid, toPhone, normalizedFrom);

  try {
    await recordInboundMessage(companyId);
  } catch (e) {
    console.error(
      `[messages/webhook] Failed to record inbound usage for company ${companyId}:`,
      e
    );
  }

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
