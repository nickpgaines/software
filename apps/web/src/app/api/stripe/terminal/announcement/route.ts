import {terminalResponse,terminalSession} from '@/lib/terminal-http';
import {getTerminalAnnouncement} from '@/lib/terminal-announcements';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const response=await terminalResponse(async()=>getTerminalAnnouncement(await terminalSession(req)));
  response.headers.set('Cache-Control','private, no-store');return response;
}
