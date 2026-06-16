import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Hybrid / remote-URL shell (see CAPACITOR_PLAN.md, Phase 0).
 *
 * The Forge web app is server-rendered (server components, 154 API routes,
 * middleware auth) and cannot be statically exported, so the native webview
 * loads the hosted Next.js app instead of a bundled static build.
 *
 * `webDir` (./www) is only the offline/fallback shell. To point the app at the
 * live site, uncomment `server.url` below and set it to the production domain
 * once confirmed (Phase 0 open question). For local device testing you can
 * temporarily set it to your machine's LAN dev URL, e.g.
 * `http://192.168.x.x:3000`, with `cleartext: true`.
 */
const config: CapacitorConfig = {
  appId: 'com.forge.crm',
  appName: 'Forge',
  webDir: 'www',
  // server: {
  //   url: 'https://app.example.com',
  //   cleartext: false,
  // },
};

export default config;
