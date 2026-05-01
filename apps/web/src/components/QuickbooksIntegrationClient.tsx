"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = {
  configured: boolean;
  connected: boolean;
  realm_id?: string | null;
  environment?: "sandbox" | "production" | null;
  company_name?: string | null;
  connected_at?: string | null;
};

export default function QuickbooksIntegrationClient() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("connect_error");
    if (oauthError) {
      setError(oauthError);
      const next = new URLSearchParams(searchParams);
      next.delete("connect_error");
      const qs = next.toString();
      router.replace(
        `/settings/integrations/quickbooks${qs ? `?${qs}` : ""}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/quickbooks/connect/status");
      const data = (await res.json()) as Status & { error?: string };
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setStatus(null);
      } else {
        setStatus(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function startConnect() {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch("/api/quickbooks/connect/start", {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to start QuickBooks connect"
      );
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    if (
      !confirm(
        "Disconnect from QuickBooks? You can reconnect any time."
      )
    )
      return;
    setWorking(true);
    try {
      await fetch("/api/quickbooks/connect/disconnect", { method: "POST" });
      await load();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings?tab=integrations"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <span aria-hidden>‹</span> Integrations
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">
          QuickBooks Online
        </h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="border-b border-slate-200 px-5 sm:px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            QuickBooks Integration
          </h2>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Connect your QuickBooks Online account to automatically sync
            customers, invoices, estimates, and payments.
          </p>

          {error && (
            <div className="border border-rose-200 bg-rose-50 rounded-xl px-3 py-2">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : !status?.configured ? (
            <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">
                QuickBooks isn&apos;t configured.
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Add <code>QUICKBOOKS_CLIENT_ID</code> and{" "}
                <code>QUICKBOOKS_CLIENT_SECRET</code> to the deployment
                environment, then redeploy. Set{" "}
                <code>QUICKBOOKS_ENVIRONMENT</code> to{" "}
                <code>production</code> when going live.
              </p>
            </div>
          ) : !status.connected ? (
            <div>
              <button
                type="button"
                onClick={startConnect}
                disabled={working}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white text-sm font-medium rounded-md px-4 py-2"
              >
                <span className="w-5 h-5 rounded-full bg-white text-emerald-700 flex items-center justify-center text-[11px] font-bold">
                  qb
                </span>
                {working ? "Opening QuickBooks…" : "Connect to QuickBooks"}
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="text-sm font-medium text-slate-900">
                      {status.company_name || "Connected QuickBooks company"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Realm ID: {status.realm_id}
                    {status.environment && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wide font-sans">
                        {status.environment}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={load}
                  className="text-xs text-slate-500 hover:text-slate-900"
                  title="Re-check status"
                >
                  Refresh
                </button>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={working}
                  className="text-xs text-rose-600 hover:text-rose-500 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
