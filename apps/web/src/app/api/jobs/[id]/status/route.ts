import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { getJobDetail, setStatusStep } from "@/lib/jobs";
import { recordActivity } from "@/lib/activity";
import { dispatchJobLifecycleNotification } from "@/lib/job-lifecycle-dispatch";
import { sendAndLogCompanySms } from "@/lib/sms";

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

  const changed = await setStatusStep(db, id, step, companyId, !!clear);
  const detail = await getJobDetail(db, id, companyId);

  if (!clear && changed && detail && (step === "started" || step === "completed")) {
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

  const statusNotification = detail
    ? await dispatchJobLifecycleNotification({
        db,
        companyId,
        jobId: id,
        step,
        changed,
        clear: !!clear,
        send: ({ customerId, body }) =>
          sendAndLogCompanySms({ companyId, customerId, body }),
      })
    : null;

  return NextResponse.json(
    detail ? { ...detail, status_notification: statusNotification } : detail
  );
}
