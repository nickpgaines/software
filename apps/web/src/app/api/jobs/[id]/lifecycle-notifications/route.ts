import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getDb, syncReplica } from "@/lib/db";
import { listJobLifecycleNotifications } from "@/lib/job-lifecycle-outbox";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const context = await getSessionContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = Number(params.id);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  await syncReplica();
  const notifications = await listJobLifecycleNotifications({
    db: await getDb(), companyId: context.companyId, jobId,
  });
  if (!notifications) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(notifications);
}
