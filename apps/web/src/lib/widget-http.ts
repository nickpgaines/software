import type { WidgetPrincipal } from "./widget-auth.ts";
import { isNativeAppUserAgent } from "./native-auth.ts";

export function readWidgetBearer(req: Request) {
  const auth = req.headers.get("authorization");
  return auth?.match(/^Bearer ([A-Za-z0-9_-]{40,128})$/)?.[1] ?? null;
}

export function isWidgetBearerRoute(req: Request) {
  if (!readWidgetBearer(req)) return false;
  const pathname = new URL(req.url).pathname;
  return (
    (req.method === "GET" && pathname === "/api/widget/summary") ||
    (req.method === "DELETE" && pathname === "/api/widget/token")
  );
}

export function isNativeWidgetRequest(req: Request) {
  return isNativeAppUserAgent(req.headers.get("user-agent"));
}

export function validateWidgetInstallationId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[A-Za-z0-9_-]{16,200}$/.test(normalized) ? normalized : null;
}

function unauthorized() {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function handleWidgetSummaryRequest(
  req: Request,
  deps: {
    authenticate(token: string): Promise<WidgetPrincipal | null>;
    buildSummary(principal: WidgetPrincipal): Promise<unknown>;
  }
) {
  const token = readWidgetBearer(req);
  if (!token) return unauthorized();
  const principal = await deps.authenticate(token);
  if (!principal) return unauthorized();
  const summary = await deps.buildSummary(principal);
  return Response.json(summary, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function handleWidgetRevocationRequest(
  req: Request,
  deps: {
    authenticate(token: string): Promise<WidgetPrincipal | null>;
    revoke(token: string): Promise<boolean>;
  }
) {
  const token = readWidgetBearer(req);
  if (!token) return unauthorized();
  const principal = await deps.authenticate(token);
  if (!principal) return unauthorized();
  const revoked = await deps.revoke(token);
  return Response.json(
    { revoked },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
