import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
  appId: 'app.forgecrm',
  appName: 'Forge',
  webDir: 'www',
  // Sent by the native WebView before its first hosted navigation. The web
  // server uses it to prevent web-only Google OAuth from being started in the
  // mobile app; it is intentionally appended rather than replacing the
  // platform's normal user agent.
  appendUserAgent: 'ForgeNative/1',
  server: {
    url: serverUrl,
    cleartext: isCleartext,
    // Keep server-side redirects (e.g. /login -> /dashboard) inside the
    // webview instead of bouncing to external Safari.
    allowNavigation: ['localhost', 'forgecrm.app', '*.forgecrm.app'],
    // Offline fallback: when the webview can't load the remote app (no
    // connectivity, server unreachable), Capacitor loads this bundled page
    // from webDir instead of WKWebView's blank error screen. The page itself
    // (www/index.html) listens for the `online` event and a manual retry to
    // return to the hosted app once the network is back.
    errorPath: 'index.html',
  },
  plugins: {
    // Phase 3 UX chrome. The hosted app calls SplashScreen.hide() once it has
    // painted (see web NativeChrome); launchAutoHide is the fallback so the
    // splash never sticks if that call never runs (e.g. offline). Black
    // background matches the dark UI so any load gap isn't a white flash.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#000000',
    },
    // Resize the webview when the software keyboard appears so focused form
    // fields aren't covered.
    Keyboard: {
      resize: KeyboardResize.Native,
    },
  },
};

export default config;
