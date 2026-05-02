"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";

type PageRow = {
  id: number;
  page_id: string;
  page_name: string;
  enabled: boolean;
};

export default function LeadsIntegrationsClient({
  configured,
  connected,
  userName,
  connectedAt,
  initialPages,
}: {
  configured: boolean;
  connected: boolean;
  userName: string | null;
  connectedAt: string | null;
  initialPages: PageRow[];
}) {
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<PageRow[]>(initialPages);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const ok = searchParams.get("meta_connected");
    const err = searchParams.get("meta_error");
    if (ok) setBanner({ type: "ok", message: "Meta connected." });
    else if (err) setBanner({ type: "error", message: `Meta error: ${err}` });
  }, [searchParams]);

  function connect() {
    if (!configured) {
      setBanner({
        type: "error",
        message:
          "Meta is not configured. Set META_APP_ID and META_APP_SECRET on the server.",
      });
      return;
    }
    window.location.href = "/api/integrations/meta/connect";
  }

  async function disconnect() {
    if (!confirm("Disconnect Meta and remove all connected pages?")) return;
    setBusy(true);
    try {
      await fetch("/api/integrations/meta/disconnect", { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function refreshPages() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/meta/refresh-pages", {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setBanner({
          type: "error",
          message: j.error || "Failed to refresh pages",
        });
      } else {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function togglePage(id: number, enabled: boolean) {
    const prev = pages;
    setPages((cur) => cur.map((p) => (p.id === id ? { ...p, enabled } : p)));
    try {
      const res = await fetch(`/api/integrations/meta/pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPages(prev);
      setBanner({ type: "error", message: "Failed to update page" });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Integrations</h2>
        <p className="text-sm text-slate-500">Connect Meta and other lead sources</p>
      </div>

      {banner && (
        <div
          className={
            "rounded-lg px-4 py-2.5 text-sm " +
            (banner.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700")
          }
        >
          {banner.message}
        </div>
      )}

      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <MetaLogo />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl font-bold text-slate-900">
                Meta Lead Ads
              </h3>
              <span
                className={
                  "text-xs px-2 py-0.5 rounded-full " +
                  (connected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600")
                }
              >
                {connected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              Pipe Meta Lead Ads straight into your pipeline. Authorize once,
              pick the pages you want, and new leads show up automatically.
            </p>
            {connected && (userName || connectedAt) && (
              <p className="text-xs text-slate-500 mt-2">
                {userName ? `Authorized as ${userName}` : null}
                {userName && connectedAt ? " · " : ""}
                {connectedAt
                  ? `connected ${new Date(connectedAt).toLocaleDateString()}`
                  : null}
              </p>
            )}
          </div>
          <div className="shrink-0">
            {connected ? (
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={connect}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
              >
                Connect Meta
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="font-semibold text-slate-900">Connected pages</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Leads from these pages flow into your pipeline.
              </p>
            </div>
            {connected && (
              <button
                type="button"
                onClick={refreshPages}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh pages
              </button>
            )}
          </div>

          {pages.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <MetaLogo />
              </div>
              <p className="mt-3 font-semibold text-slate-900">
                No pages connected yet
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Authorize Meta above to pick the pages you want to receive leads
                from.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((p) => (
                <div
                  key={p.id}
                  className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {p.page_name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      Page ID: {p.page_id}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.enabled}
                    onClick={() => togglePage(p.id, !p.enabled)}
                    className={
                      "relative w-10 h-6 rounded-full shrink-0 transition-colors " +
                      (p.enabled ? "bg-emerald-500" : "bg-slate-300")
                    }
                  >
                    <span
                      className={
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " +
                        (p.enabled ? "translate-x-4" : "")
                      }
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!configured && (
        <div className="text-xs text-slate-500">
          Heads up: Meta credentials aren&rsquo;t set on the server. Add{" "}
          <code className="bg-slate-100 px-1 rounded">META_APP_ID</code>,{" "}
          <code className="bg-slate-100 px-1 rounded">META_APP_SECRET</code>,{" "}
          and{" "}
          <code className="bg-slate-100 px-1 rounded">
            META_WEBHOOK_VERIFY_TOKEN
          </code>{" "}
          to enable the connect flow.
        </div>
      )}
    </div>
  );
}

function MetaLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M12.001 2c-3.5 0-6.222 2.7-6.222 6.222 0 1.612.567 3.121 1.55 4.32a17.91 17.91 0 0 1-1.328 1.638c-.844.93-1.668 1.464-2.668 1.464C1.49 15.644.5 14.06.5 11.81c0-3.4 1.69-6.6 4.4-8.86C7.5 1.022 9.97 0 12.5 0c3.6 0 6.34 2.55 7.85 5.61 1.31 2.66 1.65 5.59 1.65 7.83 0 1.85-.78 3.42-2.36 3.42-1.16 0-2.05-.62-2.96-1.7-.83-.99-1.66-2.35-2.59-3.92-.93-1.57-1.74-2.84-2.5-3.79a2.79 2.79 0 0 1 .42-.07c1.34 0 2.34.84 3.34 2.18.99 1.32 1.95 3.07 2.95 4.78 1 1.7 1.7 2.62 2.32 2.62.62 0 .85-.6.85-1.55 0-1.97-.32-4.49-1.43-6.74C18.97 5.94 17.05 4 14.43 4c-2.95 0-5.4 2.55-7.69 5.91-2.13 3.13-3.74 6.06-3.74 8.5 0 1.61.85 2.59 2.07 2.59 1.43 0 2.62-.71 3.71-1.92.7-.78 1.4-1.63 2.05-2.5C9.62 14.91 8.46 13.6 8.46 11.6c0-2.6 1.85-4.27 4.04-4.27 1.7 0 2.93 1.05 4 2.78A8.93 8.93 0 0 0 12.001 2z" />
    </svg>
  );
}
