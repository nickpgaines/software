import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Hybrid / remote-URL shell (see CAPACITOR_PLAN.md, Phase 0).
 *
 * The Forge web app is server-rendered (server components, 154 API routes,
 * middleware auth) and cannot be statically exported, so the native webview
 * loads the hosted Next.js app instead of a bundled static build.
 *
 * `webDir` (./www) is only the offline/fallback shell. The webview's actual
 * target is `server.url`, set via the CAP_SERVER_URL env var so no
 * machine-specific or environment-specific URL is committed:
 *
 *   Simulator (cleanest — localhost is exempt from iOS App Transport Security):
 *     CAP_SERVER_URL=http://localhost:3000 npx cap sync ios
 *
 *   Real device on the same Wi‑Fi (needs the ATS exception in Info.plist, see
 *     CAPACITOR_PLAN.md → "Local device smoke test"):
 *     CAP_SERVER_URL=http://192.168.1.214:3000 npx cap sync ios
 *
 *   Production: set CAP_SERVER_URL=https://app.<domain> (no cleartext needed).
 *
 * With no CAP_SERVER_URL set, the app loads the offline shell in ./www.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim();
const isCleartext = serverUrl?.startsWith('http://') ?? false;

const config: CapacitorConfig = {
  appId: 'com.forge.crm',
  appName: 'Forge',
  webDir: 'www',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: isCleartext,
        },
      }
    : {}),
};

export default config;
