import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { createVoiceAccessToken, getVoiceSettings, isVoiceConfigured } from "@/lib/voice";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const settings = await getVoiceSettings(ctx.companyId);
  if (!isVoiceConfigured(settings)) {
    return NextResponse.json(
      { error: "Voice is not configured. Connect Twilio Voice in Settings → Calling." },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }
  // Identity must be a stable, URL-safe string. Sanitize the session user.
  const identity = ctx.identity.replace(/[^a-zA-Z0-9_.-]/g, "_") || "user";
  try {
    const token = createVoiceAccessToken({ settings, identity });
    return NextResponse.json(
      { token, identity, ttl: 3600 },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Could not issue token" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
