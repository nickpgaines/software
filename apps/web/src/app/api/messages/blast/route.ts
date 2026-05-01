import { NextResponse } from "next/server";
import { getDb, type Customer, type Message } from "@/lib/db";
import {
  getMessagingSettings,
  isMessagingConfigured,
  normalizeUSPhone,
  sendSms,
} from "@/lib/sms";

export const dynamic = "force-dynamic";

type Body = {
  customer_ids?: number[];
  body?: string;
};

export async function POST(req: Request) {
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Body;
  const text = (body.body || "").trim();
  const ids = Array.isArray(body.customer_ids)
    ? Array.from(
        new Set(
          body.customer_ids
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      )
    : [];

  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "At least one customer_id is required" },
      { status: 400 }
    );
  }

  const settings = await getMessagingSettings();
  if (!isMessagingConfigured(settings)) {
    return NextResponse.json(
      { error: "Messaging is not configured. Add Twilio credentials in Settings." },
      { status: 400 }
    );
  }

  const placeholders = ids.map(() => "?").join(",");
  const customers = (await db
    .prepare(`SELECT * FROM customers WHERE id IN (${placeholders})`)
    .all(...ids)) as Customer[];
  const byId = new Map<number, Customer>();
  for (const c of customers) byId.set(c.id, c);

  const fromPhone = settings.from_number;
  const messages: Message[] = [];
  let sent = 0;
  let failed = 0;
  let noPhone = 0;

  for (const id of ids) {
    const customer = byId.get(id);
    if (!customer) {
      failed++;
      continue;
    }
    const toPhone = normalizeUSPhone(customer.phone);
    let status: string;
    let errorMsg: string | null = null;
    let providerSid: string | null = null;

    if (!toPhone) {
      status = "no_phone";
      errorMsg = "Customer has no valid phone number.";
      noPhone++;
    } else {
      const result = await sendSms({ settings, to: toPhone, body: text });
      if (result.ok) {
        status = result.status || "queued";
        providerSid = result.sid;
        sent++;
      } else {
        status = "failed";
        errorMsg = result.error;
        failed++;
      }
    }

    const insert = await db
      .prepare(
        `INSERT INTO messages
           (customer_id, body, direction, status, error, provider_sid, to_phone, from_phone)
         VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?)`
      )
      .run(id, text, status, errorMsg, providerSid, toPhone, fromPhone);
    const created = (await db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(insert.lastInsertRowid)) as Message;
    messages.push(created);
  }

  return NextResponse.json({
    total: ids.length,
    sent,
    failed,
    no_phone: noPhone,
    messages,
  });
}
