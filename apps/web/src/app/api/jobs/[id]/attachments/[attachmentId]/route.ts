import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const jobId = Number(params.id);
  const attachmentId = Number(params.attachmentId);
  const owned = await db
    .prepare(
      `SELECT a.id FROM job_attachments a
         JOIN jobs j ON j.id = a.job_id
        WHERE a.id = ? AND a.job_id = ? AND j.company_id = ?`
    )
    .get(attachmentId, jobId, ctx.companyId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db
    .prepare("DELETE FROM job_attachments WHERE id = ?")
    .run(attachmentId);
  return NextResponse.json({ ok: true });
}
