import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import {
  listCompanyNumbers,
  purchaseNumber,
  recordPurchasedNumber,
} from "@/lib/phoneNumbers";
import { publicBaseUrlFromRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

export async function GET() {
  const companyId = await requireCompanyId();
  const numbers = await listCompanyNumbers(companyId);
  return NextResponse.json(
    numbers.map((n) => ({
      id: n.id,
      phone_number: n.phone_number,
      twilio_sid: n.twilio_sid,
      friendly_name: n.friendly_name,
      capabilities_voice: n.capabilities_voice === 1,
      capabilities_sms: n.capabilities_sms === 1,
      is_primary: n.is_primary === 1,
      status: n.status,
      purchased_at: n.purchased_at,
    })),
    { headers: NO_CACHE_HEADERS }
  );
}

// Buy a number from the platform's master Twilio account and assign it to
// the caller's company. Body: { phone_number: "+18435551234", friendly_name? }
export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    phone_number: string;
    friendly_name: string;
  }>;
  const phoneNumber = (body.phone_number || "").trim();
  if (!/^\+\d{8,15}$/.test(phoneNumber)) {
    return NextResponse.json(
      { error: "phone_number must be E.164 (e.g. +18435551234)" },
      { status: 400 }
    );
  }

  let purchase;
  try {
    purchase = await purchaseNumber({
      phoneNumber,
      baseUrl: publicBaseUrlFromRequest(req),
      friendlyName: body.friendly_name,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Could not purchase number" },
      { status: 502 }
    );
  }

  const row = await recordPurchasedNumber({ companyId, purchase });
  return NextResponse.json(
    {
      id: row.id,
      phone_number: row.phone_number,
      twilio_sid: row.twilio_sid,
      friendly_name: row.friendly_name,
      capabilities_voice: row.capabilities_voice === 1,
      capabilities_sms: row.capabilities_sms === 1,
      is_primary: row.is_primary === 1,
      status: row.status,
      purchased_at: row.purchased_at,
    },
    { status: 201, headers: NO_CACHE_HEADERS }
  );
}
