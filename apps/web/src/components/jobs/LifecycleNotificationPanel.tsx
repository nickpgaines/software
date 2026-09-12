"use client";

import { useCallback, useEffect, useState } from "react";
import {
  lifecycleNotificationPresentation,
  type JobLifecycleNotificationRecord,
  type JobLifecycleStep,
} from "@/lib/job-lifecycle-notifications";

const STEP_LABELS: Record<JobLifecycleStep, string> = {
  en_route: "En route",
  arrived: "Arrived",
  started: "Started",
  completed: "Completed",
};

function timestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function LifecycleNotificationPanel({
  jobId,
  refreshKey = 0,
}: {
  jobId: number;
  refreshKey?: number;
}) {
  const [notifications, setNotifications] = useState<JobLifecycleNotificationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const load = useCallback(async (cancelled?: () => boolean) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/lifecycle-notifications`);
      const payload = await response.json().catch(() => null);
      if (cancelled?.()) return;
      if (!response.ok || !Array.isArray(payload)) {
        setError(payload?.error || "Could not load customer text delivery status.");
        setLoaded(true);
        return;
      }
      setNotifications(payload as JobLifecycleNotificationRecord[]);
      setError(null);
      setLoaded(true);
    } catch {
      if (!cancelled?.()) {
        setError("Could not load customer text delivery status.");
        setLoaded(true);
      }
    }
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [load, refreshKey]);

  async function retry(notification: JobLifecycleNotificationRecord) {
    const presentation = lifecycleNotificationPresentation(notification.outcome);
    if (presentation.requiresConfirmation && !window.confirm(
      `${presentation.duplicateRisk}\n\nRetry this text anyway?`
    )) return;
    setRetryingId(notification.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/jobs/${jobId}/lifecycle-notifications/${notification.id}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm_unknown: presentation.requiresConfirmation }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Could not retry the customer text.");
        return;
      }
      await load();
    } catch {
      setError("Could not retry the customer text.");
    } finally {
      setRetryingId(null);
    }
  }

  const visible = notifications.filter(notification => notification.outcome !== "sent");
  if (!loaded) return null;
  if (visible.length === 0 && !error) return null;

  return (
    <section className="bg-card border border-line rounded-2xl p-5" aria-label="Customer text delivery">
      <h2 className="font-extrabold text-white tracking-tight">Customer text delivery</h2>
      {error && <p role="alert" className="mt-2 text-sm text-rose-400">{error}</p>}
      {visible.length > 0 && (
        <div className="mt-3 divide-y divide-line">
          {visible.map(notification => {
            const presentation = lifecycleNotificationPresentation(notification.outcome);
            const eventTime = timestamp(notification.last_attempt_at || notification.updated_at);
            return (
              <div key={notification.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{STEP_LABELS[notification.step]}</span>
                      <span className="rounded-full bg-black px-2 py-0.5 text-xs font-bold text-zinc-300">
                        {presentation.label}
                      </span>
                    </div>
                    {notification.error && <p className="mt-1 text-xs text-zinc-400">{notification.error}</p>}
                    {presentation.duplicateRisk && (
                      <p className="mt-1 text-xs text-amber-400">{presentation.duplicateRisk}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      {notification.attempt_count === 1 ? "1 attempt" : `${notification.attempt_count} attempts`}
                      {eventTime ? ` · ${eventTime}` : ""}
                    </p>
                  </div>
                  {presentation.retryLabel && (
                    <button
                      type="button"
                      onClick={() => void retry(notification)}
                      disabled={retryingId === notification.id}
                      className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-black disabled:opacity-50"
                    >
                      {retryingId === notification.id ? "Retrying…" : presentation.retryLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
