import { NextResponse } from "next/server";
import { getDb, syncReplica } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { getJobDetail, updateJob, type JobInput } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  // The Job Detail page calls this after the Stripe payment modal closes
  // (`refreshJob`) and after every status step. If the read lands on a
  // different instance than the one that committed the write, the local
  // replica may be stale and child rows (payments, timestamps) won't show
  // up — that's why a manual refresh was needed before. Sync first so
  // the response always reflects the latest committed state.
  await syncReplica();
  const detail = await getJobDetail(db, id, companyId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<JobInput>;
  try {
    await updateJob(db, id, body, companyId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message === "Not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  // Sync the embedded replica before reading back so the response — and
  // the RSC re-render the client triggers next — reflect the just-saved
  // values (e.g. an edited price) instead of the stale local replica.
  // Coalesced with any in-flight sync; no-op outside replica mode.
  await syncReplica();
  const detail = await getJobDetail(db, id, companyId);
  return NextResponse.json(detail);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM jobs WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return NextResponse.json({ ok: true });
}
