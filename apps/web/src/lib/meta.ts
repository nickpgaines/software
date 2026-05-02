import crypto from "node:crypto";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "leads_retrieval",
  "ads_management",
];

export type MetaConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  webhookVerifyToken: string;
};

export function getMetaConfig(origin?: string): MetaConfig | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  const redirectUri =
    process.env.META_REDIRECT_URI?.trim() ||
    (origin ? `${origin}/api/integrations/meta/callback` : "");
  const webhookVerifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || "";
  return { appId, appSecret, redirectUri, webhookVerifyToken };
}

export function buildOAuthUrl(cfg: MetaConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: META_OAUTH_SCOPES.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export type TokenExchangeResult = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export async function exchangeCodeForToken(
  cfg: MetaConfig,
  code: string
): Promise<TokenExchangeResult> {
  const params = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });
  const res = await fetch(
    `${GRAPH_BASE}/oauth/access_token?${params.toString()}`
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Meta token exchange failed: ${res.status} ${t}`);
  }
  return (await res.json()) as TokenExchangeResult;
}

export async function exchangeForLongLivedToken(
  cfg: MetaConfig,
  shortLivedToken: string
): Promise<TokenExchangeResult> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(
    `${GRAPH_BASE}/oauth/access_token?${params.toString()}`
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Meta long-lived exchange failed: ${res.status} ${t}`);
  }
  return (await res.json()) as TokenExchangeResult;
}

export type MetaUser = { id: string; name: string };

export async function fetchMetaUser(accessToken: string): Promise<MetaUser> {
  const res = await fetch(
    `${GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) throw new Error(`Meta /me failed: ${res.status}`);
  return (await res.json()) as MetaUser;
}

export type MetaPageSummary = {
  id: string;
  name: string;
  access_token: string;
};

export async function fetchManagedPages(
  userAccessToken: string
): Promise<MetaPageSummary[]> {
  const out: MetaPageSummary[] = [];
  let url:
    | string
    | null = `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(userAccessToken)}`;
  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) throw new Error(`Meta /me/accounts failed: ${res.status}`);
    const json = (await res.json()) as {
      data: MetaPageSummary[];
      paging?: { next?: string };
    };
    out.push(...json.data);
    url = json.paging?.next ?? null;
  }
  return out;
}

export async function subscribePageToLeadgen(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: "leadgen",
    access_token: pageAccessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${pageId}/subscribed_apps`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Page subscribe failed (${pageId}): ${res.status} ${t}`);
  }
}

export async function unsubscribePageFromLeadgen(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const params = new URLSearchParams({ access_token: pageAccessToken });
  await fetch(
    `${GRAPH_BASE}/${pageId}/subscribed_apps?${params.toString()}`,
    { method: "DELETE" }
  );
}

export type MetaLeadField = { name: string; values: string[] };

export type MetaLeadDetail = {
  id: string;
  created_time: string;
  ad_id?: string;
  form_id?: string;
  field_data: MetaLeadField[];
};

export async function fetchLeadDetail(
  leadgenId: string,
  pageAccessToken: string
): Promise<MetaLeadDetail> {
  const params = new URLSearchParams({
    access_token: pageAccessToken,
    fields: "id,created_time,ad_id,form_id,field_data",
  });
  const res = await fetch(`${GRAPH_BASE}/${leadgenId}?${params.toString()}`);
  if (!res.ok) throw new Error(`Lead fetch failed: ${res.status}`);
  return (await res.json()) as MetaLeadDetail;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(parts[1], "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function fieldValue(
  fields: MetaLeadField[],
  ...names: string[]
): string | null {
  for (const f of fields) {
    if (names.includes(f.name) && f.values.length > 0) {
      return f.values[0];
    }
  }
  return null;
}
