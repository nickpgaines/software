import {terminalResponse,terminalSession} from '@/lib/terminal-http';
import {getTerminalEligibility} from '@/lib/terminal-eligibility';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const response=await terminalResponse(async()=>getTerminalEligibility((await terminalSession(req)).companyId));
  response.headers.set('Cache-Control','private, no-store');return response;
}
