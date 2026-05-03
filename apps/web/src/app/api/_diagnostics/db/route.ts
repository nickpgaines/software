import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

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

  const companyId = await requireCompanyId();
  const db = await getDb();

  const total = (await db
    .prepare("SELECT COUNT(*) AS n FROM customers WHERE company_id = ?")
    .get<{ n: number }>(companyId))!;
  const withCoords = (await db
    .prepare(
      "SELECT COUNT(*) AS n FROM customers WHERE company_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL"
    )
    .get<{ n: number }>(companyId))!;
  const sample = await db
    .prepare(
      "SELECT id, first_name, last_name, address_line1, latitude, longitude, is_recurring FROM customers WHERE company_id = ? ORDER BY id LIMIT 20"
    )
    .all(companyId);
  const cols = await db
    .prepare("PRAGMA table_info(customers)")
    .all<{ name: string; type: string; notnull: number }>();

  let messagingSettingsExists = false;
  let messagingRows: Array<{
    id: number | null;
    has_account_sid: boolean;
    account_sid_prefix: string | null;
    has_auth_token: boolean;
    auth_token_length: number;
    from_number: string | null;
    updated_at: string | null;
  }> = [];
  let messagingError: string | null = null;
  try {
    const tbl = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messaging_settings'"
      )
      .get<{ name: string }>();
    messagingSettingsExists = !!tbl;
    if (tbl) {
      const rows = await db
        .prepare(
          "SELECT id, account_sid, auth_token, from_number, updated_at FROM messaging_settings WHERE company_id = ?"
        )
        .all<{
          id: number | null;
          account_sid: string | null;
          auth_token: string | null;
          from_number: string | null;
          updated_at: string | null;
        }>(companyId);
      messagingRows = rows.map((r) => ({
        id: r.id,
        has_account_sid: !!r.account_sid,
        account_sid_prefix: r.account_sid ? r.account_sid.slice(0, 4) : null,
        has_auth_token: !!r.auth_token,
        auth_token_length: r.auth_token?.length ?? 0,
        from_number: r.from_number,
        updated_at: r.updated_at,
      }));
    }
  } catch (e) {
    messagingError = (e as Error).message;
  }

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
    messaging_settings_table_exists: messagingSettingsExists,
    messaging_settings_rows: messagingRows,
    messaging_settings_error: messagingError,
  });
}
