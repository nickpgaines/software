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
        <h2 className="text-page-title text-white">Integrations</h2>
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

      <div className="border border-line rounded-2xl overflow-hidden">
        <div className="p-6 flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shrink-0">
            <MetaLogo className="w-10 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-page-title text-white">
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
                className="h-auto bg-primary hover:opacity-90 text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-lg"
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

        <div className="border-t border-line p-6">
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
                className="h-auto gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-transparent border border-line px-3 py-1.5 rounded-full font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh pages
              </Button>
            )}
          </div>

          {pages.length === 0 ? (
            <div className="border border-dashed border-line rounded-xl p-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                <MetaLogo className="w-7 h-5" />
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
                  className="border border-line rounded-lg p-3 flex items-center justify-between gap-3"
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
                      (p.enabled ? "bg-emerald-500 hover:bg-emerald-500" : "bg-line-strong hover:bg-line-strong")
                    }
                  >
                    <span
                      className={
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform " +
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

function MetaLogo({ className = "w-10 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 287.56 191"
      className={className}
      aria-label="Meta"
      role="img"
    >
      <defs>
        <linearGradient
          id="meta-logo-a"
          x1="62.34"
          y1="101.45"
          x2="260.34"
          y2="91.45"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0064e1" />
          <stop offset="0.4" stopColor="#0064e1" />
          <stop offset="0.83" stopColor="#0073ee" />
          <stop offset="1" stopColor="#0082fb" />
        </linearGradient>
        <linearGradient
          id="meta-logo-b"
          x1="41.42"
          y1="53"
          x2="41.42"
          y2="126"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0082fb" />
          <stop offset="1" stopColor="#0064e0" />
        </linearGradient>
      </defs>
      <path
        fill="#0081fb"
        d="M31.06,126c0,11,2.41,19.41,5.56,24.51A19,19,0,0,0,53.19,160c8.1,0,15.51-2,29.79-21.76,11.44-15.83,24.92-38,34-52l15.36-23.6c10.67-16.39,23-34.61,37.18-47C181.07,5.6,193.54,0,206.09,0c21.07,0,41.14,12.21,56.5,35.11,16.81,25.08,25,56.67,25,89.27,0,19.38-3.82,33.62-10.32,44.87C271,180.13,258.72,191,238.13,191V160c17.63,0,22-16.2,22-34.74,0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85,0-26.8,11.2-40.23,31.17-7.14,10.61-14.47,23.54-22.7,38.13L120.79,77S114.21,86,108,93.13C97.39,105.4,89.7,116.49,71.93,134.81c-21.94,22.78-39.94,30.19-66.31,30.19V134c11.81,0,16.78-4.43,16.78-12.31a15.21,15.21,0,0,0-.34-3.69Z"
      />
      <path
        fill="url(#meta-logo-a)"
        d="M24.49,37.3C38.73,15.35,59.28,0,82.85,0c13.65,0,27.22,4,41.39,15.61C139.74,28.25,156.11,49.05,176.55,83.32l7.31,12.17c17.69,29.46,27.76,44.61,33.66,51.75,7.59,9.17,12.92,11.93,19.83,11.93,17.63,0,22-16.2,22-34.74L287.56,126c0,21.18-8.56,40.84-22.55,52.36C249.55,189.51,231.36,191,209.94,191c-19.32,0-33.66-6.43-46.27-25.18-15-22.2-28.6-46.43-41.94-69.7-9.34-16.31-17.71-32.66-24.45-44.55C90.39,40.95,82.41,29.66,71.4,29.66,55.62,29.66,42.85,38.5,33.13,53.34Z"
      />
      <path
        fill="url(#meta-logo-b)"
        d="M82.4,29.66c-11,0-20.39,8.84-30.11,23.68-13.71,21-22.11,52.24-22.11,82.21,0,12.39-2.72,21.92-6.32,28.51L24.49,37.3C34.51,21.49,51.51,8.4,82.85,8.4Z"
      />
    </svg>
  );
}
