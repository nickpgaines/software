import { NextResponse } from "next/server";
import { getDb, type MetaPage } from "@/lib/db";
import {
  fetchLeadDetail,
  fieldValue,
  getMetaConfig,
  verifyWebhookSignature,
} from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cfg = getMetaConfig();
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    cfg?.webhookVerifyToken &&
    token === cfg.webhookVerifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type LeadgenChange = {
  field: "leadgen";
  value: {
    leadgen_id: string;
    page_id: string;
    form_id?: string;
    created_time?: number;
  };
};

type WebhookEntry = {
  id: string;
  changes?: LeadgenChange[];
};

type WebhookBody = {
  object: string;
  entry?: WebhookEntry[];
};

export async function POST(req: Request) {
  const cfg = getMetaConfig();
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!cfg) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (!verifyWebhookSignature(raw, sig, cfg.appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.object !== "page") {
    return NextResponse.json({ ok: true });
  }
  const db = await getDb();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const { leadgen_id, page_id, form_id } = change.value;
      const page = (await db
        .prepare("SELECT * FROM meta_pages WHERE page_id = ?")
        .get(page_id)) as MetaPage | undefined;
      if (!page || !page.enabled || !page.page_access_token) continue;
      try {
        const detail = await fetchLeadDetail(leadgen_id, page.page_access_token);
        const firstName = fieldValue(
          detail.field_data,
          "first_name",
          "full_name"
        );
        const lastName = fieldValue(detail.field_data, "last_name");
        const email = fieldValue(detail.field_data, "email");
        const phone = fieldValue(
          detail.field_data,
          "phone_number",
          "phone"
        );
        const address = fieldValue(
          detail.field_data,
          "street_address",
          "address",
          "city"
        );
        await db
          .prepare(
            `INSERT INTO leads
               (first_name, last_name, email, phone, address, source,
                source_page_id, source_page_name, source_form_id,
                meta_lead_id, raw_payload, stage)
             VALUES (?, ?, ?, ?, ?, 'meta', ?, ?, ?, ?, ?, 'new')
             ON CONFLICT(meta_lead_id) DO NOTHING`
          )
          .run(
            firstName,
            lastName,
            email,
            phone,
            address,
            page.page_id,
            page.page_name,
            form_id || detail.form_id || null,
            detail.id,
            JSON.stringify(detail)
          );
      } catch (e) {
        console.error("ingest meta lead failed", leadgen_id, e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
