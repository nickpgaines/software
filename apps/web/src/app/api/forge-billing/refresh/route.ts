import { billingResponse, billingSession, statusResponse } from '@/lib/forge-billing/http';
import { refreshCompanyBilling } from '@/lib/forge-billing/service';
export const runtime='nodejs';
export async function POST(req:Request) { return billingResponse(async()=>{const session=await billingSession(req);await refreshCompanyBilling(session.companyId);return statusResponse(req);}); }
