import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { getCompanyMessagingStatus } from "@/lib/sms";
import { listCompanyNumbers } from "@/lib/phoneNumbers";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

// Read-only status endpoint. Credentials are now platform-owned (env-based)
// and per-company numbers are managed via /api/phone-numbers.
export async function GET() {
  const companyId = await requireCompanyId();
  const status = await getCompanyMessagingStatus(companyId);
  const numbers = await listCompanyNumbers(companyId);
  return NextResponse.json(
    {
      provider: "twilio",
      platform_configured: status.platform_configured,
      configured: status.platform_configured && status.has_number,
      from_number: status.primary_number,
      numbers: numbers.map((n) => ({
        id: n.id,
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        is_primary: n.is_primary === 1,
        capabilities_voice: n.capabilities_voice === 1,
        capabilities_sms: n.capabilities_sms === 1,
        purchased_at: n.purchased_at,
      })),
    },
    { headers: NO_CACHE_HEADERS }
  );
}
