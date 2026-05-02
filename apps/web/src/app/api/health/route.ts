import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Liveness + DB connectivity probe for uptime monitors. Public on purpose so
// monitors don't need to authenticate. Only reports a boolean and a short
// reason string — no internal details that could help an attacker fingerprint
// the deployment.
export async function GET() {
  try {
    const db = await getDb();
    await db.prepare("SELECT 1 AS ok").get();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json(
      { status: "degraded", reason: "database_unreachable" },
      { status: 503 }
    );
  }
}
