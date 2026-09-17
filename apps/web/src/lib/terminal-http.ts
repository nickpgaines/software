import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { PaymentIdempotencyError } from '@/lib/payment-idempotency';

export class TerminalError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new TerminalError('A positive integer ID is required');
  return value;
}
export async function terminalSession(req: Request) {
  const session = await getSessionContext();
  if (!session) throw new TerminalError('Unauthorized', 401);
  if (req.method !== 'GET') {
    const origin = req.headers.get('Origin');
    if (origin !== new URL(req.url).origin || req.headers.get('Sec-Fetch-Site') === 'cross-site') throw new TerminalError('Same-origin request required', 403);
  }
  return session;
}
export async function terminalResponse(work: () => Promise<unknown>) {
  try { return NextResponse.json(await work()); }
  catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error:'Invalid JSON request' },{ status:400 });
    if (error instanceof TerminalError || error instanceof PaymentIdempotencyError) return NextResponse.json({ error: error.message }, { status: error.status });
    // Do not acknowledge database/provider failures as successful effects.
    return NextResponse.json({ error: 'Unable to complete request. Reconcile the existing attempt before trying again.' }, { status: 503 });
  }
}
