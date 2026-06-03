import { NextResponse } from "next/server";
import { getDb, type Customer, type Lead } from "@/lib/db";
import { normalizeUSPhone, verifyTwilioSignature } from "@/lib/sms";
import {
  findCompanyByPlatformNumber,
  getPlatformConfig,
} from "@/lib/twilio-platform";
import { fireTrigger } from "@/lib/lead-workflows";

// Inbound webhook for SMS sent to platform-managed Twilio numbers. All
// platform numbers share the master account's AccountSid, so we identify
// the tenant by looking up which company owns the To number rather than
// the BYO-style AccountSid lookup used by /api/messages/webhook.

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function POST(req: Request) {
  const cfg = getPlatformConfig();
  if (!cfg) {
    return new NextResponse("Platform not configured", { status: 500 });
  }

  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  // Verify the request actually came from Twilio. Signature is computed with
  // the master auth token because the master account owns these numbers.
  const signature = req.headers.get("x-twilio-signature") || "";
  const url = buildPublicUrl(req);
  const valid = verifyTwilioSignature({
    authToken: cfg.masterAuthToken,
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

  if (!toPhone) {
    return new NextResponse("Missing To", { status: 400 });
  }

  const company = await findCompanyByPlatformNumber(toPhone);
  if (!company) {
    console.warn(
      `[twilio/inbound-sms] No tenant found for To=${toPhone}; dropping.`
    );
    return new NextResponse("Unknown number", { status: 404 });
  }

  const normalizedFrom = normalizeUSPhone(fromPhone) || fromPhone;

  const db = await getDb();
  const customers = (await db
    .prepare(
      "SELECT id, phone FROM customers WHERE company_id = ? AND phone IS NOT NULL AND TRIM(phone) != ''"
    )
    .all(company.id)) as Pick<Customer, "id" | "phone">[];

  const match = customers.find(
    (c) => normalizeUSPhone(c.phone) === normalizedFrom
  );

  if (!match) {
    console.warn(
      `[twilio/inbound-sms] Inbound from unknown number ${fromPhone} for company ${company.id}; dropping.`
    );
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  await db
    .prepare(
      `INSERT INTO messages
         (company_id, customer_id, body, direction, status, provider_sid, to_phone, from_phone)
       VALUES (?, ?, ?, 'inbound', 'received', ?, ?, ?)`
    )
    .run(company.id, match.id, body, providerSid, toPhone, normalizedFrom);

  // Fire lead_replied trigger for any leads tied to this customer or matching
  // the inbound phone directly. Inbound reply is also a cue that whatever
  // outreach was in flight should stop, so we cancel pending runs for this lead.
  const allLeads = (await db
    .prepare("SELECT id, phone, customer_id FROM leads WHERE company_id = ?")
    .all(company.id)) as Pick<Lead, "id" | "phone" | "customer_id">[];
  const matchedLeads = allLeads.filter(
    (l) =>
      l.customer_id === match.id ||
      (l.phone && normalizeUSPhone(l.phone) === normalizedFrom)
  );
  for (const lead of matchedLeads) {
    await db
      .prepare(
        `UPDATE lead_workflow_runs SET status = 'cancelled'
           WHERE lead_id = ? AND status = 'pending'`
      )
      .run(lead.id);
    await fireTrigger({
      companyId: company.id,
      leadId: lead.id,
      trigger: "lead_replied",
    });
  }

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
