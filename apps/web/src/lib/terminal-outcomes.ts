import {randomUUID} from 'node:crypto';
import type Stripe from 'stripe';
import {getDb} from '@/lib/db';
import {getStripe} from '@/lib/stripe';
import {getTerminalOutcomeIntent} from '@/lib/terminal-attempts';
import {requireTerminalEnvironment} from '@/lib/terminal-environment';
import {TerminalError} from '@/lib/terminal-http';

export type TerminalOutcomeKind='approved'|'declined'|'canceled';
type Evidence=Awaited<ReturnType<typeof getTerminalOutcomeIntent>>;
export type TerminalOutcomeSummary={amount_cents:number;currency:'usd';operation:'payment'|'setup';brand?:string;last4?:string;application_name?:string;application_id?:string};
export function safeTerminalText(value:unknown,max=80):string|undefined {
  if(typeof value!=='string')return;
  const clean=value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,max);
  return clean || undefined;
}
function timestamp(seconds:number) {
  if(!Number.isSafeInteger(seconds) || seconds<=0 || seconds>253402300799)throw new TerminalError('Transaction time could not be verified.',409);
  return new Date(seconds*1000).toISOString();
}
export function verifyDeclinedTerminalCharge(evidence:Evidence,charge:Stripe.Charge):TerminalOutcomeSummary {
  const {attempt,intent}=evidence;
  const metadata=charge.metadata || {};
  if(attempt.operation!=='payment' || charge.payment_intent!==intent.id || charge.livemode!==intent.livemode ||
    !/^ch_[A-Za-z0-9_]+$/.test(charge.id) || charge.amount!==attempt.amount_cents || charge.currency!=='usd' ||
    charge.status!=='failed' || charge.paid!==false || charge.payment_method_details?.type!=='card_present' ||
    metadata.terminal_attempt_id!==attempt.attempt_id || metadata.company_id!==String(attempt.company_id) ||
    metadata.customer_id!==String(attempt.customer_id) || metadata.job_id!==String(attempt.job_id) || metadata.operation!=='payment') {
    throw new TerminalError('This declined tap could not be verified.',409);
  }
  timestamp(charge.created);
  const card=charge.payment_method_details.card_present;
  return {amount_cents:attempt.amount_cents,currency:'usd',operation:'payment',
    brand:safeTerminalText(card?.brand,30),last4:card?.last4 && /^\d{4}$/.test(card.last4)?card.last4:undefined,
    application_name:safeTerminalText(card?.receipt?.application_preferred_name),
    application_id:card?.receipt?.dedicated_file_name && /^[A-Fa-f0-9]{10,32}$/.test(card.receipt.dedicated_file_name)?card.receipt.dedicated_file_name:undefined};
}

export async function observeTerminalOutcome(companyId:number,attemptId:string,evidence:{eventId?:string;chargeId?:string}={}):Promise<void> {
  const db=await getDb();
  // Legacy attempts stay recoverable without manufacturing historical alerts.
  const owned=await db.prepare('SELECT initiating_staff_id,provider_intent_id FROM terminal_attempts WHERE company_id=? AND attempt_id=?').get<{initiating_staff_id:number|null;provider_intent_id:string|null}>(companyId,attemptId);
  if(!owned?.initiating_staff_id || !owned.provider_intent_id)return;
  const verified=await getTerminalOutcomeIntent(companyId,attemptId);
  const {attempt,intent}=verified;
  const observations:Array<{objectId:string;kind:TerminalOutcomeKind;at:string;summary:TerminalOutcomeSummary}>=[];
  if(attempt.operation==='payment') {
    const stripe=getStripe(),options={stripeAccount:attempt.stripe_account_id};
    let charges:Stripe.Charge[];
    if(evidence.chargeId)charges=[await stripe.charges.retrieve(evidence.chargeId,{},options)];
    else {
      // Keep interactive reconciliation bounded. Incomplete history is an
      // explicit retryable failure, never a claim that every tap was observed.
      const page=await stripe.charges.list({payment_intent:intent.id,limit:100},options);
      if(page.has_more)throw new TerminalError('Payment history needs support review. Do not collect again.',503);
      charges=page.data.filter(charge=>charge.status==='failed');
    }
    for(const charge of charges) {
      if(evidence.chargeId && charge.id!==evidence.chargeId)throw new TerminalError('Unexpected transaction.',409);
      observations.push({objectId:charge.id,kind:'declined',at:timestamp(charge.created),summary:verifyDeclinedTerminalCharge(verified,charge)});
    }
  } else if(evidence.chargeId)throw new TerminalError('Save-only attempts do not have declined payment documents.',409);
  if(intent.status==='canceled' || (intent.status==='succeeded' && (attempt.operation==='setup' || attempt.payment_recorded))) {
    observations.push({objectId:intent.id,kind:intent.status==='canceled'?'canceled':'approved',
      at:timestamp(('canceled_at' in intent && intent.canceled_at) || intent.created),
      summary:{amount_cents:attempt.amount_cents,currency:'usd',operation:attempt.operation}});
  }
  await db.transaction(async tx=>{
    const company=await tx.prepare('SELECT stripe_account_id FROM company WHERE id=?').get<{stripe_account_id:string}>(companyId);
    if(company?.stripe_account_id!==attempt.stripe_account_id || intent.livemode!==(requireTerminalEnvironment()==='live'))throw new TerminalError('The payment account changed. Reopen payment status.',409);
    if(!await tx.prepare('SELECT id FROM staff WHERE id=? AND company_id=?').get(owned.initiating_staff_id,companyId))return;
    for(const item of observations) {
      const result=await tx.prepare(`INSERT OR IGNORE INTO terminal_outcomes (id,company_id,attempt_id,stripe_account,provider_object_id,kind,occurred_at,summary_json) VALUES (?,?,?,?,?,?,?,?)`)
        .run(randomUUID(),companyId,attemptId,attempt.stripe_account_id,item.objectId,item.kind,item.at,JSON.stringify(item.summary));
      if(Number(result.changes)>0)await tx.prepare('UPDATE terminal_attempts SET outcome_revision=outcome_revision+1 WHERE company_id=? AND attempt_id=?').run(companyId,attemptId);
    }
  });
}

export async function handleTerminalChargeWebhook(charge:Stripe.Charge,account:string|undefined,eventId:string):Promise<boolean> {
  const attemptId=charge.metadata?.terminal_attempt_id;
  if(!attemptId)return false;
  if(!account)throw new TerminalError('Missing payment account.',409);
  const row=await (await getDb()).prepare('SELECT company_id FROM terminal_attempts WHERE attempt_id=? AND stripe_account_id=?').get<{company_id:number}>(attemptId,account);
  if(!row)throw new TerminalError('Unexpected payment account.',409);
  await observeTerminalOutcome(row.company_id,attemptId,{eventId,chargeId:charge.id});
  return true;
}

type NoticeAuth={companyId:number;staffId:number|null};
export type TerminalNotice={id:string;attempt_id:string;job_id:number|null;customer_id:number;kind:TerminalOutcomeKind|'attention';occurred_at:string;current_attempt_unresolved:boolean;summary:TerminalOutcomeSummary};
type NoticeRow=Omit<TerminalNotice,'summary'|'current_attempt_unresolved'> & {summary_json:string;current_attempt_unresolved:number};
const eligibleActor=`FROM terminal_attempts a JOIN company c ON c.id=a.company_id AND c.stripe_account_id=a.stripe_account_id
  JOIN staff s ON s.id=a.initiating_staff_id AND s.company_id=a.company_id`;
export async function listTerminalNotices(auth:NoticeAuth):Promise<{notices:TerminalNotice[]}> {
  if(!auth.staffId)return {notices:[]};
  const db=await getDb();
  const rows=await db.prepare(`SELECT * FROM (
    SELECT o.id,a.attempt_id,a.job_id,a.customer_id,o.kind,o.occurred_at,o.summary_json,
      (a.status NOT IN ('succeeded','canceled')) AS current_attempt_unresolved
      ${eligibleActor} JOIN terminal_outcomes o ON o.attempt_id=a.attempt_id AND o.company_id=a.company_id AND o.stripe_account=a.stripe_account_id
      WHERE a.company_id=? AND s.id=?
    UNION ALL
    SELECT 'attention:'||a.attempt_id||':'||a.outcome_revision,a.attempt_id,a.job_id,a.customer_id,'attention',a.updated_at,
      json_object('amount_cents',a.amount_cents,'currency','usd','operation',a.operation),1
      ${eligibleActor} WHERE a.company_id=? AND s.id=? AND a.status NOT IN ('succeeded','canceled')
  ) n WHERE NOT EXISTS (SELECT 1 FROM terminal_notice_acknowledgments ack WHERE ack.company_id=? AND ack.staff_id=? AND ack.notice_id=n.id)
  ORDER BY occurred_at DESC,id DESC LIMIT 25`).all<NoticeRow>(auth.companyId,auth.staffId,auth.companyId,auth.staffId,auth.companyId,auth.staffId);
  return {notices:rows.map(({summary_json,current_attempt_unresolved,...row})=>({...row,summary:JSON.parse(summary_json),current_attempt_unresolved:!!current_attempt_unresolved}))};
}
export async function acknowledgeTerminalNotice(auth:NoticeAuth,noticeId:string):Promise<void> {
  if(!auth.staffId || typeof noticeId!=='string' || noticeId.length>150)throw new TerminalError('Notice not found.',404);
  const db=await getDb();
  await db.transaction(async tx=>{
    const attention=/^attention:([^:]+):(0|[1-9]\d*)$/.exec(noticeId);
    const row=attention
      ? await tx.prepare(`SELECT a.attempt_id ${eligibleActor} WHERE a.company_id=? AND s.id=? AND a.attempt_id=? AND a.outcome_revision>=?`).get(auth.companyId,auth.staffId,attention[1],Number(attention[2]))
      : await tx.prepare(`SELECT a.attempt_id ${eligibleActor} JOIN terminal_outcomes o ON o.attempt_id=a.attempt_id AND o.company_id=a.company_id AND o.stripe_account=a.stripe_account_id WHERE a.company_id=? AND s.id=? AND o.id=?`).get(auth.companyId,auth.staffId,noticeId);
    if(!row)throw new TerminalError('Notice not found.',404);
    await tx.prepare('INSERT OR IGNORE INTO terminal_notice_acknowledgments (company_id,staff_id,notice_id) VALUES (?,?,?)').run(auth.companyId,auth.staffId,noticeId);
  });
}
