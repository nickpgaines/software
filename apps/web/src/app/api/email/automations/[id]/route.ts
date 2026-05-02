import { NextResponse } from "next/server";
import { getDb, type EmailAudience, type EmailAutomation } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_AUDIENCES: EmailAudience[] = [
  "all_customers",
  "active_subscribers",
  "non_subscribers",
  "prospects",
];

type Params = { params: Promise<{ id: string }> };

async function loadAutomation(
  id: number,
  companyId: number
): Promise<EmailAutomation | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT * FROM email_automations WHERE id = ? AND company_id = ?`
    )
    .get(id, companyId)) as EmailAutomation | undefined;
  return row ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const companyId = await requireCompanyId();
  const row = await loadAutomation(id, companyId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const companyId = await requireCompanyId();
  const existing = await loadAutomation(id, companyId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    enabled: boolean;
    audience: EmailAudience;
    subject: string;
    body_html: string;
    send_month: number | null;
    send_day: number | null;
  }>;

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (typeof body.enabled === "boolean") {
    updates.push("enabled = ?");
    args.push(body.enabled ? 1 : 0);
  }
  if (typeof body.audience === "string") {
    if (!ALLOWED_AUDIENCES.includes(body.audience)) {
      return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
    }
    updates.push("audience = ?");
    args.push(body.audience);
  }
  if (typeof body.subject === "string") {
    updates.push("subject = ?");
    args.push(body.subject);
  }
  if (typeof body.body_html === "string") {
    updates.push("body_html = ?");
    args.push(body.body_html);
  }
  if ("send_month" in body) {
    const m = body.send_month;
    if (m == null) {
      updates.push("send_month = NULL");
    } else if (Number.isInteger(m) && m >= 1 && m <= 12) {
      updates.push("send_month = ?");
      args.push(m);
    } else {
      return NextResponse.json(
        { error: "send_month must be 1-12" },
        { status: 400 }
      );
    }
  }
  if ("send_day" in body) {
    const d = body.send_day;
    if (d == null) {
      updates.push("send_day = NULL");
    } else if (Number.isInteger(d) && d >= 1 && d <= 31) {
      updates.push("send_day = ?");
      args.push(d);
    } else {
      return NextResponse.json(
        { error: "send_day must be 1-31" },
        { status: 400 }
      );
    }
  }

  if (updates.length === 0) {
    return NextResponse.json(existing);
  }

  updates.push("updated_at = datetime('now')");
  args.push(id);
  args.push(companyId);

  const db = await getDb();
  await db
    .prepare(
      `UPDATE email_automations SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`
    )
    .run(...args);

  const updated = await loadAutomation(id, companyId);
  return NextResponse.json(updated);
}
