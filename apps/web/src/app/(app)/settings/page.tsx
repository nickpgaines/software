import { headers } from "next/headers";
import SettingsTabs from "@/components/SettingsTabs";
import { getSessionUser } from "@/lib/auth";
import { loadMe } from "@/lib/me";

export const dynamic = "force-dynamic";

// Canonical connector URL derivation: prefer MCP_PUBLIC_BASE_URL, fall back to
// the request host. Kept in sync with src/app/(app)/settings/connectors/page.tsx
// and mcpPublicBaseUrl() in src/lib/mcp/auth.ts. Computed server-side so the
// Capacitor native shell (where window.location.origin is the bundle origin)
// still advertises the correct MCP OAuth metadata host.
function connectorMcpUrl(): string {
  const env = process.env.MCP_PUBLIC_BASE_URL?.trim();
  const base = env
    ? env.replace(/\/$/, "")
    : (() => {
        const h = headers();
        const host = h.get("host") ?? "localhost";
        const proto = h.get("x-forwarded-proto") ?? "https";
        return `${proto}://${host}`;
      })();
  return `${base}/api/mcp`;
}

export default async function SettingsPage() {
  const user = getSessionUser() || "";
  // Seed the profile panel server-side so the form doesn't render a
  // "Loading…" placeholder while it client-fetches /api/me.
  const me = await loadMe();
  const connectorUrl = connectorMcpUrl();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title text-white">Settings</h1>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Manage your team, profile, company details, and billing.
        </p>
      </div>
      <SettingsTabs
        username={user}
        initialMe={me}
        connectorUrl={connectorUrl}
      />
    </div>
  );
}
