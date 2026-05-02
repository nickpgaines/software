import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { normalizeAddress } from "@/lib/customer-address";

export const dynamic = "force-dynamic";

function buildName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

function pick<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<Customer>;
  const existing = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Customer | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const first = (body.first_name ?? existing.first_name ?? "").trim();
  const last = (body.last_name ?? existing.last_name ?? "").trim();
  if (!first || !last) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }
  const name = buildName(first, last);

  // Treat any address-related field provided in the request as part of
  // the new structured address. If none of the new fields are present,
  // keep the existing structured address as-is.
  const anyStructuredProvided =
    body.address_line1 !== undefined ||
    body.unit !== undefined ||
    body.city !== undefined ||
    body.state !== undefined ||
    body.zip !== undefined ||
    body.latitude !== undefined ||
    body.longitude !== undefined ||
    body.formatted_address !== undefined ||
    body.address !== undefined;

  const addr = anyStructuredProvided
    ? normalizeAddress(
        {
          address_line1: pick(body.address_line1, existing.address_line1),
          unit: pick(body.unit, existing.unit),
          city: pick(body.city, existing.city),
          state: pick(body.state, existing.state),
          zip: pick(body.zip, existing.zip),
          latitude: pick(body.latitude, existing.latitude),
          longitude: pick(body.longitude, existing.longitude),
          formatted_address: pick(
            body.formatted_address,
            existing.formatted_address
          ),
        },
        { legacyAddress: pick(body.address, existing.address) }
      )
    : {
        address: existing.address,
        address_line1: existing.address_line1,
        unit: existing.unit,
        city: existing.city,
        state: existing.state,
        zip: existing.zip,
        latitude: existing.latitude,
        longitude: existing.longitude,
        formatted_address: existing.formatted_address,
      };

  await db.prepare(
    `UPDATE customers
     SET name = ?, first_name = ?, last_name = ?, phone = ?, email = ?,
         address = ?, address_line1 = ?, unit = ?, city = ?, state = ?, zip = ?,
         latitude = ?, longitude = ?, formatted_address = ?, notes = ?
     WHERE id = ? AND company_id = ?`
  ).run(
    name,
    first,
    last,
    body.phone ?? existing.phone,
    body.email ?? existing.email,
    addr.address,
    addr.address_line1,
    addr.unit,
    addr.city,
    addr.state,
    addr.zip,
    addr.latitude,
    addr.longitude,
    addr.formatted_address,
    body.notes ?? existing.notes,
    id,
    companyId
  );
  const updated = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Customer;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM customers WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return NextResponse.json({ ok: true });
}
