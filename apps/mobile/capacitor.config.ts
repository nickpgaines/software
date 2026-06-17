import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Hybrid / remote-URL shell (see CAPACITOR_PLAN.md, Phase 0).
 *
 * The Forge web app is server-rendered (server components, 154 API routes,
 * middleware auth) and cannot be statically exported, so the native webview
 * loads the hosted Next.js app instead of a bundled static build.
 *
 * The shipped app loads PROD_SERVER_URL — the production site's /login. This is
 * a safe entry point for both states: middleware redirects an already-
 * authenticated request from /login straight to /dashboard (307), while a
 * logged-out request gets the login page. `webDir` (./www) is only the
 * offline/fallback shell.
 *
 * Override the target for local dev with the CAP_SERVER_URL env var, so no
 * machine-specific URL is committed:
 *
 *   Simulator (cleanest — localhost is exempt from iOS App Transport Security):
 *     CAP_SERVER_URL=http://localhost:3000 npx cap run ios
 *
 *   Real device on the same Wi‑Fi (needs the ATS exception in Info.plist, see
 *     CAPACITOR_PLAN.md → "Local device smoke test"):
 *     CAP_SERVER_URL=http://192.168.1.214:3000 npx cap sync ios
 */
const PROD_SERVER_URL = 'https://www.forgecrm.app/login';

const serverUrl = process.env.CAP_SERVER_URL?.trim() || PROD_SERVER_URL;
const isCleartext = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'com.forge.crm',
  appName: 'Forge',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: isCleartext,
  },
};

export default config;
