import {terminalSession} from '@/lib/terminal-http';
import {terminalReceiptResponse} from '@/lib/terminal-receipts';
import {getDeclinedTerminalDocument} from '@/lib/terminal-declined-receipts';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string;outcomeId:string}}) {
  return terminalReceiptResponse(async()=>getDeclinedTerminalDocument((await terminalSession(req)).companyId,params.id,params.outcomeId));
}
