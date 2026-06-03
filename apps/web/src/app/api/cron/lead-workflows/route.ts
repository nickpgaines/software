import { NextResponse } from "next/server";
import { runPendingWorkflowSteps } from "@/lib/lead-workflows";

export const dynamic = "force-dynamic";

// Advances every pending workflow run: executes whatever steps are ready
// (delays whose timer elapsed, plus any immediately-following actions),
// marks runs completed when they reach the end, and marks them failed when
// an action errors. Intended to run every few minutes. Idempotent — runs
// already at the failed/completed terminal state are skipped.
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await runPendingWorkflowSteps();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
