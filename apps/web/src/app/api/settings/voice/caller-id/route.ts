import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { getVoiceSettings, setVoiceCallerIdName } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await requireCompanyId();
  const settings = await getVoiceSettings(companyId);
  return NextResponse.json({ name: settings.voice_caller_id_name ?? "" });
}

export async function PUT(req: Request) {
  try {
    const companyId = await requireCompanyId();
    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name : "";
    const result = await setVoiceCallerIdName({ companyId, name });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const settings = await getVoiceSettings(companyId);
    return NextResponse.json({ name: settings.voice_caller_id_name ?? "" });
  } catch (e) {
    return NextResponse.json(
      { error: `Save failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
