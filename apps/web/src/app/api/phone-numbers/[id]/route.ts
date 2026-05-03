import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import {
  markReleased,
  releaseNumber,
  setPrimaryNumber,
} from "@/lib/phoneNumbers";
import { getDb, type PhoneNumber } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

// PATCH: { is_primary: true } promotes this number to the company's primary
// outbound number.
export async function PATCH(
  req: Request,
  ctx: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const id = Number(ctx.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    is_primary: boolean;
  }>;
  if (body.is_primary === true) {
    await setPrimaryNumber({ companyId, phoneNumberId: id });
  }
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM phone_numbers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as PhoneNumber | undefined;
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      id: row.id,
      phone_number: row.phone_number,
      twilio_sid: row.twilio_sid,
      is_primary: row.is_primary === 1,
      status: row.status,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

// Release the number back to Twilio and mark it released locally.
export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const id = Number(ctx.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT * FROM phone_numbers WHERE id = ? AND company_id = ? AND status = 'active'`
    )
    .get(id, companyId)) as PhoneNumber | undefined;
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await releaseNumber(row.twilio_sid);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Twilio release failed" },
      { status: 502 }
    );
  }
  await markReleased({ companyId, phoneNumberId: id });
  return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS });
}
