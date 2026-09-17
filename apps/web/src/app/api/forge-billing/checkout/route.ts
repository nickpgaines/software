import { billingResponse, billingSession } from '@/lib/forge-billing/http';
import { createCompanyCheckout } from '@/lib/forge-billing/service';
export const runtime='nodejs';
export async function POST(req:Request) { return billingResponse(async()=>{const session=await billingSession(req,true);const body=await req.json();return createCompanyCheckout(session.companyId,body?.plan,body?.interval);}); }
