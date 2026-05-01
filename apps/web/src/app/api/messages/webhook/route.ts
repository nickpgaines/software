import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";
import {
  getMessagingSettings,
  isMessagingConfigured,
  normalizeUSPhone,
  verifyTwilioSignature,
} from "@/lib/sms";

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
  const settings = await getMessagingSettings();
  if (!isMessagingConfigured(settings)) {
    return new NextResponse("Messaging not configured", { status: 503 });
  }

  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

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

  const db = await getDb();
  const customers = (await db
    .prepare(
      "SELECT id, phone FROM customers WHERE phone IS NOT NULL AND TRIM(phone) != ''"
    )
    .all()) as Pick<Customer, "id" | "phone">[];

  const match = customers.find(
    (c) => normalizeUSPhone(c.phone) === normalizedFrom
  );

  if (!match) {
    console.warn(
      `[messages/webhook] Inbound SMS from unknown number ${fromPhone}; dropping.`
    );
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  await db
    .prepare(
      `INSERT INTO messages
         (customer_id, body, direction, status, provider_sid, to_phone, from_phone)
       VALUES (?, ?, 'inbound', 'received', ?, ?, ?)`
    )
    .run(match.id, body, providerSid, toPhone, normalizedFrom);

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
