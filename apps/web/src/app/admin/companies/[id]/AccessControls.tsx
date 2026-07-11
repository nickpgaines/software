"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PULSE } from "@/components/pulse/theme";

type Props = {
  companyId: number;
  accessStatus: string;
  revokedAt: string | null;
  revokedReason: string | null;
  isPlatformTenant: boolean;
};

export function AccessControls({
  companyId,
  accessStatus,
  revokedAt,
  revokedReason,
  isPlatformTenant,
}: Props) {
  const router = useRouter();
  const [showRevoke, setShowRevoke] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const revoked = accessStatus === "revoked";

  function call(action: "revoke" | "restore", reason?: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/companies/${companyId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || `Request failed (${res.status})`);
        return;
      }
      setShowRevoke(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 text-[13px]">
        <div className="font-bold shrink-0" style={{ color: PULSE.textSubtle }}>
          Status
        </div>
        <div className="font-bold text-right">
          {revoked ? (
            <span style={{ color: PULSE.red }}>Revoked</span>
          ) : (
            <span style={{ color: PULSE.green }}>Active</span>
          )}
        </div>
      </div>

      {revoked && (
        <>
          <div className="flex items-start justify-between gap-4 text-[13px]">
            <div
              className="font-bold shrink-0"
              style={{ color: PULSE.textSubtle }}
            >
              Revoked at
            </div>
            <div className="font-bold text-right break-all">
              {revokedAt || "—"}
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 text-[13px]">
            <div
              className="font-bold shrink-0"
              style={{ color: PULSE.textSubtle }}
            >
              Reason
            </div>
            <div className="font-bold text-right break-all">
              {revokedReason || (
                <span style={{ color: PULSE.textDim }}>—</span>
              )}
            </div>
          </div>
        </>
      )}

      {isPlatformTenant ? (
        <div className="text-[12px] font-bold" style={{ color: PULSE.textDim }}>
          The platform tenant cannot be revoked.
        </div>
      ) : revoked ? (
        <div className="pt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => call("restore")}
          >
            {isPending ? "Restoring…" : "Restore access"}
          </Button>
        </div>
      ) : showRevoke ? (
        <div className="pt-2 space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, shown only in admin center)"
            maxLength={500}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => call("revoke", reason)}
            >
              {isPending ? "Revoking…" : "Confirm revoke"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setShowRevoke(false);
                setReason("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          <div
            className="text-[12px] font-bold"
            style={{ color: PULSE.textDim }}
          >
            Revoking blocks every login and every existing session on the next
            request. Data is preserved.
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowRevoke(true)}
          >
            Revoke access
          </Button>
        </div>
      )}

      {error && (
        <div
          className="text-[12px] font-bold"
          style={{ color: PULSE.red }}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
