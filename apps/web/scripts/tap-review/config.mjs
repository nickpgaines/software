import {isAbsolute, join} from 'node:path';

export function validateOrigin(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.hostname.endsWith('.')||url.hostname==='forgecrm.app'||url.hostname.endsWith('.forgecrm.app')||value!==url.origin) {
    throw new Error('Use an exact non-production HTTPS origin, without a path, credentials or custom port.');
  }
  return url.origin;
}

// Intentionally does not inherit process.env or load dotenv files.
export function buildEnvironment({directory,origin,sessionSecret,secretKey,publishableKey}) {
  validateOrigin(origin);
  if(!isAbsolute(directory)||!sessionSecret)throw new Error('Absolute disposable directory and session secret required.');
  if(!/^rk_test_[A-Za-z0-9]+$/.test(secretKey)||!/^pk_test_[A-Za-z0-9]+$/.test(publishableKey))throw new Error('Only restricted Stripe TEST keys and matching test publishable keys are permitted.');
  return {
    PATH:'/usr/bin:/bin:/usr/sbin:/sbin',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',
    TURSO_DATABASE_URL:`file:${join(directory,'terminal.sqlite')}`,TURSO_AUTH_TOKEN:'local-disposable-only',
    SESSION_SECRET:sessionSecret,APP_URL:origin,NEXT_PUBLIC_APP_URL:origin,
    FORGE_BILLING_ENABLED:'false',FORGE_BILLING_NATIVE_WEBSITE_ENABLED:'false',
    TAP_TO_PAY_ENABLED:'true',TAP_TO_PAY_MODE:'test',TAP_TO_PAY_ANNOUNCEMENT_ENABLED:'false',
    STRIPE_SECRET_KEY:secretKey,NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:publishableKey,
  };
}
