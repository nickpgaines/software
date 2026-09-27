import {getDb} from '@/lib/db';
import {getStripe,getCompany} from '@/lib/stripe';
import {getTerminalOutcomeIntent} from '@/lib/terminal-attempts';
import {safeTerminalText,verifyDeclinedTerminalCharge} from '@/lib/terminal-outcomes';
import {positiveId,TerminalError} from '@/lib/terminal-http';
import {requireTerminalEnvironment} from '@/lib/terminal-environment';

export type TerminalDeclineSummary={id:string;attempt_id:string;amount_cents:number;occurred_at:string};
export async function listDeclinedTerminalDocuments(companyId:number,jobId:number) {
  positiveId(jobId);const db=await getDb();
  if(!await db.prepare('SELECT id FROM jobs WHERE company_id=? AND id=?').get(companyId,jobId))throw new TerminalError('Job not found.',404);
  const declines=await db.prepare(`SELECT o.id,a.attempt_id,a.amount_cents,o.occurred_at FROM terminal_outcomes o
    JOIN terminal_attempts a ON a.attempt_id=o.attempt_id AND a.company_id=o.company_id AND a.stripe_account_id=o.stripe_account
    JOIN company c ON c.id=a.company_id AND c.stripe_account_id=o.stripe_account
    WHERE a.company_id=? AND a.job_id=? AND a.operation='payment' AND o.kind='declined' ORDER BY o.occurred_at DESC,o.id DESC`).all<TerminalDeclineSummary>(companyId,jobId);
  return {declines};
}
export async function getDeclinedTerminalDocument(companyId:number,attemptId:string,outcomeId:string):Promise<{filename:string;text:string}> {
  const db=await getDb();
  const observation=await db.prepare(`SELECT stripe_account,provider_object_id FROM terminal_outcomes WHERE company_id=? AND attempt_id=? AND id=? AND kind='declined'`).get<{stripe_account:string;provider_object_id:string}>(companyId,attemptId,outcomeId);
  if(!observation)throw new TerminalError('Verified declined tap not found.',404);
  const evidence=await getTerminalOutcomeIntent(companyId,attemptId);
  if(evidence.attempt.stripe_account_id!==observation.stripe_account)throw new TerminalError('Transaction account changed.',409);
  const charge=await getStripe().charges.retrieve(observation.provider_object_id,{}, {stripeAccount:observation.stripe_account});
  if(charge.id!==observation.provider_object_id)throw new TerminalError('Unexpected transaction.',409);
  const summary=verifyDeclinedTerminalCharge(evidence,charge);
  const company=await getCompany(companyId);
  if(company.stripe_account_id!==observation.stripe_account || charge.livemode!==(requireTerminalEnvironment()==='live'))throw new TerminalError('Transaction account changed.',409);
  const lines=[
    'Declined transaction — not proof of payment',
    `Merchant: ${safeTerminalText(company.name,120) || 'Merchant'}`,
    `Amount: USD ${(summary.amount_cents/100).toFixed(2)}`,
    `Transaction time: ${new Date(charge.created*1000).toISOString()}`,
    `Reference: ${safeTerminalText(charge.id,100)}`,
    'Result: Declined',
    summary.brand?`Card network: ${summary.brand}`:null,
    summary.last4?`Card ending: ${summary.last4}`:null,
    summary.application_name?`Application: ${summary.application_name}`:null,
    summary.application_id?`Application ID: ${summary.application_id}`:null,
    charge.livemode?null:'Test transaction — no real money was charged.',
    '',
    'This document describes one historical tap only. It does not establish the current balance or the outcome of any later payment.',
    'Check the original payment attempt before collecting again.',
  ];
  return {filename:'declined-transaction.txt',text:lines.filter(line=>line!==null).join('\n')};
}
