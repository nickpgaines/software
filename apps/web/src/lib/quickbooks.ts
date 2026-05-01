import "server-only";
import { getDb, type Company } from "./db";

const SCOPE = "com.intuit.quickbooks.accounting";
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL =
  "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export type QuickbooksEnvironment = "sandbox" | "production";

export function getQuickbooksEnvironment(): QuickbooksEnvironment {
  const env = process.env.QUICKBOOKS_ENVIRONMENT?.trim().toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

export function isQuickbooksConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
      process.env.QUICKBOOKS_CLIENT_SECRET?.trim()
  );
}

export function quickbooksApiBase(env: QuickbooksEnvironment): string {
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function buildAuthorizeUrl(
  redirectUri: string,
  state: string
): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
};

function basicAuthHeader(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID!.trim();
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET!.trim();
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `QuickBooks token exchange failed (${res.status}): ${text}`
    );
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshTokens(
  refreshToken: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `QuickBooks token refresh failed (${res.status}): ${text}`
    );
  }
  return (await res.json()) as TokenResponse;
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(),
    },
    body: JSON.stringify({ token }),
  });
}

export async function getQuickbooksCompany(): Promise<Company> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = 1")
    .get()) as Company | undefined;
  if (!row) throw new Error("Company row not found");
  return row;
}

export async function persistTokens(args: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  environment: QuickbooksEnvironment;
}): Promise<void> {
  const db = await getDb();
  const expiresAt = new Date(
    Date.now() + args.expiresInSeconds * 1000
  ).toISOString();
  await db
    .prepare(
      `UPDATE company
         SET quickbooks_realm_id = ?,
             quickbooks_access_token = ?,
             quickbooks_refresh_token = ?,
             quickbooks_token_expires_at = ?,
             quickbooks_environment = ?,
             quickbooks_connected_at = COALESCE(quickbooks_connected_at, datetime('now')),
             updated_at = datetime('now')
       WHERE id = 1`
    )
    .run(
      args.realmId,
      args.accessToken,
      args.refreshToken,
      expiresAt,
      args.environment
    );
}

export async function clearQuickbooksConnection(): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE company
         SET quickbooks_realm_id = NULL,
             quickbooks_access_token = NULL,
             quickbooks_refresh_token = NULL,
             quickbooks_token_expires_at = NULL,
             quickbooks_environment = NULL,
             quickbooks_company_name = NULL,
             quickbooks_connected_at = NULL,
             updated_at = datetime('now')
       WHERE id = 1`
    )
    .run();
}

export async function fetchCompanyInfo(
  realmId: string,
  accessToken: string,
  environment: QuickbooksEnvironment
): Promise<{ companyName: string | null }> {
  const url = `${quickbooksApiBase(environment)}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=70`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return { companyName: null };
  const data = (await res.json()) as {
    CompanyInfo?: { CompanyName?: string };
  };
  return { companyName: data.CompanyInfo?.CompanyName ?? null };
}

export async function persistCompanyName(name: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE company
         SET quickbooks_company_name = ?,
             updated_at = datetime('now')
       WHERE id = 1`
    )
    .run(name);
}
