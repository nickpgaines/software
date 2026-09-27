import { billingResponse, statusResponse } from '@/lib/forge-billing/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request) { return billingResponse(()=>statusResponse(req)); }
