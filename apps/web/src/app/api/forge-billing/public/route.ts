import { billingResponse } from '@/lib/forge-billing/http';
import { billingCutoff, isForgeBillingEnabled } from '@/lib/forge-billing/config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() { return billingResponse(async()=>{if(!isForgeBillingEnabled()) return {enabled:false};const cutoffAt=billingCutoff();return {enabled:true,cutoffAt,trialAvailable:Date.now()<Date.parse(cutoffAt)};}); }
