import {terminalResponse,terminalSession} from '@/lib/terminal-http';
import {acknowledgeTerminalNotice} from '@/lib/terminal-outcomes';
export const dynamic='force-dynamic';
export async function POST(req:Request,{params}:{params:{id:string}}) {
  const response=await terminalResponse(async()=>{await acknowledgeTerminalNotice(await terminalSession(req),params.id);return {acknowledged:true};});
  response.headers.set('Cache-Control','private, no-store');return response;
}
