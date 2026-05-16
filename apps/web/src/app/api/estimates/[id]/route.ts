import { NextResponse } from "next/server";
import {
  getDb,
  type Estimate,
  type EstimateItem,
  type EstimateStatus,
} from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES: EstimateStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "canceled",
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const estimate = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Estimate | undefined;
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = (await db
    .prepare(
      "SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY position ASC, id ASC"
    )
    .all(id)) as EstimateItem[];
  let sold_by_name: string | null = null;
  if (estimate.sold_by_id != null) {
    const s = await db
      .prepare("SELECT name FROM staff WHERE id = ?")
      .get<{ name: string }>(estimate.sold_by_id);
    sold_by_name = s?.name ?? null;
  }
  return NextResponse.json({ ...estimate, items, sold_by_name });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Estimate | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: EstimateStatus;
    signature_data: string;
    signature_name: string;
  }>;
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const acceptedAt =
    body.status === "accepted"
      ? existing.accepted_at || now
      : existing.accepted_at;
  const declinedAt =
    body.status === "declined"
      ? existing.declined_at || now
      : existing.declined_at;
  const signatureData =
    typeof body.signature_data === "string" && body.signature_data.trim()
      ? body.signature_data.trim()
      : existing.signature_data;
  const signatureName =
    typeof body.signature_name === "string" && body.signature_name.trim()
      ? body.signature_name.trim()
      : existing.signature_name;
  const signedAt = signatureData
    ? existing.signed_at || now
    : existing.signed_at;

  await db
    .prepare(
      `UPDATE estimates
         SET status = ?, accepted_at = ?, declined_at = ?,
             signature_data = ?, signature_name = ?, signed_at = ?,
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(
      body.status,
      acceptedAt,
      declinedAt,
      signatureData,
      signatureName,
      signedAt,
      id,
      ctx.companyId
    );
  const row = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Estimate;
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await db
    .prepare("DELETE FROM estimates WHERE id = ? AND company_id = ?")
    .run(Number(params.id), ctx.companyId);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
