import { NextResponse } from "next/server";
import { MCP_SCOPES, mcpPublicBaseUrl } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

// RFC 8414 OAuth 2.0 Authorization Server Metadata. Claude.ai fetches this
// after the user pastes the connector URL to discover the authorize/token
// endpoints and supported features (PKCE, dynamic client registration).
export async function GET(req: Request) {
  const base = mcpPublicBaseUrl(req);
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    revocation_endpoint: `${base}/api/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: [...MCP_SCOPES],
  });
}
