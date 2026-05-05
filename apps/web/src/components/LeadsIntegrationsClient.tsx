"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageRow = {
  id: number;
  page_id: string;
  page_name: string;
  enabled: boolean;
};

// Show the reconnect prompt this many days before the long-lived token's
// stated expiry. Meta long-lived page tokens last ~60 days; a week of
// runway gives the operator time to reconnect before lead ingestion stops.
const RECONNECT_WARNING_DAYS = 7;

type TokenStatus = "ok" | "expiring" | "expired";

function tokenStatus(expiresAt: string | null): TokenStatus {
  if (!expiresAt) return "ok";
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return "ok";
  const now = Date.now();
  if (expiryMs <= now) return "expired";
  const daysLeft = (expiryMs - now) / (1000 * 60 * 60 * 24);
  return daysLeft <= RECONNECT_WARNING_DAYS ? "expiring" : "ok";
}

export default function LeadsIntegrationsClient({
  configured,
  connected,
  userName,
  connectedAt,
  tokenExpiresAt,
  initialPages,
}: {
  configured: boolean;
  connected: boolean;
  userName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
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
        <h2 className="text-[40px] font-extrabold tracking-tight leading-none text-white">Integrations</h2>
        <p className="text-sm text-zinc-400 font-bold">Connect Meta and other lead sources</p>
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

      {connected && (() => {
        const status = tokenStatus(tokenExpiresAt);
        if (status === "ok") return null;
        const expiryLabel = tokenExpiresAt
          ? new Date(tokenExpiresAt).toLocaleDateString()
          : null;
        const isExpired = status === "expired";
        return (
          <div
            className={
              "rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4 " +
              (isExpired
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800")
            }
          >
            <div>
              <div className="font-bold">
                {isExpired
                  ? "Meta access has expired — reconnect required"
                  : "Meta access expires soon — reconnect required"}
              </div>
              <div className="mt-0.5">
                {isExpired
                  ? "New leads from Meta have stopped arriving. Reconnect to resume ingestion."
                  : `Your Meta access token${expiryLabel ? ` expires on ${expiryLabel}` : " will expire soon"}. Reconnect to keep leads flowing.`}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={connect}
              className="h-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg shrink-0"
            >
              Reconnect
            </Button>
          </div>
        );
      })()}

      <div className="border border-[#1f1f24] rounded-2xl overflow-hidden">
        <div className="p-6 flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <MetaLogo />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[40px] font-extrabold tracking-tight leading-none text-white">
                Meta Lead Ads
              </h3>
              <span
                className={
                  "text-xs px-2 py-0.5 rounded-full " +
                  (connected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-black text-zinc-400")
                }
              >
                {connected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-3 font-bold max-w-xl">
              Pipe Meta Lead Ads straight into your pipeline. Authorize once,
              pick the pages you want, and new leads show up automatically.
            </p>
            {connected && (userName || connectedAt) && (
              <p className="text-xs text-zinc-400 mt-2">
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
              <Button
                type="button"
                variant="ghost"
                onClick={disconnect}
                disabled={busy}
                className="h-auto bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-lg"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={connect}
                className="h-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg"
              >
                Connect Meta
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-[#1f1f24] p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="font-extrabold text-white tracking-tight">Connected pages</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Leads from these pages flow into your pipeline.
              </p>
            </div>
            {connected && (
              <Button
                type="button"
                variant="ghost"
                onClick={refreshPages}
                disabled={busy}
                className="h-auto gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-transparent border border-[#1f1f24] px-3 py-1.5 rounded-full font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh pages
              </Button>
            )}
          </div>

          {pages.length === 0 ? (
            <div className="border border-dashed border-[#1f1f24] rounded-xl p-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <MetaLogo />
              </div>
              <p className="mt-3 font-extrabold text-white tracking-tight">
                No pages connected yet
              </p>
              <p className="text-sm text-zinc-400 mt-3 font-bold">
                Authorize Meta above to pick the pages you want to receive leads
                from.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((p) => (
                <div
                  key={p.id}
                  className="border border-[#1f1f24] rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white tracking-tight truncate">
                      {p.page_name}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">
                      Page ID: {p.page_id}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    role="switch"
                    aria-checked={p.enabled}
                    onClick={() => togglePage(p.id, !p.enabled)}
                    className={
                      "relative w-10 h-6 p-0 rounded-full shrink-0 hover:bg-current " +
                      (p.enabled ? "bg-emerald-500 hover:bg-emerald-500" : "bg-[#2a2a32] hover:bg-[#2a2a32]")
                    }
                  >
                    <span
                      className={
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-[#0f0f12] rounded-full shadow transition-transform " +
                        (p.enabled ? "translate-x-4" : "")
                      }
                    />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!configured && (
        <div className="text-xs text-zinc-400">
          Heads up: Meta credentials aren&rsquo;t set on the server. Add{" "}
          <code className="bg-black px-1 rounded">META_APP_ID</code>,{" "}
          <code className="bg-black px-1 rounded">META_APP_SECRET</code>,{" "}
          and{" "}
          <code className="bg-black px-1 rounded">
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
    <svg
      viewBox="0 0 36 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-9 h-7"
      aria-hidden="true"
    >
      <path d="M2 12c0-4.4 2.6-8 6.4-8 3 0 5.2 2 7.4 5.4l2.2 3.6 2.2 3.6C22.4 20 24.6 22 27.6 22c3.8 0 6.4-3.6 6.4-8s-2.6-8-6.4-8c-3 0-5.2 2-7.4 5.4l-2.2 3.6-2.2 3.6C13.6 22 11.4 22 8.4 22 4.6 22 2 18.4 2 12z" />
    </svg>
  );
}
