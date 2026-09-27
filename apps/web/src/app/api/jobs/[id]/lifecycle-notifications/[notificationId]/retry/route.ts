import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  deliverJobLifecycleNotification,
  listJobLifecycleNotifications,
  requestJobLifecycleNotificationRetry,
} from "@/lib/job-lifecycle-outbox";
import { sendAndLogCompanySms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string; notificationId: string } }
) {
  const context = await getSessionContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = Number(params.id);
  const notificationId = Number(params.notificationId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0 || !Number.isSafeInteger(notificationId) || notificationId <= 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { confirm_unknown?: unknown };
  const db = await getDb();
  const requested = await requestJobLifecycleNotificationRetry({
    db,
    companyId: context.companyId,
    jobId,
    notificationId,
    actorStaffId: context.staffId,
    confirmUnknown: body.confirm_unknown === true,
  });
  if (!requested.ok) {
    if (requested.reason === "not_found") {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    if (requested.reason === "confirmation_required") {
      return NextResponse.json({
        error: "Retrying an unknown delivery may send a duplicate text. Set confirm_unknown to true to continue.",
      }, { status: 409 });
    }
    return NextResponse.json({
      error: `A ${requested.outcome} notification cannot be retried.`,
    }, { status: 409 });
  }

  await deliverJobLifecycleNotification({
    db,
    companyId: context.companyId,
    jobId,
    step: requested.step,
    send: ({ customerId, body: text }) => sendAndLogCompanySms({
      companyId: context.companyId, customerId, body: text,
    }),
  });
  const notifications = await listJobLifecycleNotifications({
    db, companyId: context.companyId, jobId,
  });
  const notification = notifications?.find(item => item.id === notificationId);
  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  return NextResponse.json(notification);
}
