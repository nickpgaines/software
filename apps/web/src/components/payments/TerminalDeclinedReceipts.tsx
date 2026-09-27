"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {nativeTerminal,type NativeTerminal} from '@/lib/native-terminal';
import type {TerminalDeclineSummary} from '@/lib/terminal-declined-receipts';

export default function TerminalDeclinedReceipts({jobId,native=nativeTerminal}:{jobId:number;native?:Pick<NativeTerminal,'generation'|'shareDeclinedDocument'>}) {
  const [rows,setRows]=useState<TerminalDeclineSummary[]>([]);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const life=useRef({active:false,generation:native.generation,merchant:''});
  const lock=useRef(false);
  const valid=(token:typeof life.current)=>token===life.current&&token.active&&token.generation===native.generation;
  async function json<T>(token:typeof life.current,url:string):Promise<T> {
    if(!valid(token))throw Error('Session changed');
    const response=await fetch(url,{cache:'no-store'});const data=await response.json();
    if(!valid(token))throw Error('Session changed');
    if(!response.ok)throw Error('Document unavailable.');return data;
  }
  async function identity(token:typeof life.current) {
    const company=await json<{id:number;stripe_account_id:string|null}>(token,'/api/settings/company');
    const key=JSON.stringify([company.id,company.stripe_account_id]);
    if(token.merchant&&token.merchant!==key){setRows([]);throw Error('Account changed.');}
    token.merchant=key;
  }
  async function load(token:typeof life.current) {
    try {
      await identity(token);
      const data=await json<{declines:TerminalDeclineSummary[]}>(token,`/api/stripe/terminal/declines?job_id=${jobId}`);
      await identity(token);if(valid(token))setRows(data.declines);
    } catch {if(valid(token))setError('Declined tap history is unavailable. Retry later; do not collect payment again.');}
  }
  useEffect(()=>{
    const token={active:true,generation:native.generation,merchant:''};life.current=token;lock.current=false;
    setRows([]);setMessage('');setError('');setBusy(null);void load(token);
    return()=>{token.active=false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jobId,native]);
  async function share(row:TerminalDeclineSummary) {
    const token=life.current;if(lock.current||!valid(token))return;
    lock.current=true;setBusy(row.id);setError('');setMessage('');
    try {
      await identity(token);
      const document=await json<{filename:string;text:string}>(token,`/api/stripe/terminal/attempts/${encodeURIComponent(row.attempt_id)}/declines/${encodeURIComponent(row.id)}`);
      await identity(token);if(!valid(token))return;
      const result=await native.shareDeclinedDocument({title:'Declined transaction',text:document.text});
      if(!valid(token))return;
      if(result)setMessage(result.status==='canceled'?'Sharing canceled. The document is still available.':'Share action completed. Confirm receipt with the customer.');
      else {
        const url=URL.createObjectURL(new Blob([document.text],{type:'text/plain;charset=utf-8'}));
        const link=window.document.createElement('a');link.href=url;link.download='declined-transaction.txt';
        window.document.body.appendChild(link);link.click();link.remove();
        // Let the browser consume the URL before revoking the private payload.
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        setMessage('Document downloaded. Share it only with the intended recipient.');
      }
    } catch {if(valid(token))setError('Document sharing is unavailable. You can retry sharing. Do not collect payment again.');}
    finally {if(valid(token)){lock.current=false;setBusy(null);}}
  }
  if(!valid(life.current)||(!rows.length&&!error))return null;
  return <section aria-label="Declined tap documents" className="space-y-3 rounded-2xl border border-line bg-card p-4">
    <h4 className="text-base font-bold text-fg">Declined taps</h4>
    <p className="text-sm text-fg-muted">Historical tap results — not proof of payment. A later payment may have succeeded.</p>
    {rows.map(row=><div key={row.id} className="space-y-2 border-t border-line pt-3">
      <p className="text-sm text-fg-muted">${(row.amount_cents/100).toFixed(2)} · {row.occurred_at.replace('T',' ').slice(0,16)} UTC</p>
      <Button type="button" variant="outline" disabled={!!busy} onClick={()=>share(row)}>{busy===row.id?'Preparing document…':'Share declined transaction'}</Button>
    </div>)}
    {message&&<p role="status" className="text-sm text-fg-muted">{message}</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {error&&!rows.length&&<Button variant="outline" onClick={()=>{setError('');void load(life.current);}}>Retry history</Button>}
  </section>;
}
