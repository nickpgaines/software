import type { CapacitorConfig } from '@capacitor/cli';

// Forge CRM is server-rendered Next.js (libSQL, Stripe, API routes), so the
// native shell loads the hosted production URL instead of bundling static
// assets. `mobile-shell/` holds an offline placeholder used as the fallback.
const config: CapacitorConfig = {
  appId: 'app.forgecrm',
  appName: 'Forge CRM',
  webDir: 'mobile-shell',
  server: {
    url: 'https://forgecrm.app',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
