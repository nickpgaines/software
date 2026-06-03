import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  parseScopeString,
  randomOpaqueToken,
  sha256Hex,
} from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

// User clicked Allow / Cancel on the /oauth/authorize consent screen.
// Issues a short-lived authorization code bound to this user's
// (company_id, staff_id) and the presented PKCE challenge. Returns the
// redirect_uri the browser should navigate to (with ?code= or ?error=).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const decision = body.decision === "deny" ? "deny" : "allow";
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const redirectUri =
    typeof body.redirect_uri === "string" ? body.redirect_uri : "";
  const state = typeof body.state === "string" ? body.state : "";
  const codeChallenge =
    typeof body.code_challenge === "string" ? body.code_challenge : "";
  const codeChallengeMethod =
    typeof body.code_challenge_method === "string"
      ? body.code_challenge_method
      : "S256";
  const scopeRaw = typeof body.scope === "string" ? body.scope : "";

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ctx = await getSessionContext();
  if (!ctx || ctx.staffId == null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = await getDb();
  const client = await db
    .prepare(
      "SELECT redirect_uris FROM mcp_oauth_clients WHERE client_id = ? LIMIT 1"
    )
    .get<{ redirect_uris: string }>(clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }
  let allowed: string[] = [];
  try {
    allowed = JSON.parse(client.redirect_uris) as string[];
  } catch {
    allowed = [];
  }
  if (!allowed.includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri" },
      { status: 400 }
    );
  }

  if (decision === "deny") {
    const u = new URL(redirectUri);
    u.searchParams.set("error", "access_denied");
    if (state) u.searchParams.set("state", state);
    return NextResponse.json({ redirect_to: u.toString() });
  }

  if (!codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const grantedScopes = parseScopeString(scopeRaw).join(" ");

  const code = randomOpaqueToken(32);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO mcp_auth_codes
         (code_hash, client_id, company_id, staff_id, redirect_uri,
          code_challenge, code_challenge_method, scope, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sha256Hex(code),
      clientId,
      ctx.companyId,
      ctx.staffId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      grantedScopes,
      expiresAt
    );

  const u = new URL(redirectUri);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  return NextResponse.json({ redirect_to: u.toString() });
}
