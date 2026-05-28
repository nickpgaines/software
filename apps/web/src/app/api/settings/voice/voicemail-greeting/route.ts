import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { getVoiceSettings, setVoicemailGreeting } from "@/lib/voice";

export const dynamic = "force-dynamic";

// Cap upload size at roughly 2 MB after base64 encoding (~1.5 MB raw audio).
// Voicemail greetings are typically 10-15 seconds of speech; this is plenty.
const MAX_DATA_URL_LENGTH = 2 * 1024 * 1024;

export async function GET() {
  const companyId = await requireCompanyId();
  const settings = await getVoiceSettings(companyId);
  return NextResponse.json({
    has_greeting: !!settings.voice_voicemail_greeting_data_url,
    greeting: settings.voice_voicemail_greeting_data_url,
  });
}

export async function PUT(req: Request) {
  try {
    const companyId = await requireCompanyId();
    const body = (await req.json().catch(() => ({}))) as { greeting?: unknown };
    const greeting = typeof body.greeting === "string" ? body.greeting : "";
    if (!greeting) {
      return NextResponse.json(
        { error: "Greeting audio is required" },
        { status: 400 }
      );
    }
    if (!greeting.startsWith("data:audio/")) {
      return NextResponse.json(
        { error: "Greeting must be an audio data URL" },
        { status: 400 }
      );
    }
    if (greeting.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json(
        { error: "Greeting is too large (max ~2 MB)" },
        { status: 400 }
      );
    }
    await setVoicemailGreeting({ companyId, dataUrl: greeting });
    return NextResponse.json({ has_greeting: true });
  } catch (e) {
    return NextResponse.json(
      { error: `Save failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const companyId = await requireCompanyId();
    await setVoicemailGreeting({ companyId, dataUrl: null });
    return NextResponse.json({ has_greeting: false });
  } catch (e) {
    return NextResponse.json(
      { error: `Remove failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
