import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Temporary diagnostic for debugging the messaging_settings persistence issue.
// Safe to delete once messaging is confirmed working.
export async function GET() {
  const url = (process.env.TURSO_DATABASE_URL || "").trim();
  let host = "(unparseable)";
  try {
    host = new URL(url).host;
  } catch {
    // ignore
  }

  const db = await getDb();

  let messagingSettingsExists = false;
  let rowCount = 0;
  let rows: Array<{
    id: number | null;
    has_account_sid: boolean;
    account_sid_prefix: string | null;
    has_auth_token: boolean;
    auth_token_length: number;
    from_number: string | null;
    updated_at: string | null;
  }> = [];
  let error: string | null = null;
  try {
    const tbl = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messaging_settings'"
      )
      .get<{ name: string }>();
    messagingSettingsExists = !!tbl;
    if (tbl) {
      const all = await db
        .prepare(
          "SELECT id, account_sid, auth_token, from_number, updated_at FROM messaging_settings"
        )
        .all<{
          id: number | null;
          account_sid: string | null;
          auth_token: string | null;
          from_number: string | null;
          updated_at: string | null;
        }>();
      rowCount = all.length;
      rows = all.map((r) => ({
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
    error = (e as Error).message;
  }

  return NextResponse.json({
    db_host: host,
    messaging_settings_table_exists: messagingSettingsExists,
    messaging_settings_row_count: rowCount,
    messaging_settings_rows: rows,
    messaging_settings_error: error,
  });
}
