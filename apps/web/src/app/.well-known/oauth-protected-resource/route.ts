import { NextResponse } from "next/server";
import { MCP_SCOPES, mcpPublicBaseUrl } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

// RFC 9728 OAuth 2.0 Protected Resource Metadata. MCP clients use this to
// learn which authorization server protects the /mcp endpoint.
export async function GET(req: Request) {
  const base = mcpPublicBaseUrl(req);
  return NextResponse.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
  });
}
