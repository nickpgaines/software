import { NextResponse } from "next/server";
import { getDb, type Company } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  checkVoiceCapability,
  getVoiceSettings,
  setVoiceCapabilityVerified,
} from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const companyId = await requireCompanyId();
    const db = await getDb();
    const company = await db
      .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
      .get<Company>(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const settings = await getVoiceSettings(companyId);
    const result = await checkVoiceCapability(company, settings);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.voice) {
      await setVoiceCapabilityVerified(companyId);
    }
    return NextResponse.json({
      voice: result.voice,
      phone_number: result.phoneNumber,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Capability check failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
