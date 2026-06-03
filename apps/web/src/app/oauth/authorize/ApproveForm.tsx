"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ApproveForm({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  codeChallengeMethod,
  scopes,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: { id: string; title: string; detail: string }[];
}) {
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scopes.map((s) => [s.id, true]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(decision: "allow" | "deny") {
    setBusy(true);
    setErr(null);
    const grantedScopes =
      decision === "allow"
        ? scopes
            .map((s) => s.id)
            .filter((id) => picked[id])
            .join(" ")
        : "";
    const res = await fetch("/api/mcp/oauth/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        scope: grantedScopes,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? "Could not complete authorization.");
      setBusy(false);
      return;
    }
    const j = (await res.json()) as { redirect_to: string };
    window.location.href = j.redirect_to;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {scopes.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-3 rounded-lg border border-border p-3"
          >
            <Checkbox
              id={`scope-${s.id}`}
              checked={!!picked[s.id]}
              onCheckedChange={(v) =>
                setPicked((p) => ({ ...p, [s.id]: v === true }))
              }
            />
            <label htmlFor={`scope-${s.id}`} className="flex-1 cursor-pointer">
              <div className="text-sm font-medium text-fg">{s.title}</div>
              <div className="text-xs text-fg-muted">{s.detail}</div>
            </label>
          </li>
        ))}
      </ul>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => submit("deny")}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={busy}
          onClick={() => submit("allow")}
        >
          {busy ? "Authorizing…" : "Allow access"}
        </Button>
      </div>
    </div>
  );
}
