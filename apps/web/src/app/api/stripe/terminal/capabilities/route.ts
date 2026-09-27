import { terminalResponse, terminalSession } from '@/lib/terminal-http';
import { isTapToPayEnabled } from '@/lib/terminal-rollout';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const response = await terminalResponse(async () => {
    await terminalSession(req);
    return { enabled: isTapToPayEnabled() };
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
