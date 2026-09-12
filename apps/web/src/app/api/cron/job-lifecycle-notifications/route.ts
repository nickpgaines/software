import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runPendingJobLifecycleNotifications } from "@/lib/job-lifecycle-outbox";
import { sendAndLogCompanySms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runPendingJobLifecycleNotifications({ db: await getDb(), send: sendAndLogCompanySms });
  return NextResponse.json({ ok: true, ...result });
}

export const GET = POST;
