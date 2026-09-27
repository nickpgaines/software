"use client";

import {useEffect,useId,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {nativeTerminal,type NativeTerminal} from '@/lib/native-terminal';
import type {TerminalReceiptSummary,TerminalReceiptView} from '@/lib/terminal-receipts';

type Merchant={id:number;stripe_account_id:string|null};
type Lifecycle={active:boolean;generation:number;sequence:number;merchant:Merchant|null};
const money=(cents:number)=>`$${(cents/100).toFixed(2)}`;
const validEmail=(value:string)=>value.trim().length<=254 && !/[\u0000-\u001f\u007f]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
function safeUrl(value:string|null) {
  try {const url=new URL(value||'');return url.protocol==='https:'&&url.hostname==='pay.stripe.com'&&!url.port&&!url.username&&!url.password&&url.pathname.startsWith('/receipts/')?url.href:null;}
  catch{return null;}
}

/** Receipt-only operations: never owns the payment lock or invokes the reader. */
export default function TerminalReceipts({jobId,latestAttemptId,native=nativeTerminal}:{jobId:number;latestAttemptId?:string;native?:Pick<NativeTerminal,'generation'>}) {
  const inputId=useId();
  const [rows,setRows]=useState<TerminalReceiptSummary[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [receipt,setReceipt]=useState<TerminalReceiptView|null>(null);
  const [email,setEmail]=useState('');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const life=useRef<Lifecycle>({active:false,generation:native.generation,sequence:0,merchant:null});
  const sendLock=useRef(false);
  const valid=(token:Lifecycle)=>token===life.current&&token.active&&token.generation===native.generation;
  async function json<T>(token:Lifecycle,url:string,init?:RequestInit):Promise<T> {
    if(!valid(token))throw new Error('Session changed. Reopen checkout.');
    const response=await fetch(url,{cache:'no-store',...init});
    const data=await response.json();
    if(!valid(token))throw new Error('Session changed. Reopen checkout.');
    if(!response.ok)throw new Error(data.error||'Receipt unavailable. Retry the receipt; do not collect payment again.');
    return data;
  }
  async function identity(token:Lifecycle) {
    const next=await json<Merchant>(token,'/api/settings/company');
    if(token.merchant&&(token.merchant.id!==next.id||token.merchant.stripe_account_id!==next.stripe_account_id)) {
      setReceipt(null);setRows([]);setEmail('');
      throw new Error('Account changed. Close and reopen checkout to view receipts.');
    }
    token.merchant=next;
  }
  async function select(id:string,token=life.current,clear=true) {
    if(!valid(token)||sendLock.current)return;
    const sequence=++token.sequence;
    setSelected(id);setReceipt(null);setError('');setMessage('');setLoading(true);
    if(clear)setEmail('');
    try {
      await identity(token);
      const value=await json<TerminalReceiptView>(token,`/api/stripe/terminal/attempts/${encodeURIComponent(id)}/receipt`);
      await identity(token);
      if(!valid(token)||sequence!==token.sequence)return;
      if(value.attempt_id!==id)throw new Error('Receipt did not match the selected payment. Retry the receipt.');
      setReceipt(value);
    } catch(e) {if(valid(token)&&sequence===token.sequence)setError(e instanceof Error?e.message:'Receipt unavailable.');}
    finally {if(valid(token)&&sequence===token.sequence)setLoading(false);}
  }
  async function load(token:Lifecycle) {
    setLoading(true);setError('');
    try {
      await identity(token);
      const data=await json<{receipts:TerminalReceiptSummary[]}>(token,`/api/stripe/terminal/receipts?job_id=${jobId}`);
      await identity(token);
      if(!valid(token))return;
      setRows(data.receipts);
      const id=data.receipts.find(row=>row.attempt_id===latestAttemptId)?.attempt_id??(data.receipts.length===1?data.receipts[0].attempt_id:null);
      if(id)await select(id,token);
    } catch(e) {if(valid(token))setError(e instanceof Error?e.message:'Receipt history unavailable.');}
    finally {if(valid(token))setLoading(false);}
  }
  useEffect(()=>{
    const token:Lifecycle={active:true,generation:native.generation,sequence:0,merchant:null};
    life.current=token;sendLock.current=false;
    setRows([]);setSelected(null);setReceipt(null);setEmail('');setMessage('');setSending(false);
    void load(token);
    return()=>{token.active=false;};
    // Job/payment changes invalidate pending receipt work; no financial state is affected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jobId,latestAttemptId,native]);
  async function send() {
    const token=life.current;
    if(!valid(token)||sendLock.current||!receipt||!validEmail(email))return;
    sendLock.current=true;setSending(true);setError('');setMessage('');
    const id=receipt.attempt_id;
    try {
      await identity(token);
      const response=await json<{status:string}>(token,`/api/stripe/terminal/attempts/${encodeURIComponent(id)}/receipt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim()})});
      await identity(token);
      if(!valid(token))return;
      if(response.status!=='requested'&&response.status!=='test_only')throw new Error('Receipt request could not be verified. Do not collect payment again.');
      setMessage(response.status==='test_only'?'Test receipt recorded. Stripe does not automatically email test payment receipts.':'Receipt email requested. Ask the customer to check their inbox and spam folder.');
    } catch(e) {if(valid(token))setError(e instanceof Error?e.message:'Receipt request failed. Do not collect payment again.');}
    finally {if(valid(token)){sendLock.current=false;setSending(false);}}
  }
  if(!valid(life.current)||(!loading&&!error&&!rows.length))return null;
  const url=receipt?safeUrl(receipt.receipt_url):null;
  return <section aria-label="Tap to Pay receipts" className="space-y-3 rounded-2xl border border-line bg-card p-4">
    <h4 className="text-base font-bold text-fg">Payment receipt</h4>
    {rows.length>1&&<div className="flex flex-col gap-2">{rows.map(row=><Button key={row.attempt_id} type="button" variant="outline" className="h-auto justify-start whitespace-normal text-left" disabled={sending} aria-pressed={selected===row.attempt_id} onClick={()=>select(row.attempt_id)}>{money(row.amount_cents)} · {row.created_at.replace('T',' ').slice(0,16)} UTC</Button>)}</div>}
    {loading&&<p role="status" className="text-sm text-fg-muted">Loading receipt…</p>}
    {receipt&&<>
      <p className="text-sm text-fg">Payment confirmed · <span className="font-bold tabular-nums">{money(receipt.amount_cents)}</span></p>
      {receipt.refunded_cents>0&&<p className="text-sm text-fg-muted">Refunded: {money(receipt.refunded_cents)}. The Stripe receipt shows the latest payment status.</p>}
      {receipt.test_mode&&<p className="text-sm text-fg-muted">Test payment — no real money was charged. Receipt emails are not sent automatically.</p>}
      {url&&<Button asChild variant="outline"><a href={url} target="_blank" rel="noopener noreferrer">View Stripe receipt</a></Button>}
      <div className="space-y-2">
        <Label htmlFor={inputId}>Receipt email</Label>
        <Input id={inputId} type="email" autoComplete="off" inputMode="email" maxLength={254} value={email} disabled={sending} placeholder="customer@example.com" onChange={e=>{setEmail(e.target.value);setMessage('');}}/>
        <p className="text-xs text-fg-muted">Confirm the address with the customer. This won’t change their saved contact details.</p>
        <Button type="button" className="w-full" disabled={sending||!validEmail(email)} onClick={send}>{sending?'Requesting receipt…':'Email receipt'}</Button>
      </div>
    </>}
    {message&&<p role="status" className="text-sm text-fg-muted">{message}</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {error&&!receipt&&!loading&&<Button type="button" variant="outline" onClick={()=>selected?select(selected,life.current,false):load(life.current)}>Retry receipt</Button>}
  </section>;
}
