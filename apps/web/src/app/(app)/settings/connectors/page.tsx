import { headers } from "next/headers";
import { ConnectorsPanel } from "./ConnectorsPanel";

export const dynamic = "force-dynamic";

function publicBaseUrl(): string {
  const env = process.env.MCP_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default function ConnectorsPage() {
  const base = publicBaseUrl();
  const connectorUrl = `${base}/api/mcp`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title text-white">Connectors</h1>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Let Claude run your CRM. Paste the URL below into Claude as a custom
          connector, then sign in with this account to authorize it.
        </p>
      </div>

      <ConnectorsPanel connectorUrl={connectorUrl} />
    </div>
  );
}
