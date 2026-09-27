import { terminalResponse, terminalSession } from '@/lib/terminal-http';
import { getTerminalLocationSetup, saveTerminalLocationSetup } from '@/lib/terminal-location';

export const dynamic = "force-dynamic";

export async function GET(req:Request) {
  const response = await terminalResponse(async () => getTerminalLocationSetup(await terminalSession(req)));
  response.headers.set('Cache-Control','private, no-store');
  return response;
}

export async function POST(req:Request) {
  const response = await terminalResponse(async () => {
    const session = await terminalSession(req);
    return saveTerminalLocationSetup(session,await req.json());
  });
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
