import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { enableVoiceForCompany, getAppBaseUrl } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const companyId = await requireCompanyId();
    const appBaseUrl = getAppBaseUrl(req);
    const result = await enableVoiceForCompany({ companyId, appBaseUrl });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: `Enable failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
