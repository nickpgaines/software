import { NextResponse } from "next/server";
import { getDb, type Task } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

async function loadTask(
  db: Awaited<ReturnType<typeof getDb>>,
  id: number,
  companyId: number
): Promise<Task | undefined> {
  return (await db
    .prepare("SELECT * FROM tasks WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Task | undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const id = Number(params.id);
  const existing = await loadTask(db, id, ctx.companyId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: "open" | "done";
    title: string;
    details: string | null;
    start_at: string;
    end_at: string;
  }>;

  const wasOpen = existing.status === "open";
  const becomingDone = body.status === "done";
  const becomingOpen = body.status === "open";

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (becomingDone) {
    updates.push("status = 'done'", "completed_at = datetime('now')", "completed_by_user_id = ?");
    args.push(ctx.staffId);
  } else if (becomingOpen) {
    updates.push("status = 'open'", "completed_at = NULL", "completed_by_user_id = NULL");
  }
  if (typeof body.title === "string") {
    updates.push("title = ?");
    args.push(body.title.trim());
  }
  if (body.details !== undefined) {
    updates.push("details = ?");
    args.push(body.details === null ? null : String(body.details));
  }
  if (typeof body.start_at === "string") {
    updates.push("start_at = ?");
    args.push(body.start_at);
  }
  if (typeof body.end_at === "string") {
    updates.push("end_at = ?");
    args.push(body.end_at);
  }

  if (updates.length === 0) {
    return NextResponse.json(existing);
  }

  updates.push("updated_at = datetime('now')");
  args.push(id, ctx.companyId);
  await db
    .prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`)
    .run(...args);

  if (wasOpen && becomingDone) {
    try {
      await recordActivity(db, ctx.companyId, {
        type: "task.completed",
        subjectType: "task",
        subjectId: id,
        subjectLabel: existing.title,
        actorUserId: ctx.staffId,
      });
    } catch {
      // never break the write over a logging failure
    }
  }

  const updated = await loadTask(db, id, ctx.companyId);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM tasks WHERE id = ? AND company_id = ?")
    .run(id, ctx.companyId);
  return NextResponse.json({ ok: true });
}
