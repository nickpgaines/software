"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Connection = {
  id: number;
  client_id: string;
  client_name: string | null;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
};

function fmt(ts: string | null): string {
  if (!ts) return "never";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function ConnectorsPanel({ connectorUrl }: { connectorUrl: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/settings/connectors");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { connections: Connection[] };
      setConnections(j.connections);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(connectorUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function revoke(id: number) {
    if (!confirm("Revoke this connection? Claude will lose access until you reconnect."))
      return;
    const res = await fetch(`/api/settings/connectors?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-white mb-1">
          Connector URL
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          In Claude, go to <strong>Settings → Connectors → Add custom connector</strong> and paste this URL.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-zinc-100 font-mono break-all">
            {connectorUrl}
          </code>
          <Button onClick={copy} variant="default" type="button">
            {copied ? "Copied" : "Copy URL"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-white mb-1">
          Active connections
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Each row is a Claude session you authorized to access this account.
          Revoke any you no longer use.
        </p>
        {err && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 mb-3">
            {err}
          </div>
        )}
        {loading ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : connections.length === 0 ? (
          <div className="text-sm text-zinc-500">
            No active connections. After you add the URL in Claude and sign in,
            it will show up here.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {connections.map((c) => (
              <li
                key={c.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {c.client_name ?? c.client_id}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Scopes:{" "}
                    <span className="font-mono">
                      {c.scope || "(none)"}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Authorized {fmt(c.created_at)} · Last used {fmt(c.last_used_at)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => revoke(c.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-white mb-1">
          How to connect
        </h2>
        <ol className="list-decimal pl-5 text-sm text-zinc-300 space-y-1.5">
          <li>In Claude (web or desktop), open <strong>Settings → Connectors</strong>.</li>
          <li>Click <strong>Add custom connector</strong>.</li>
          <li>Paste the URL above and continue.</li>
          <li>Sign in with this Forge account and approve the scopes.</li>
          <li>Ask Claude things like <em>“reschedule June 3 jobs to June 6 and text customers”</em>.</li>
        </ol>
      </section>
    </div>
  );
}
