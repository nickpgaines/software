import { terminalResponse, terminalSession } from '@/lib/terminal-http';
import { reconcileTerminalAttempt } from '@/lib/terminal-attempts';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return terminalResponse(async () => reconcileTerminalAttempt((await terminalSession(req)).companyId, params.id));
}
