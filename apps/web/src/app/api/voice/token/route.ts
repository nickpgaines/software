import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { createVoiceAccessToken, getCompanyVoiceStatus } from "@/lib/voice";

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
  const status = await getCompanyVoiceStatus(ctx.companyId);
  if (!status.platform_configured) {
    return NextResponse.json(
      { error: "Voice is not configured. Platform Twilio is missing env vars." },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }
  if (!status.has_number) {
    return NextResponse.json(
      { error: "No phone number assigned. Buy one in Settings → Messaging." },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }
  try {
    const { token, identity } = createVoiceAccessToken({
      companyId: ctx.companyId,
      user: ctx.identity,
    });
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
