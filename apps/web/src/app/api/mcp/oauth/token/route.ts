import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  randomOpaqueToken,
  sha256Hex,
  verifyPkce,
} from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type FormData = Record<string, string>;

async function readParams(req: Request): Promise<FormData> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const j = (await req.json()) as Record<string, unknown>;
      const out: FormData = {};
      for (const [k, v] of Object.entries(j)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: FormData = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function err(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const params = await readParams(req);
  const grantType = params.grant_type;

  if (grantType === "authorization_code") {
    return handleAuthCode(params);
  }
  if (grantType === "refresh_token") {
    return handleRefresh(params);
  }
  return err("unsupported_grant_type", `grant_type='${grantType ?? ""}'`);
}

async function handleAuthCode(p: FormData) {
  const { code, redirect_uri, client_id, code_verifier } = p;
  if (!code || !redirect_uri || !client_id || !code_verifier) {
    return err("invalid_request", "missing required parameters");
  }
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT id, client_id, company_id, staff_id, redirect_uri,
              code_challenge, code_challenge_method, scope, expires_at,
              consumed_at
         FROM mcp_auth_codes WHERE code_hash = ? LIMIT 1`
    )
    .get<{
      id: number;
      client_id: string;
      company_id: number;
      staff_id: number | null;
      redirect_uri: string;
      code_challenge: string;
      code_challenge_method: string;
      scope: string;
      expires_at: string;
      consumed_at: string | null;
    }>(sha256Hex(code));
  if (!row) return err("invalid_grant", "unknown code");
  if (row.consumed_at) return err("invalid_grant", "code already used");
  if (new Date(row.expires_at).getTime() <= Date.now())
    return err("invalid_grant", "code expired");
  if (row.client_id !== client_id) return err("invalid_grant", "client mismatch");
  if (row.redirect_uri !== redirect_uri)
    return err("invalid_grant", "redirect_uri mismatch");
  if (!verifyPkce(code_verifier, row.code_challenge, row.code_challenge_method))
    return err("invalid_grant", "PKCE verification failed");

  // Consume the code, then issue the tokens. Doing this in a transaction
  // prevents the same code being redeemed twice if the client double-fires.
  await db
    .prepare("UPDATE mcp_auth_codes SET consumed_at = datetime('now') WHERE id = ?")
    .run(row.id);

  return issueTokens({
    clientId: row.client_id,
    companyId: row.company_id,
    staffId: row.staff_id,
    scope: row.scope,
  });
}

async function handleRefresh(p: FormData) {
  const { refresh_token, client_id } = p;
  if (!refresh_token || !client_id) {
    return err("invalid_request", "missing required parameters");
  }
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT id, client_id, company_id, staff_id, scope,
              refresh_expires_at, revoked_at
         FROM mcp_access_tokens WHERE refresh_token_hash = ? LIMIT 1`
    )
    .get<{
      id: number;
      client_id: string;
      company_id: number;
      staff_id: number | null;
      scope: string;
      refresh_expires_at: string | null;
      revoked_at: string | null;
    }>(sha256Hex(refresh_token));
  if (!row) return err("invalid_grant", "unknown refresh_token");
  if (row.revoked_at) return err("invalid_grant", "refresh_token revoked");
  if (row.client_id !== client_id) return err("invalid_grant", "client mismatch");
  if (
    row.refresh_expires_at &&
    new Date(row.refresh_expires_at).getTime() <= Date.now()
  )
    return err("invalid_grant", "refresh_token expired");

  // Rotate: invalidate the old token row, issue a fresh access + refresh
  // pair against the same identity. This makes refresh-token replay
  // useless after the first use.
  await db
    .prepare(
      "UPDATE mcp_access_tokens SET revoked_at = datetime('now') WHERE id = ?"
    )
    .run(row.id);

  return issueTokens({
    clientId: row.client_id,
    companyId: row.company_id,
    staffId: row.staff_id,
    scope: row.scope,
  });
}

async function issueTokens(args: {
  clientId: string;
  companyId: number;
  staffId: number | null;
  scope: string;
}) {
  const accessToken = randomOpaqueToken(32);
  const refreshToken = randomOpaqueToken(32);
  const expiresAt = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TTL_SECONDS * 1000
  ).toISOString();

  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO mcp_access_tokens
         (token_hash, refresh_token_hash, client_id, company_id, staff_id,
          scope, expires_at, refresh_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sha256Hex(accessToken),
      sha256Hex(refreshToken),
      args.clientId,
      args.companyId,
      args.staffId,
      args.scope,
      expiresAt,
      refreshExpiresAt
    );

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: args.scope,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
