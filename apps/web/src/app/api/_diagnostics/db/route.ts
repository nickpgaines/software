import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Read-only diagnostic. Routes here go through the SAME lib/db.ts code path
// the rest of the app uses, so the URL/counts reported here are exactly what
// /api/map/customer-pins sees. Compare against `npm run db:doctor` to spot
// env-config drift.
export async function GET() {
  const url = (process.env.TURSO_DATABASE_URL || "").trim();
  const tok = (process.env.TURSO_AUTH_TOKEN || "").trim();
  let host = "(unparseable)";
  try {
    host = new URL(url).host;
  } catch {
    // ignore
  }

  const db = await getDb();

  const total = (await db
    .prepare("SELECT COUNT(*) AS n FROM customers")
    .get<{ n: number }>())!;
  const withCoords = (await db
    .prepare(
      "SELECT COUNT(*) AS n FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    )
    .get<{ n: number }>())!;
  const sample = await db
    .prepare(
      "SELECT id, first_name, last_name, address_line1, latitude, longitude, is_recurring FROM customers ORDER BY id LIMIT 20"
    )
    .all();
  const cols = await db
    .prepare("PRAGMA table_info(customers)")
    .all<{ name: string; type: string; notnull: number }>();

  return NextResponse.json({
    env: {
      TURSO_DATABASE_URL_host: host,
      TURSO_DATABASE_URL_length: url.length,
      TURSO_AUTH_TOKEN_prefix: tok.slice(0, 6),
      TURSO_AUTH_TOKEN_length: tok.length,
    },
    customers_total: total.n,
    customers_with_lat_and_lng: withCoords.n,
    customers_schema: cols.map((c) => `${c.name}:${c.type}${c.notnull ? " NN" : ""}`),
    customers_sample: sample,
  });
}
