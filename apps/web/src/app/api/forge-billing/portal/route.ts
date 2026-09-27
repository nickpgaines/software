import { billingResponse, billingSession } from '@/lib/forge-billing/http';
import { createCompanyPortal } from '@/lib/forge-billing/service';
export const runtime='nodejs';
export async function POST(req:Request) { return billingResponse(async()=>{const session=await billingSession(req,true);return createCompanyPortal(session.companyId);}); }
