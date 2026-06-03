import crypto from "node:crypto";
import { getDb } from "@/lib/db";

// All MCP scopes the connector exposes. Claude requests these during the
// authorize step; the user can deselect on the consent screen.
export const MCP_SCOPES = ["crm.read", "crm.write", "crm.messaging"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export function isKnownScope(s: string): s is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(s);
}

export function parseScopeString(s: string | null | undefined): McpScope[] {
  if (!s) return [];
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(isKnownScope);
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// RFC 7636 PKCE: client sends code_challenge during authorize; on token
// exchange they prove they hold the original code_verifier by hashing it
// the same way and comparing.
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: string
): boolean {
  if (method === "plain") {
    return crypto.timingSafeEqual(
      Buffer.from(verifier),
      Buffer.from(challenge)
    );
  }
  if (method === "S256") {
    const expected = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    if (expected.length !== challenge.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(challenge)
    );
  }
  return false;
}

export type ResolvedToken = {
  tokenId: number;
  companyId: number;
  staffId: number | null;
  clientId: string;
  scopes: McpScope[];
};

// Look up a presented bearer token. Returns null when the token is unknown,
// expired, or revoked. Touches last_used_at on success (best-effort — failure
// doesn't reject the request).
export async function resolveBearerToken(
  bearer: string
): Promise<ResolvedToken | null> {
  if (!bearer) return null;
  const hash = sha256Hex(bearer);
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT id, client_id, company_id, staff_id, scope, expires_at, revoked_at
         FROM mcp_access_tokens WHERE token_hash = ? LIMIT 1`
    )
    .get<{
      id: number;
      client_id: string;
      company_id: number;
      staff_id: number | null;
      scope: string;
      expires_at: string;
      revoked_at: string | null;
    }>(hash);
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  try {
    await db
      .prepare(
        `UPDATE mcp_access_tokens SET last_used_at = datetime('now') WHERE id = ?`
      )
      .run(row.id);
  } catch {
    // best-effort
  }
  return {
    tokenId: row.id,
    companyId: row.company_id,
    staffId: row.staff_id,
    clientId: row.client_id,
    scopes: parseScopeString(row.scope),
  };
}

// Public base URL the connector advertises in OAuth metadata. Lets us flip
// from path-based (forged.4crm.app/mcp) to a dedicated subdomain
// (mcp.4crm.app) by changing an env var.
export function mcpPublicBaseUrl(req: Request): string {
  const env = process.env.MCP_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
