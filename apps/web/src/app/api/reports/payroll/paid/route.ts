import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { staff_id, role, paid, range } = (body || {}) as {
    staff_id?: number;
    role?: "sales" | "tech";
    paid?: boolean;
    range?: string;
  };
  if (typeof staff_id !== "number" || !Number.isFinite(staff_id)) {
    return NextResponse.json({ error: "staff_id required" }, { status: 400 });
  }
  if (role !== "sales" && role !== "tech") {
    return NextResponse.json({ error: "role must be sales|tech" }, { status: 400 });
  }
  if (typeof paid !== "boolean") {
    return NextResponse.json({ error: "paid must be boolean" }, { status: 400 });
  }

  const { start, end } = resolveReportRange(range);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const companyId = await requireCompanyId();
  const db = await getDb();
  // Confirm the staff member belongs to this tenant before recording.
  const staff = await db
    .prepare("SELECT id FROM staff WHERE id = ? AND company_id = ?")
    .get(staff_id, companyId);
  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }
  if (paid) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO payroll_payouts
           (company_id, staff_id, role, period_start, period_end)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(companyId, staff_id, role, startIso, endIso);
  } else {
    await db
      .prepare(
        `DELETE FROM payroll_payouts
           WHERE company_id = ?
             AND staff_id = ? AND role = ?
             AND period_start = ? AND period_end = ?`
      )
      .run(companyId, staff_id, role, startIso, endIso);
  }
  return NextResponse.json({ ok: true });
}
