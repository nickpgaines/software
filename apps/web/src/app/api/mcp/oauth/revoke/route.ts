import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sha256Hex } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

// RFC 7009 token revocation. Per spec we always return 200 even if the
// token is unknown to avoid leaking whether a value was a real token.
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let token = "";
  let hint = "";
  if (ct.includes("application/json")) {
    try {
      const j = (await req.json()) as Record<string, unknown>;
      if (typeof j.token === "string") token = j.token;
      if (typeof j.token_type_hint === "string") hint = j.token_type_hint;
    } catch {
      // ignore
    }
  } else {
    const text = await req.text();
    const params = new URLSearchParams(text);
    token = params.get("token") ?? "";
    hint = params.get("token_type_hint") ?? "";
  }
  if (!token) return NextResponse.json({}, { status: 200 });

  const hash = sha256Hex(token);
  const db = await getDb();
  const column =
    hint === "refresh_token" ? "refresh_token_hash" : "token_hash";

  await db
    .prepare(
      `UPDATE mcp_access_tokens SET revoked_at = datetime('now')
         WHERE ${column} = ? AND revoked_at IS NULL`
    )
    .run(hash);
  // If the hint was wrong, try the other column too.
  const other =
    column === "token_hash" ? "refresh_token_hash" : "token_hash";
  await db
    .prepare(
      `UPDATE mcp_access_tokens SET revoked_at = datetime('now')
         WHERE ${other} = ? AND revoked_at IS NULL`
    )
    .run(hash);

  return NextResponse.json({}, { status: 200 });
}
