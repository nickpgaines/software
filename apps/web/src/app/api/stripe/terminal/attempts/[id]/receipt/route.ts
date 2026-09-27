import {terminalSession} from '@/lib/terminal-http';
import {getTerminalReceipt,requestTerminalReceipt,terminalReceiptResponse} from '@/lib/terminal-receipts';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string}}) {
  return terminalReceiptResponse(async()=>getTerminalReceipt((await terminalSession(req)).companyId,params.id));
}
export async function POST(req:Request,{params}:{params:{id:string}}) {
  return terminalReceiptResponse(async()=>{
    const auth=await terminalSession(req);
    const body=await req.json();
    return requestTerminalReceipt(auth.companyId,params.id,body?.email);
  });
}
