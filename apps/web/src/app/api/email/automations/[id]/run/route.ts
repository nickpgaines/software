import { NextResponse } from "next/server";
import { getDb, type EmailAutomation } from "@/lib/db";
import {
  buildOriginFromRequest,
  sendAutomationToAudience,
} from "@/lib/email";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const companyId = await requireCompanyId();
  const db = await getDb();
  const automation = (await db
    .prepare(
      `SELECT * FROM email_automations WHERE id = ? AND company_id = ?`
    )
    .get(id, companyId)) as EmailAutomation | undefined;
  if (!automation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (automation.kind !== "seasonal") {
    return NextResponse.json(
      {
        error:
          "Only seasonal automations can be sent on demand. Welcome emails go out automatically when a customer is added.",
      },
      { status: 400 }
    );
  }
  const summary = await sendAutomationToAudience(
    automation,
    buildOriginFromRequest(req)
  );
  if (summary.skipped) {
    return NextResponse.json(
      { error: skippedMessage(summary.skipped) },
      { status: 400 }
    );
  }
  return NextResponse.json(summary);
}

function skippedMessage(reason: string): string {
  switch (reason) {
    case "not_configured":
      return "Email isn't connected. Add your Resend key in Settings → Email.";
    case "empty":
      return "Add a subject and message before sending.";
    case "no_recipients":
      return "No recipients in this audience.";
    default:
      return reason;
  }
}
