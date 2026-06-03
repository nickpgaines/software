import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  MCP_SCOPES,
  parseScopeString,
  type McpScope,
} from "@/lib/mcp/auth";
import { ApproveForm } from "./ApproveForm";

export const dynamic = "force-dynamic";

const SCOPE_DESCRIPTIONS: Record<McpScope, { title: string; detail: string }> = {
  "crm.read": {
    title: "Read your CRM data",
    detail:
      "Jobs, customers, invoices, estimates, subscriptions, and reports.",
  },
  "crm.write": {
    title: "Modify jobs and customers",
    detail:
      "Reschedule jobs, change statuses, and add notes on your behalf.",
  },
  "crm.messaging": {
    title: "Send SMS and email to your customers",
    detail:
      "Send messages from your Forge Twilio number and email sender.",
  },
};

type Query = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
};

function getQueryParam(
  params: { [k: string]: string | string[] | undefined },
  key: string
): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function paramError(redirectUri: string, error: string, state?: string): string {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const q: Query = {
    client_id: getQueryParam(searchParams, "client_id"),
    redirect_uri: getQueryParam(searchParams, "redirect_uri"),
    response_type: getQueryParam(searchParams, "response_type"),
    scope: getQueryParam(searchParams, "scope"),
    state: getQueryParam(searchParams, "state"),
    code_challenge: getQueryParam(searchParams, "code_challenge"),
    code_challenge_method:
      getQueryParam(searchParams, "code_challenge_method") || "S256",
  };

  if (!q.client_id || !q.redirect_uri) {
    return (
      <ErrorView message="Missing client_id or redirect_uri. This URL must come from Claude." />
    );
  }
  if (q.response_type !== "code") {
    return (
      <ErrorView message="Unsupported response_type. Only 'code' is supported." />
    );
  }
  if (!q.code_challenge || q.code_challenge_method !== "S256") {
    return (
      <ErrorView message="PKCE with S256 is required." />
    );
  }

  const db = await getDb();
  const client = await db
    .prepare(
      "SELECT client_name, redirect_uris FROM mcp_oauth_clients WHERE client_id = ? LIMIT 1"
    )
    .get<{ client_name: string | null; redirect_uris: string }>(q.client_id);
  if (!client) {
    return <ErrorView message="Unknown client_id. Re-add the connector in Claude." />;
  }
  let allowed: string[] = [];
  try {
    allowed = JSON.parse(client.redirect_uris) as string[];
  } catch {
    allowed = [];
  }
  if (!allowed.includes(q.redirect_uri)) {
    return (
      <ErrorView message="redirect_uri does not match any registered URI." />
    );
  }

  // If the user isn't signed in, bounce them through /login with a next= back
  // here so they land back at consent post-login.
  const ctx = await getSessionContext();
  if (!ctx) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) search.set(k, v);
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${search.toString()}`)}`);
  }

  // Platform admin shouldn't be issuing tokens with no staff_id — bail out.
  if (!ctx || ctx.isPlatformAdmin || ctx.staffId == null) {
    redirect(
      paramError(q.redirect_uri, "access_denied", q.state)
    );
  }

  const requested = parseScopeString(q.scope ?? MCP_SCOPES.join(" "));
  const effective = requested.length > 0 ? requested : [...MCP_SCOPES];

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-accent/10 grid place-items-center text-accent text-lg font-bold">
            F
          </div>
          <div className="text-fg-muted">+</div>
          <div className="h-10 w-10 rounded-lg bg-orange-100 grid place-items-center text-orange-600 text-lg font-bold">
            C
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-fg mb-1">
          Connect {client.client_name || "Claude"} to Forge
        </h1>
        <p className="text-sm text-fg-muted mb-4">
          Signed in as <span className="font-medium text-fg">{ctx.identity}</span>.
          {client.client_name || "Claude"} is asking permission to:
        </p>

        <ApproveForm
          clientId={q.client_id}
          redirectUri={q.redirect_uri}
          state={q.state ?? ""}
          codeChallenge={q.code_challenge}
          codeChallengeMethod={q.code_challenge_method ?? "S256"}
          scopes={effective.map((s) => ({
            id: s,
            title: SCOPE_DESCRIPTIONS[s].title,
            detail: SCOPE_DESCRIPTIONS[s].detail,
          }))}
        />
      </div>
    </main>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-fg mb-2">
          Can&apos;t complete sign-in
        </h1>
        <p className="text-sm text-fg-muted">{message}</p>
      </div>
    </main>
  );
}
