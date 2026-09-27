import {terminalSession} from '@/lib/terminal-http';
import {terminalReceiptResponse} from '@/lib/terminal-receipts';
import {listDeclinedTerminalDocuments} from '@/lib/terminal-declined-receipts';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  return terminalReceiptResponse(async()=>listDeclinedTerminalDocuments((await terminalSession(req)).companyId,Number(new URL(req.url).searchParams.get('job_id'))));
}
