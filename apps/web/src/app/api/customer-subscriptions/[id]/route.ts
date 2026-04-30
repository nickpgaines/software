import { NextResponse } from "next/server";
import {
  getDb,
  type CustomerSubscription,
  type CustomerSubscriptionStatus,
} from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES: CustomerSubscriptionStatus[] = [
  "pending",
  "active",
  "declined",
  "canceled",
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM customer_subscriptions WHERE id = ?")
    .get(Number(params.id))) as CustomerSubscription | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM customer_subscriptions WHERE id = ?")
    .get(id)) as CustomerSubscription | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: CustomerSubscriptionStatus;
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
       WHERE id = ?`
    )
    .run(body.status, acceptedAt, canceledAt, id);
  const row = (await db
    .prepare("SELECT * FROM customer_subscriptions WHERE id = ?")
    .get(id)) as CustomerSubscription;
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await db
    .prepare("DELETE FROM customer_subscriptions WHERE id = ?")
    .run(Number(params.id));
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
