import { billingResponse } from '@/lib/forge-billing/http';
import { handleBillingWebhook } from '@/lib/forge-billing/webhook';
export const runtime='nodejs';
export async function POST(req:Request) { return billingResponse(async()=>handleBillingWebhook(await req.text(),req.headers.get('stripe-signature'))); }
