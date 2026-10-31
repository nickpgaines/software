import { NextResponse } from "next/server";
import { getDb, type Company, type Customer, type MessagingSettings } from "@/lib/db";
import {
  isMessagingConfigured,
  normalizeUSPhone,
} from "@/lib/sms";
import { verifyTwilioWebhook } from "@/lib/twilio-webhook-signature";
import {
  findCompanyByPlatformNumber,
  getPlatformConfig,
} from "@/lib/twilio-platform";

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

const OPT_OUT_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);
const OPT_IN_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

const TRIAL_AUTO_REPLY =
  "This number doesn't accept replies. Please contact the business directly.";

function classifyKeyword(body: string): "opt_out" | "opt_in" | "help" | null {
  const word = body.trim().toUpperCase().split(/\s+/)[0] ?? "";
  if (OPT_OUT_KEYWORDS.has(word)) return "opt_out";
  if (OPT_IN_KEYWORDS.has(word)) return "opt_in";
  if (HELP_KEYWORDS.has(word)) return "help";
  return null;
}

async function recordOptOutState(args: {
  companyId: number;
  phone: string;
  keyword: string;
  optOut: boolean;
}): Promise<void> {
  const db = await getDb();
  const existing = await db
    .prepare(
      `SELECT id FROM sms_opt_outs WHERE company_id = ? AND phone = ? LIMIT 1`
    )
    .get<{ id: number }>(args.companyId, args.phone);
  if (existing) {
    await db
      .prepare(
        `UPDATE sms_opt_outs
            SET opted_out = ?,
                last_keyword = ?,
                opted_out_at = CASE WHEN ? = 1 THEN datetime('now') ELSE opted_out_at END,
                opted_in_at  = CASE WHEN ? = 0 THEN datetime('now') ELSE opted_in_at END,
                updated_at   = datetime('now')
          WHERE id = ?`
      )
      .run(
        args.optOut ? 1 : 0,
        args.keyword,
        args.optOut ? 1 : 0,
        args.optOut ? 1 : 0,
        existing.id
      );
  } else {
    await db
      .prepare(
        `INSERT INTO sms_opt_outs
           (company_id, phone, opted_out, last_keyword, opted_out_at, opted_in_at)
         VALUES (?, ?, ?, ?,
                 CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
                 CASE WHEN ? = 0 THEN datetime('now') ELSE NULL END)`
      )
      .run(
        args.companyId,
        args.phone,
        args.optOut ? 1 : 0,
        args.keyword,
        args.optOut ? 1 : 0,
        args.optOut ? 1 : 0
      );
  }
}

// For trial / paid_pending tenants the To-number is one of the shared pool
// numbers, so we can't identify the tenant from To alone. Fall back to the
// most recent outbound message whose To matches the inbound From and whose
// from_phone matches the pool number; that's the tenant the recipient was
// last conversing with on this pool number. This matches Twilio's
// sticky-sender model.
async function findTenantByRecentOutbound(args: {
  fromPhone: string;
  toPhone: string;
}): Promise<number | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT company_id FROM messages
         WHERE direction = 'outbound'
           AND to_phone = ?
           AND (from_phone = ? OR from_phone IS NULL)
         ORDER BY created_at DESC
         LIMIT 1`
    )
    .get<{ company_id: number }>(args.fromPhone, args.toPhone);
  return row?.company_id ?? null;
}

export async function POST(req: Request) {
  const cfg = getPlatformConfig();
  if (!cfg) {
    return new NextResponse("Platform not configured", { status: 500 });
  }

  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  const fromPhone = params.From || "";
  const toPhone = params.To || "";
  const body = params.Body || "";
  const providerSid = params.MessageSid || null;
  const accountSid = params.AccountSid || "";

  if (!toPhone || !accountSid) {
    return new NextResponse("Missing required params", { status: 400 });
  }

  // Verify signature against the right auth token for this AccountSid.
  //   1. Master account → trial pool sends. Master auth token signs.
  //   2. Tenant subaccount → tenant's dedicated number. Subaccount auth
  //      token signs; we look it up on the company row.
  //   3. Legacy BYO → tenant's own external Twilio account. Auth token
  //      lives in messaging_settings.
  let signatureValid = false;
  const authenticatedCompanyIds: number[] = [];
  const isMasterAccount = accountSid === cfg.masterAccountSid;
  if (isMasterAccount) {
    signatureValid = verifyTwilioWebhook(req, params, cfg.masterAuthToken);
  } else {
    const db = await getDb();
    const subaccount = (await db
      .prepare(
        "SELECT id, twilio_subaccount_auth_token FROM company WHERE twilio_subaccount_sid = ? LIMIT 1"
      )
      .get(accountSid)) as
      | { id: number; twilio_subaccount_auth_token: string | null }
      | undefined;
    if (subaccount?.twilio_subaccount_auth_token) {
      signatureValid = verifyTwilioWebhook(req, params, subaccount.twilio_subaccount_auth_token);
      if (signatureValid) authenticatedCompanyIds.push(subaccount.id);
    }
    if (!signatureValid) {
      const settings = await db
        .prepare(
          "SELECT * FROM messaging_settings WHERE account_sid = ?"
        )
        .all<MessagingSettings>(accountSid);
      for (const setting of settings) {
        if (isMessagingConfigured(setting) && verifyTwilioWebhook(req, params, setting.auth_token)) {
          signatureValid = true;
          authenticatedCompanyIds.push(setting.company_id);
        }
      }
    }
  }
  if (!signatureValid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const normalizedFrom = normalizeUSPhone(fromPhone) || fromPhone;
  const db = await getDb();

  // Resolve tenant. Dedicated numbers and legacy platform_phone_number both
  // identify their owner directly. Pool numbers don't; fall back to the
  // sticky-sender history.
  let company: Company | null = null;
  company = await findCompanyByPlatformNumber(toPhone);
  if (!company) {
    const companyId = await findTenantByRecentOutbound({
      fromPhone: normalizedFrom,
      toPhone,
    });
    if (companyId) {
      company =
        (await db
          .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
          .get<Company>(companyId)) ?? null;
    }
  }
  if (!company) {
    console.warn(
      `[messages/webhook] No tenant resolvable for To=${toPhone} From=${fromPhone}; dropping.`
    );
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  // A tenant-owned token cannot route replies or STOP/START changes into
  // another tenant by supplying its phone number or matching its history.
  if (!isMasterAccount && !authenticatedCompanyIds.includes(company.id)) {
    return new NextResponse("Account does not own this conversation", { status: 403 });
  }

  const keyword = classifyKeyword(body);
  const isApproved = company.sms_tier === "paid_approved";

  if (keyword === "opt_out") {
    await recordOptOutState({
      companyId: company.id,
      phone: normalizedFrom,
      keyword: body.trim().toUpperCase().split(/\s+/)[0] || "STOP",
      optOut: true,
    });
  } else if (keyword === "opt_in") {
    await recordOptOutState({
      companyId: company.id,
      phone: normalizedFrom,
      keyword: body.trim().toUpperCase().split(/\s+/)[0] || "START",
      optOut: false,
    });
  }

  // Persist the inbound message when we can attach it to a known customer.
  // Two-way tenants need this for the conversations UI; trial tenants don't
  // surface inbound but we still log it for audit if the customer is known.
  const customers = (await db
    .prepare(
      "SELECT id, phone FROM customers WHERE company_id = ? AND phone IS NOT NULL AND TRIM(phone) != ''"
    )
    .all(company.id)) as Pick<Customer, "id" | "phone">[];
  const match = customers.find(
    (c) => normalizeUSPhone(c.phone) === normalizedFrom
  );
  if (match) {
    await db
      .prepare(
        `INSERT INTO messages
           (company_id, customer_id, body, direction, status, provider_sid, to_phone, from_phone, tier_at_send)
         VALUES (?, ?, ?, 'inbound', 'received', ?, ?, ?, ?)`
      )
      .run(
        company.id,
        match.id,
        body,
        providerSid,
        toPhone,
        normalizedFrom,
        company.sms_tier
      );
  }

  // For non-approved tiers we don't deliver the inbound to the tenant UI
  // beyond the audit log above. Auto-reply once so the recipient isn't left
  // wondering, and let Twilio's campaign-level STOP/HELP responses handle
  // the carrier-mandated confirmations on top.
  if (!isApproved && keyword === null) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${TRIAL_AUTO_REPLY}</Message></Response>`,
      { status: 200, headers: TWIML_HEADERS }
    );
  }

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
