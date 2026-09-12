import { NextResponse } from "next/server";
import { getSessionContext, type SessionContext } from "@/lib/auth";
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

type NativeWidgetSession =
  | { ctx: SessionContext & { staffId: number } }
  | { response: NextResponse };

async function nativeWidgetSession(req: Request): Promise<NativeWidgetSession> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isNativeWidgetRequest(req)) {
    return {
      response: NextResponse.json(
        { error: "Widget credentials are available only in the iOS app." },
        { status: 403 }
      ),
    };
  }
  if (ctx.staffId === null || ctx.isPlatformAdmin) {
    return {
      response: NextResponse.json(
        { error: "A company employee account is required." },
        { status: 403 }
      ),
    };
  }
  return { ctx: ctx as SessionContext & { staffId: number } };
}

export async function GET(req: Request) {
  const session = await nativeWidgetSession(req);
  if ("response" in session) return session.response;
  return NextResponse.json({
    company_id: session.ctx.companyId,
    staff_id: session.ctx.staffId,
  });
}

export async function POST(req: Request) {
  const session = await nativeWidgetSession(req);
  if ("response" in session) return session.response;
  const { ctx } = session;
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
