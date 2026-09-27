import {terminalSession} from '@/lib/terminal-http';
import {listTerminalReceipts,terminalReceiptResponse} from '@/lib/terminal-receipts';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  return terminalReceiptResponse(async()=>listTerminalReceipts((await terminalSession(req)).companyId,Number(new URL(req.url).searchParams.get('job_id'))));
}
