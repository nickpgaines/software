"use client";

import { useEffect, useState } from "react";
import { ConnectorsPanel } from "@/app/(app)/settings/connectors/ConnectorsPanel";

/**
 * Settings → Connectors tab. Surfaces the Claude MCP connector (previously
 * only reachable via the un-linked /settings/connectors route) inside the
 * tabbed Settings UI. The connector URL is this app's own /api/mcp endpoint,
 * derived from the browsing origin.
 */
export default function ConnectorsSettingsPanel() {
  const [connectorUrl, setConnectorUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setConnectorUrl(`${window.location.origin}/api/mcp`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-white">Claude connector</h2>
        <p className="mt-1 text-sm font-bold text-zinc-400">
          Let Claude run your CRM. Paste the URL into Claude as a custom
          connector, then sign in with this account to authorize it. Once
          connected, you can ask Claude to reschedule jobs, text customers, and
          more — right from a Claude chat.
        </p>
      </div>
      {connectorUrl && <ConnectorsPanel connectorUrl={connectorUrl} />}
    </div>
  );
}
