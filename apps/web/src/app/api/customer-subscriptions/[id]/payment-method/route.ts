import { terminalResponse, terminalSession } from '@/lib/terminal-http';
import { selectSubscriptionPaymentMethod } from '@/lib/subscription-payment-method';
export const dynamic = 'force-dynamic';
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return terminalResponse(async () => {
    const auth = await terminalSession(req); const body = await req.json();
    return selectSubscriptionPaymentMethod(auth.companyId,Number(params.id),body.payment_method_id);
  });
}
