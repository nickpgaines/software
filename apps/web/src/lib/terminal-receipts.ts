import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getDb} from '@/lib/db';
import {getCompany,getStripe} from '@/lib/stripe';
import {getTerminalReceiptIntent} from '@/lib/terminal-attempts';
import {requireTerminalEnvironment} from '@/lib/terminal-environment';
import {positiveId,TerminalError} from '@/lib/terminal-http';

export type TerminalReceiptView = {
  attempt_id:string; amount_cents:number; refunded_cents:number; created:number;
  receipt_url:string|null; test_mode:boolean;
};
export type TerminalReceiptSummary = {attempt_id:string;amount_cents:number;created_at:string};

function receiptUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url=new URL(value);
    return url.protocol==='https:' && url.hostname==='pay.stripe.com' && !url.port && !url.username && !url.password && url.pathname.startsWith('/receipts/') ? url.href : null;
  } catch { return null; }
}
async function verified(companyId:number,id:string) {
  const payment=await getTerminalReceiptIntent(companyId,id);
  const {intent}=payment;
  const charge=typeof intent.latest_charge==='object' ? intent.latest_charge : null;
  const live=requireTerminalEnvironment()==='live';
  if (intent.status!=='succeeded' || intent.livemode!==live || !charge || charge.livemode!==live ||
      charge.payment_intent!==intent.id || charge.status!=='succeeded' || !charge.paid || !charge.captured ||
      charge.amount!==intent.amount || charge.amount_captured!==intent.amount || charge.currency!=='usd' ||
      charge.payment_method_details?.type!=='card_present' || !charge.id ||
      !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded<0 || charge.amount_refunded>charge.amount ||
      !Number.isSafeInteger(charge.created) || charge.created<=0) {
    throw new TerminalError('A receipt is available only for a verified, completed Tap to Pay payment.',409);
  }
  return {...payment,charge,live};
}
export async function listTerminalReceipts(companyId:number,jobId:number) {
  positiveId(jobId);
  const db=await getDb();
  if(!await db.prepare('SELECT id FROM jobs WHERE company_id=? AND id=?').get(companyId,jobId))throw new TerminalError('Job not found',404);
  const receipts=await db.prepare(`SELECT attempt_id,amount_cents,created_at FROM terminal_attempts
    WHERE company_id=? AND job_id=? AND operation='payment' AND status='succeeded' AND payment_recorded=1
    ORDER BY created_at DESC,attempt_id DESC`).all<TerminalReceiptSummary>(companyId,jobId);
  return {receipts};
}
export async function getTerminalReceipt(companyId:number,id:string):Promise<TerminalReceiptView> {
  const {intent,charge,live}=await verified(companyId,id);
  return {attempt_id:id,amount_cents:intent.amount,refunded_cents:charge.amount_refunded,created:charge.created,
    receipt_url:receiptUrl(charge.receipt_url),test_mode:!live};
}
export async function requestTerminalReceipt(companyId:number,id:string,email:unknown):Promise<{status:'requested'|'test_only'}> {
  if(typeof email!=='string' || /[\u0000-\u001f\u007f]/.test(email))throw new TerminalError('Enter a valid receipt email address.');
  const recipient=email.trim();
  if(recipient.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new TerminalError('Enter a valid receipt email address.');
  const {intent,charge,stripe_account,live}=await verified(companyId,id);
  // Recheck after the provider lookup, before the only external side effect.
  if((await getCompany(companyId)).stripe_account_id!==stripe_account)throw new TerminalError('The payment account changed. Reopen the receipt.',409);
  if((requireTerminalEnvironment()==='live')!==live)throw new TerminalError('Payment environment changed. Reopen the receipt.',409);
  const hash=createHash('sha256').update(JSON.stringify([companyId,stripe_account,charge.id,recipient])).digest('hex');
  await getStripe().paymentIntents.update(intent.id,{receipt_email:recipient},{stripeAccount:stripe_account,idempotencyKey:`forge:receipt:${hash}`});
  return {status:live?'requested':'test_only'};
}
export async function terminalReceiptResponse(work:()=>Promise<unknown>) {
  const headers={'Cache-Control':'no-store'};
  try { return NextResponse.json(await work(),{headers}); }
  catch(error) {
    if(error instanceof TerminalError) {
      // Shared Terminal guards also serve pre-payment collection. Their fallback
      // wording must never instruct a second collection from this receipt surface.
      const message=error.status>=500
        ? 'Receipt configuration is unavailable. Contact support or retry the receipt; do not collect payment again.'
        : error.status===409
          ? 'This receipt could not be verified for the current payment account. Reopen the receipt or contact support; do not collect payment again.'
          : error.message;
      return NextResponse.json({error:message},{status:error.status,headers});
    }
    if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid receipt request.'},{status:400,headers});
    return NextResponse.json({error:'Unable to complete the receipt request. You can retry the receipt; do not collect payment again.'},{status:503,headers});
  }
}
