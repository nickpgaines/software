import {terminalResponse,terminalSession} from '@/lib/terminal-http';
import {acknowledgeTerminalAnnouncement} from '@/lib/terminal-announcements';
export const dynamic='force-dynamic';
export async function POST(req:Request) {
  const response=await terminalResponse(async()=>{const auth=await terminalSession(req);await acknowledgeTerminalAnnouncement(auth,(await req.json()).version);return {acknowledged:true};});
  response.headers.set('Cache-Control','private, no-store');return response;
}
