import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { disableVoiceForCompany } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const companyId = await requireCompanyId();
    await disableVoiceForCompany(companyId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: `Disable failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
