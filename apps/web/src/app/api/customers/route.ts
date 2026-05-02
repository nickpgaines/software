import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { normalizeAddress } from "@/lib/customer-address";
import { buildOriginFromRequest, sendWelcomeToCustomer } from "@/lib/email";

export const dynamic = "force-dynamic";

function buildName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM customers WHERE company_id = ? ORDER BY first_name COLLATE NOCASE ASC, last_name COLLATE NOCASE ASC"
    )
    .all(companyId)) as Customer[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const companyId = await requireCompanyId();
    const db = await getDb();
    const body = (await req.json().catch(() => ({}))) as Partial<Customer>;
    const first = (body.first_name || "").trim();
    const last = (body.last_name || "").trim();
    if (!first || !last) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }
    const name = buildName(first, last);
    const addr = normalizeAddress(
      {
        address_line1: body.address_line1,
        unit: body.unit,
        city: body.city,
        state: body.state,
        zip: body.zip,
        latitude: body.latitude,
        longitude: body.longitude,
        formatted_address: body.formatted_address,
      },
      { legacyAddress: body.address }
    );
    const stmt = db.prepare(
      `INSERT INTO customers
         (company_id, name, first_name, last_name, phone, email,
          address, address_line1, unit, city, state, zip,
          latitude, longitude, formatted_address, notes)
       VALUES (?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?)`
    );
    const result = await stmt.run(
      companyId,
      name,
      first,
      last,
      body.phone || null,
      body.email || null,
      addr.address,
      addr.address_line1,
      addr.unit,
      addr.city,
      addr.state,
      addr.zip,
      addr.latitude,
      addr.longitude,
      addr.formatted_address,
      body.notes || null
    );
    const created = (await db
      .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
      .get(result.lastInsertRowid, companyId)) as Customer;
    if (created.email && created.email.trim()) {
      const origin = buildOriginFromRequest(req);
      void sendWelcomeToCustomer(created.id, companyId, origin).catch((e) => {
        console.error("welcome email failed", e);
      });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("POST /api/customers failed:", e);
    return NextResponse.json(
      { error: `Save failed: ${message}` },
      { status: 500 }
    );
  }
}
