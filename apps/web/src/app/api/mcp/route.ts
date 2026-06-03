import { NextResponse } from "next/server";
import { mcpPublicBaseUrl, resolveBearerToken } from "@/lib/mcp/auth";
import { findTool, MCP_TOOLS } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "forge-mcp", version: "0.1.0" };

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: string | number | null;
  result: T;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
};

function ok<T>(id: string | number | null, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result };
}

function fail(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function unauthorized(req: Request) {
  const base = mcpPublicBaseUrl(req);
  return new NextResponse(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Unauthorized" },
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="forge-mcp", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}

// GET serves a tiny capability hint so a browser visiting /mcp sees something
// useful, and clients that probe via GET can confirm the endpoint exists.
// MCP itself is POST + JSON-RPC; the optional SSE channel for server-initiated
// notifications is not used yet.
export async function GET(req: Request) {
  const base = mcpPublicBaseUrl(req);
  return NextResponse.json({
    server: SERVER_INFO,
    protocolVersion: PROTOCOL_VERSION,
    auth: {
      type: "oauth2",
      authorization_server: base,
      resource_metadata: `${base}/.well-known/oauth-protected-resource`,
    },
    transport: "streamable-http",
    note: "POST JSON-RPC requests to this URL with a Bearer access token.",
  });
}

export async function POST(req: Request) {
  // Auth
  const authHeader = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return unauthorized(req);
  const token = await resolveBearerToken(m[1]);
  if (!token) return unauthorized(req);

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return NextResponse.json(fail(null, -32700, "Parse error"), { status: 400 });
  }

  const handle = async (msg: JsonRpcRequest) => {
    const id = msg.id ?? null;
    try {
      switch (msg.method) {
        case "initialize":
          return ok(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: { listChanged: false },
              logging: {},
            },
            serverInfo: SERVER_INFO,
            instructions:
              "Forge CRM connector. Tools let you read jobs/customers/invoices, reschedule jobs, and send SMS/email to customers. All actions are scoped to the signed-in user's company.",
          });

        case "notifications/initialized":
        case "notifications/cancelled":
          return null; // notification — no response

        case "ping":
          return ok(id, {});

        case "tools/list":
          return ok(id, {
            tools: MCP_TOOLS.filter((t) =>
              token.scopes.includes(t.requiredScope)
            ).map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          });

        case "tools/call": {
          const name = (msg.params?.name as string) ?? "";
          const args =
            (msg.params?.arguments as Record<string, unknown>) ?? {};
          const tool = findTool(name);
          if (!tool) {
            return ok(id, {
              isError: true,
              content: [
                { type: "text", text: `Unknown tool: ${name}` },
              ],
            });
          }
          if (!token.scopes.includes(tool.requiredScope)) {
            return ok(id, {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `This connector was not granted the '${tool.requiredScope}' scope. Reconnect in Claude and approve it to use this tool.`,
                },
              ],
            });
          }
          try {
            const result = await tool.handler(args, {
              companyId: token.companyId,
              staffId: token.staffId,
              scopes: token.scopes,
            });
            return ok(id, {
              content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
              ],
              structuredContent: result,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return ok(id, {
              isError: true,
              content: [{ type: "text", text: message }],
            });
          }
        }

        case "prompts/list":
          return ok(id, { prompts: [] });
        case "resources/list":
          return ok(id, { resources: [] });
        case "resources/templates/list":
          return ok(id, { resourceTemplates: [] });

        default:
          return fail(id, -32601, `Method not found: ${msg.method}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return fail(id, -32603, message);
    }
  };

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(handle))).filter(
      (r) => r !== null
    );
    return NextResponse.json(responses);
  }
  const response = await handle(body);
  if (response === null) {
    // Pure notification — MCP spec says respond 202 with empty body.
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(response);
}

// CORS preflight from Claude.ai's web client.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
      "Access-Control-Max-Age": "86400",
    },
  });
}
