import { NextResponse } from "next/server";
import { getVoiceSettings } from "@/lib/voice";

export const dynamic = "force-dynamic";

// Public endpoint -- Twilio's edge fetches this when playing the inbound
// voicemail greeting. The greeting itself is stored as a data URL on the
// tenant's messaging_settings row; we parse it on each request and stream
// the raw audio bytes back so <Play> can render it.
export async function GET(
  _req: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId: idStr } = await context.params;
  const companyId = Number(idStr);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ error: "Invalid company" }, { status: 400 });
  }
  const settings = await getVoiceSettings(companyId);
  const dataUrl = settings.voice_voicemail_greeting_data_url;
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "No greeting" }, { status: 404 });
  }
  const match = /^data:([^;,]+)(?:;base64)?,(.*)$/.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ error: "Malformed greeting" }, { status: 500 });
  }
  const [, contentType, payload] = match;
  const isBase64 = dataUrl.includes(";base64,");
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf-8");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType || "audio/mpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}
