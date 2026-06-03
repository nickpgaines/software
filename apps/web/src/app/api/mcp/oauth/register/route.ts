import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomOpaqueToken, sha256Hex } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

// RFC 7591 Dynamic Client Registration. Claude.ai POSTs here the first time
// any user adds the connector URL to register itself, then reuses the
// returned client_id forever. We accept public clients (no secret, PKCE
// required) which is the standard model for IdP-less app integrations.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "invalid JSON" },
      { status: 400 }
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.length > 0
      )
    : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_client_metadata",
        error_description: "redirect_uris is required",
      },
      { status: 400 }
    );
  }

  const clientName =
    typeof body.client_name === "string" && body.client_name.length > 0
      ? body.client_name.slice(0, 200)
      : "Claude";

  // Public clients use token_endpoint_auth_method=none + PKCE. If the
  // registrant explicitly asks for a confidential client we issue a secret.
  const authMethod =
    body.token_endpoint_auth_method === "client_secret_post"
      ? "client_secret_post"
      : "none";

  const clientId = `mcp_${randomOpaqueToken(18)}`;
  let clientSecret: string | null = null;
  let secretHash: string | null = null;
  if (authMethod === "client_secret_post") {
    clientSecret = randomOpaqueToken(32);
    secretHash = sha256Hex(clientSecret);
  }

  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO mcp_oauth_clients
         (client_id, client_secret_hash, client_name, redirect_uris,
          grant_types, token_endpoint_auth_method)
         VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      clientId,
      secretHash,
      clientName,
      JSON.stringify(redirectUris),
      "authorization_code,refresh_token",
      authMethod
    );

  const out: Record<string, unknown> = {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: authMethod,
  };
  if (clientSecret) out.client_secret = clientSecret;

  return NextResponse.json(out, { status: 201 });
}
