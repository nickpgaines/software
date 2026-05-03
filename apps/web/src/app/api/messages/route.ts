import { NextResponse } from "next/server";
import { getDb, type Customer, type Message } from "@/lib/db";
import {
  getMessagingSettings,
  isMessagingConfigured,
  normalizeUSPhone,
  sendSms,
} from "@/lib/sms";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const customerId = Number(url.searchParams.get("customer_id"));
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }
  const rows = (await db
    .prepare(
      "SELECT * FROM messages WHERE customer_id = ? AND company_id = ? ORDER BY created_at ASC, id ASC"
    )
    .all(customerId, companyId)) as Message[];
  await db.prepare(
    `UPDATE messages SET read_at = datetime('now')
     WHERE customer_id = ? AND company_id = ?
       AND direction = 'inbound' AND read_at IS NULL`
  ).run(customerId, companyId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
    body: string;
  }>;
  const customerId = Number(body.customer_id);
  const text = (body.body || "").trim();
  if (!customerId || !text) {
    return NextResponse.json(
      { error: "customer_id and body are required" },
      { status: 400 }
    );
  }

  const customer = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(customerId, companyId)) as Customer | undefined;
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const settings = await getMessagingSettings(companyId);
  const toPhone = normalizeUSPhone(customer.phone);
  const fromPhone = settings.from_number;

  let status: string;
  let errorMsg: string | null = null;
  let providerSid: string | null = null;

  if (!isMessagingConfigured(settings)) {
    status = "not_configured";
    errorMsg = "Messaging is not configured. Add Twilio credentials in Settings.";
  } else if (!toPhone) {
    status = "failed";
    errorMsg = "Customer has no valid phone number.";
  } else {
    const result = await sendSms({ settings, to: toPhone, body: text });
    if (result.ok) {
      status = result.status || "queued";
      providerSid = result.sid;
    } else {
      status = "failed";
      errorMsg = result.error;
    }
  }

  const insert = await db
    .prepare(
      `INSERT INTO messages
         (company_id, customer_id, body, direction, status, error, provider_sid, to_phone, from_phone)
       VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      customerId,
      text,
      status,
      errorMsg,
      providerSid,
      toPhone,
      fromPhone
    );
  const created = (await db
    .prepare("SELECT * FROM messages WHERE id = ? AND company_id = ?")
    .get(insert.lastInsertRowid, companyId)) as Message;

  return NextResponse.json(created, { status: 201 });
}
