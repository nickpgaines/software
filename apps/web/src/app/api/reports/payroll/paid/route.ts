import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";

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

  const db = await getDb();
  if (paid) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO payroll_payouts
           (staff_id, role, period_start, period_end)
         VALUES (?, ?, ?, ?)`
      )
      .run(staff_id, role, startIso, endIso);
  } else {
    await db
      .prepare(
        `DELETE FROM payroll_payouts
           WHERE staff_id = ? AND role = ?
             AND period_start = ? AND period_end = ?`
      )
      .run(staff_id, role, startIso, endIso);
  }
  return NextResponse.json({ ok: true });
}
