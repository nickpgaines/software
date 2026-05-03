import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { getCompanyVoiceStatus, setRecordCallsFlag } from "@/lib/voice";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

export async function GET() {
  const companyId = await requireCompanyId();
  const status = await getCompanyVoiceStatus(companyId);
  return NextResponse.json(
    {
      platform_configured: status.platform_configured,
      configured: status.platform_configured && status.has_number,
      has_business_number: status.has_number,
      business_number: status.primary_number,
      record_calls: status.record_calls,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

// The only per-company voice toggle is whether to record calls. Credentials
// (API key, TwiML app) are platform env vars now.
export async function PUT(req: Request) {
  const companyId = await requireCompanyId();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    record_calls: boolean;
  }>;
  if (typeof body.record_calls !== "boolean") {
    return NextResponse.json(
      { error: "record_calls (boolean) is required" },
      { status: 400 }
    );
  }
  await setRecordCallsFlag({ companyId, record: body.record_calls });
  const status = await getCompanyVoiceStatus(companyId);
  return NextResponse.json(
    {
      platform_configured: status.platform_configured,
      configured: status.platform_configured && status.has_number,
      has_business_number: status.has_number,
      business_number: status.primary_number,
      record_calls: status.record_calls,
    },
    { headers: NO_CACHE_HEADERS }
  );
}
