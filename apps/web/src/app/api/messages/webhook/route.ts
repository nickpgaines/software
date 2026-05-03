import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";
import { normalizeUSPhone } from "@/lib/sms";
import {
  getPlatformTwilioCreds,
  verifyTwilioSignature,
} from "@/lib/twilio";

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

  // Tenant identification: with the platform-owned account, every webhook
  // carries the same AccountSid. Identify the tenant by the To phone number,
  // which we sold to a specific company at purchase time.
  const toPhone = params.To || "";
  if (!toPhone) {
    return new NextResponse("Missing To", { status: 400 });
  }

  let creds;
  try {
    creds = getPlatformTwilioCreds();
  } catch (e) {
    console.warn(`[messages/webhook] Platform Twilio not configured: ${(e as Error).message}`);
    return new NextResponse("Service not configured", { status: 503 });
  }

  const signature = req.headers.get("x-twilio-signature") || "";
  const url = buildPublicUrl(req);
  const valid = verifyTwilioSignature({
    authToken: creds.authToken,
    url,
    params,
    signature,
  });
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // Sanity check: AccountSid should match the platform account.
  if (params.AccountSid && params.AccountSid !== creds.accountSid) {
    console.warn(
      `[messages/webhook] AccountSid mismatch ${params.AccountSid} vs platform ${creds.accountSid}`
    );
    return new NextResponse("Unknown account", { status: 404 });
  }

  const db = await getDb();
  const owner = (await db
    .prepare(
      `SELECT company_id FROM phone_numbers
        WHERE phone_number = ? AND status = 'active' LIMIT 1`
    )
    .get(toPhone)) as { company_id: number } | undefined;
  if (!owner) {
    console.warn(
      `[messages/webhook] Inbound SMS for ${toPhone} but no company owns it; dropping.`
    );
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }
  const companyId = owner.company_id;

  const fromPhone = params.From || "";
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

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
