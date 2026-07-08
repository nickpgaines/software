"use client";

import { ConnectorsPanel } from "@/app/(app)/settings/connectors/ConnectorsPanel";

/**
 * Settings → Connectors tab. Surfaces the Claude MCP connector (previously
 * only reachable via the un-linked /settings/connectors route) inside the
 * tabbed Settings UI. The connector URL is this app's own /api/mcp endpoint,
 * derived server-side (MCP_PUBLIC_BASE_URL, else the request host) and passed
 * in as a prop so it matches the MCP server's advertised OAuth metadata even
 * in the Capacitor native shell.
 */
export default function ConnectorsSettingsPanel({
  connectorUrl,
}: {
  connectorUrl: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-white tracking-tight">
          Claude connector
        </h2>
        <p className="mt-1 text-sm font-bold text-zinc-400">
          Let Claude run your CRM right from a chat.
        </p>
      </div>
      <ConnectorsPanel connectorUrl={connectorUrl} />
    </div>
  );
}
