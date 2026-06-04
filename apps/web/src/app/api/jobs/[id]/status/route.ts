import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { getJobDetail, setStatusStep } from "@/lib/jobs";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const STEPS = ["en_route", "arrived", "started", "completed"] as const;
type Step = (typeof STEPS)[number];

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = ctx.companyId;
  const db = await getDb();
  const id = Number(params.id);
  const { step, clear } = (await req.json().catch(() => ({}))) as {
    step?: Step;
    clear?: boolean;
  };
  if (!step || !STEPS.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  // Snapshot the prior timestamp on the column the step is about to set,
  // so we only record an event when the state actually transitions
  // (and not on idempotent re-clicks of the same button).
  const col =
    step === "en_route"
      ? "en_route_at"
      : step === "arrived"
      ? "arrived_at"
      : step === "started"
      ? "started_at"
      : "completed_at";
  const before = (await db
    .prepare(`SELECT ${col} AS ts FROM jobs WHERE id = ? AND company_id = ?`)
    .get(id, companyId)) as { ts: string | null } | undefined;

  await setStatusStep(db, id, step, companyId, !!clear);
  const detail = await getJobDetail(db, id, companyId);

  if (!clear && detail && before && before.ts == null && (step === "started" || step === "completed")) {
    try {
      await recordActivity(db, companyId, {
        type: step === "started" ? "job.started" : "job.completed",
        subjectType: "job",
        subjectId: id,
        subjectLabel: detail.customer_name || `Job #${id}`,
        actorUserId: ctx.staffId,
        amountCents: step === "completed" ? detail.price_cents : null,
      });
    } catch {
      // never break the response over a logging failure
    }
  }

  return NextResponse.json(detail);
}
