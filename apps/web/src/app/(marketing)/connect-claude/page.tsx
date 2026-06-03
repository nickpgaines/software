import { headers } from "next/headers";
import { ConnectorUrlButton } from "./ConnectorUrlButton";

export const metadata = {
  title: "Run your whole CRM by just talking to Claude — Forge",
  description:
    "Connect Forge to Claude and run your business by chat. Reschedule jobs, text customers, generate P&Ls — Claude does the work.",
};

function publicBaseUrl(): string {
  const env = process.env.MCP_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const STEPS = [
  {
    n: 1,
    title: "Open Claude connector settings",
    detail: "In Claude (web or desktop), go to Settings → Connectors.",
  },
  {
    n: 2,
    title: "Add a custom connector",
    detail: "Click “Add custom connector” to point Claude at a new tool server.",
  },
  {
    n: 3,
    title: "Paste the Forge connector URL",
    detail:
      "Drop in the URL above — Claude discovers every Forge tool automatically.",
  },
  {
    n: 4,
    title: "Sign in & authorize",
    detail:
      "Log in with your Forge account and approve the scopes you want Claude to use.",
  },
  {
    n: 5,
    title: "Run your CRM by chat",
    detail:
      "Ask Claude to reschedule jobs, send invoices, text customers — it does the work.",
  },
];

export default function ConnectClaudePage() {
  const connectorUrl = `${publicBaseUrl()}/api/mcp`;
  return (
    <div className="px-4 py-12 sm:py-20">
      <section className="mx-auto max-w-4xl rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950/40 p-10 sm:p-16 text-center shadow-xl">
        <div className="flex items-center justify-center gap-4 mb-6 text-3xl">
          <span className="text-sky-400 font-bold">F</span>
          <span className="text-zinc-500">+</span>
          <span className="text-orange-500 font-bold">✶</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
          Run your whole CRM by{" "}
          <span className="text-orange-500">just talking to Claude.</span>
        </h1>
        <p className="mt-4 text-zinc-400 text-base sm:text-lg max-w-xl mx-auto">
          One sentence replaces ten clicks. Connect Forge to Claude and run
          your entire business.
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <ConnectorUrlButton url={connectorUrl} />
          <code className="text-xs text-zinc-500 font-mono">{connectorUrl}</code>
        </div>
      </section>

      <section className="mx-auto max-w-3xl mt-20 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">
          How to connect
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg mt-2">
          Live in under two minutes.
        </h2>
      </section>

      <section className="mx-auto max-w-3xl mt-10 space-y-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <div className="h-8 w-8 shrink-0 rounded-full bg-orange-100 text-orange-600 grid place-items-center text-sm font-bold">
              {s.n}
            </div>
            <div>
              <div className="text-base font-semibold text-zinc-900">
                {s.title}
              </div>
              <p className="text-sm text-zinc-600 mt-1">{s.detail}</p>
              {s.n === 3 ? (
                <code className="mt-3 inline-block rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-mono text-zinc-700">
                  {connectorUrl}
                </code>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl mt-16 text-center">
        <h3 className="text-xl font-semibold text-fg">Examples</h3>
        <ul className="mt-4 space-y-2 text-sm text-fg-muted">
          <li>“Reschedule all my June 3 jobs to June 6 because of rain, and text the customers a polite heads-up.”</li>
          <li>“Make me a profit-and-loss statement for last month.”</li>
          <li>“Which customers haven&apos;t booked in 90 days? Send them a check-in email.”</li>
        </ul>
      </section>
    </div>
  );
}
