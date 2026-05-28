import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { disableVoiceForCompany } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST() {
  const companyId = await requireCompanyId();
  await disableVoiceForCompany(companyId);
  return NextResponse.json({ ok: true });
}
