import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJobDetail, updateJob, type JobInput } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  const detail = getJobDetail(db, id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<JobInput>;
  try {
    updateJob(db, id, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message === "Not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  const detail = getJobDetail(db, id);
  return NextResponse.json(detail);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
