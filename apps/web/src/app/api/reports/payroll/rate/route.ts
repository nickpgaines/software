import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { staff_id, role, rate } = (body || {}) as {
    staff_id?: number;
    role?: "sales" | "tech";
    rate?: number;
  };
  if (typeof staff_id !== "number" || !Number.isFinite(staff_id)) {
    return NextResponse.json({ error: "staff_id required" }, { status: 400 });
  }
  if (role !== "sales" && role !== "tech") {
    return NextResponse.json({ error: "role must be sales|tech" }, { status: 400 });
  }
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    return NextResponse.json(
      { error: "rate must be between 0 and 1" },
      { status: 400 }
    );
  }
  const col =
    role === "sales" ? "sales_commission_rate" : "tech_commission_rate";
  const db = await getDb();
  await db.prepare(`UPDATE staff SET ${col} = ? WHERE id = ?`).run(rate, staff_id);
  return NextResponse.json({ ok: true });
}
