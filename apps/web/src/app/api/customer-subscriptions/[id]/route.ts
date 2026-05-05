import { NextResponse } from "next/server";
import {
  getDb,
  type CustomerSubscription,
  type CustomerSubscriptionStatus,
} from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  cancelFutureSubscriptionJobs,
  type CancelMode,
} from "@/lib/subscription-schedule";

export const dynamic = "force-dynamic";

const VALID_STATUSES: CustomerSubscriptionStatus[] = [
  "pending",
  "active",
  "declined",
  "canceled",
];

const VALID_CANCEL_MODES: CancelMode[] = ["all_future", "keep_next"];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ?"
    )
    .get(Number(params.id), ctx.companyId)) as
    | CustomerSubscription
    | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
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
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ?"
    )
    .get(id, ctx.companyId)) as CustomerSubscription | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: CustomerSubscriptionStatus;
    cancel_mode: CancelMode;
  }>;
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const acceptedAt =
    body.status === "active" && !existing.accepted_at
      ? now
      : existing.accepted_at;
  const canceledAt =
    body.status === "canceled" || body.status === "declined"
      ? existing.canceled_at || now
      : existing.canceled_at;

  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET status = ?, accepted_at = ?, canceled_at = ?
       WHERE id = ? AND company_id = ?`
    )
    .run(body.status, acceptedAt, canceledAt, id, ctx.companyId);

  let canceledJobs = 0;
  if (body.status === "canceled" || body.status === "declined") {
    const mode: CancelMode =
      body.cancel_mode && VALID_CANCEL_MODES.includes(body.cancel_mode)
        ? body.cancel_mode
        : "all_future";
    canceledJobs = await cancelFutureSubscriptionJobs(
      db,
      id,
      ctx.companyId,
      mode
    );
  }

  const row = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ?"
    )
    .get(id, ctx.companyId)) as CustomerSubscription;
  return NextResponse.json({ ...row, canceled_jobs: canceledJobs });
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
    .prepare(
      "DELETE FROM customer_subscriptions WHERE id = ? AND company_id = ?"
    )
    .run(Number(params.id), ctx.companyId);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
