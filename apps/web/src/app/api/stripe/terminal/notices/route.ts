import {terminalResponse,terminalSession} from '@/lib/terminal-http';
import {listTerminalNotices} from '@/lib/terminal-outcomes';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const response=await terminalResponse(async()=>listTerminalNotices(await terminalSession(req)));
  response.headers.set('Cache-Control','private, no-store');return response;
}
