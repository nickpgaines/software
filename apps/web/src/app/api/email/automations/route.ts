import { NextResponse } from "next/server";
import { getDb, type EmailAutomation } from "@/lib/db";

export const dynamic = "force-dynamic";

const KIND_ORDER: Record<string, number> = { welcome: 0, seasonal: 1 };
const SEASON_ORDER: Record<string, number> = {
  spring: 0,
  summer: 1,
  fall: 2,
  winter: 3,
};

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM email_automations`)
    .all()) as EmailAutomation[];
  rows.sort((a, b) => {
    const k = (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99);
    if (k !== 0) return k;
    const sA = a.season ? SEASON_ORDER[a.season] ?? 99 : 99;
    const sB = b.season ? SEASON_ORDER[b.season] ?? 99 : 99;
    if (sA !== sB) return sA - sB;
    return a.id - b.id;
  });
  return NextResponse.json(rows);
}
