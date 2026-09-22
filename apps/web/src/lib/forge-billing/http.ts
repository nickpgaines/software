import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { isNativeAppUserAgent } from '@/lib/native-auth';
import { billingOrigin, BillingError, requireBillingEnabled, nativeBillingWebsiteUrl } from './config';
import { canManageBilling, getCompanyBillingStatus } from './service';
export function isNativeBillingRequest(req: Request): boolean { return /(?:^|;\s*)forge_native_app=1(?:;|$)/.test(req.headers.get('cookie') || '') || isNativeAppUserAgent(req.headers.get('user-agent')); }
export async function billingSession(req: Request, manage = false) {
  const session = await getSessionContext();
  if (!session) throw new BillingError('Unauthorized',401);
  if (req.method !== 'GET') {
    requireBillingEnabled();
    if (req.headers.get('origin') !== billingOrigin() || req.headers.get('sec-fetch-site') === 'cross-site') throw new BillingError('Same-origin request required',403);
    if (manage && isNativeBillingRequest(req)) throw new BillingError('Billing purchases are unavailable in the native app',403);
  }
  if (manage && !await canManageBilling(session)) throw new BillingError('Billing administrator access required',403);
  return session;
}
export async function statusResponse(req: Request) {
  const session=await billingSession(req);
  const status=await getCompanyBillingStatus(session.companyId);
  if (!status.enabled) return {enabled:false};
  const canManage = await canManageBilling(session);
  const native = isNativeBillingRequest(req);
  return {...status,canManage,native,websiteBillingUrl:canManage && native ? nativeBillingWebsiteUrl() : null};
}
export async function billingResponse(work:()=>Promise<unknown>) {
  try {
    const result = await work();
    if (result instanceof Response) return result;
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }
  catch(error) {
    const status=error instanceof BillingError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return NextResponse.json({error:status === 503 ? 'Billing is temporarily unavailable. Refresh or contact support.' : error instanceof Error ? error.message : 'Billing request failed'}, {status,headers:{'Cache-Control':'no-store'}});
  }
}
