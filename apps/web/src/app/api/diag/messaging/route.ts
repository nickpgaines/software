import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

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

  const companyId = await requireCompanyId();
  const db = await getDb();

  let messagingSettingsExists = false;
  let columns: string[] = [];
  let rowCount = 0;
  let rows: Array<{
    id: number | null;
    has_account_sid: boolean;
    account_sid_prefix: string | null;
    has_auth_token: boolean;
    auth_token_length: number;
    from_number: string | null;
    has_voice_api_key_sid: boolean;
    voice_api_key_sid_prefix: string | null;
    has_voice_api_key_secret: boolean;
    voice_api_key_secret_length: number;
    has_voice_twiml_app_sid: boolean;
    voice_twiml_app_sid_prefix: string | null;
    voice_record_calls: number | null;
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
      const cols = await db
        .prepare("PRAGMA table_info(messaging_settings)")
        .all<{ name: string }>();
      columns = cols.map((c) => c.name);
      const all = (await db
        .prepare("SELECT * FROM messaging_settings WHERE company_id = ?")
        .all(companyId)) as Array<{
        id: number | null;
        account_sid: string | null;
        auth_token: string | null;
        from_number: string | null;
        voice_api_key_sid: string | null;
        voice_api_key_secret: string | null;
        voice_twiml_app_sid: string | null;
        voice_record_calls: number | null;
        updated_at: string | null;
      }>;
      rowCount = all.length;
      rows = all.map((r) => ({
        id: r.id,
        has_account_sid: !!r.account_sid,
        account_sid_prefix: r.account_sid ? r.account_sid.slice(0, 4) : null,
        has_auth_token: !!r.auth_token,
        auth_token_length: r.auth_token?.length ?? 0,
        from_number: r.from_number,
        has_voice_api_key_sid: !!r.voice_api_key_sid,
        voice_api_key_sid_prefix: r.voice_api_key_sid
          ? r.voice_api_key_sid.slice(0, 4)
          : null,
        has_voice_api_key_secret: !!r.voice_api_key_secret,
        voice_api_key_secret_length: r.voice_api_key_secret?.length ?? 0,
        has_voice_twiml_app_sid: !!r.voice_twiml_app_sid,
        voice_twiml_app_sid_prefix: r.voice_twiml_app_sid
          ? r.voice_twiml_app_sid.slice(0, 4)
          : null,
        voice_record_calls: r.voice_record_calls,
        updated_at: r.updated_at,
      }));
    }
  } catch (e) {
    error = (e as Error).message;
  }

  return NextResponse.json({
    db_host: host,
    messaging_settings_table_exists: messagingSettingsExists,
    messaging_settings_columns: columns,
    messaging_settings_row_count: rowCount,
    messaging_settings_rows: rows,
    messaging_settings_error: error,
  });
}
