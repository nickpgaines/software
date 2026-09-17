import { terminalResponse, terminalSession } from '@/lib/terminal-http';
import { startTerminalAttempt, listTerminalAttempts } from '@/lib/terminal-attempts';
import { requireIdempotencyKey } from '@/lib/payment-idempotency';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  return terminalResponse(async () => startTerminalAttempt(await terminalSession(req), requireIdempotencyKey(req), await req.json()));
}
export async function GET(req: Request) {
  return terminalResponse(async () => {
    const auth = await terminalSession(req); const query = new URL(req.url).searchParams;
    return listTerminalAttempts(auth.companyId, query.has('job_id') ? { job_id: Number(query.get('job_id')) } : { customer_id: Number(query.get('customer_id')) });
  });
}
