import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  authenticateWidgetToken,
  issueWidgetToken,
  revokeWidgetToken,
} from "@/lib/widget-auth";
import {
  handleWidgetRevocationRequest,
  isNativeWidgetRequest,
  validateWidgetInstallationId,
} from "@/lib/widget-http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isNativeWidgetRequest(req)) {
    return NextResponse.json(
      { error: "Widget credentials are available only in the iOS app." },
      { status: 403 }
    );
  }
  if (ctx.staffId === null || ctx.isPlatformAdmin) {
    return NextResponse.json(
      { error: "A company employee account is required." },
      { status: 403 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    installation_id?: unknown;
  };
  const installationId = validateWidgetInstallationId(body.installation_id);
  if (!installationId) {
    return NextResponse.json(
      { error: "Invalid installation id." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();
    const issued = await issueWidgetToken(db, {
      companyId: ctx.companyId,
      staffId: ctx.staffId,
      installationId,
    });
    return NextResponse.json({
      token: issued.token,
      expires_at: issued.expiresAt,
      company_id: issued.companyId,
      staff_id: issued.staffId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not create a widget credential." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const db = await getDb();
  return handleWidgetRevocationRequest(req, {
    authenticate: (token) => authenticateWidgetToken(db, token),
    revoke: (token) => revokeWidgetToken(db, token),
  });
}
