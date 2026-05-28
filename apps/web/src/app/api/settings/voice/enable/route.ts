import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { enableVoiceForCompany, getAppBaseUrl } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const appBaseUrl = getAppBaseUrl(req);
  const result = await enableVoiceForCompany({ companyId, appBaseUrl });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
