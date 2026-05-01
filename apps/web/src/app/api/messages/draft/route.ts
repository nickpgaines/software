import { NextResponse } from "next/server";
import { getDb, type Customer, type Message } from "@/lib/db";
import { draftSmsReply, getAiSettings, isAiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
  }>;
  const customerId = Number(body.customer_id);
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }

  const settings = await getAiSettings();
  if (!isAiConfigured(settings)) {
    return NextResponse.json(
      {
        error:
          "AI is not configured. Connect Claude in Settings → AI before drafting replies.",
      },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }

  const db = await getDb();
  const customer = (await db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(customerId)) as Customer | undefined;
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const messages = (await db
    .prepare(
      `SELECT * FROM messages
        WHERE customer_id = ?
        ORDER BY created_at ASC, id ASC`
    )
    .all(customerId)) as Message[];

  const result = await draftSmsReply({ settings, customer, messages });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 502, headers: NO_CACHE_HEADERS }
    );
  }
  return NextResponse.json(
    { draft: result.text, model: settings.model },
    { headers: NO_CACHE_HEADERS }
  );
}
