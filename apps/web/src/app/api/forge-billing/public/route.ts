import { billingResponse } from '@/lib/forge-billing/http';
import { isForgeBillingEnabled } from '@/lib/forge-billing/config';
import { COMPANY_TRIAL_DAYS } from '@/lib/forge-billing/trial';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() { return billingResponse(async()=>isForgeBillingEnabled() ? {enabled:true,trialDays:COMPANY_TRIAL_DAYS,trialAvailable:true} : {enabled:false}); }
