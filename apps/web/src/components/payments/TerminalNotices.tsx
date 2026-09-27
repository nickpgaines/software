"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {nativeTerminal,type NativeTerminal} from '@/lib/native-terminal';
import type {TerminalNotice} from '@/lib/terminal-outcomes';

export default function TerminalNotices({identityKey,native=nativeTerminal}:{identityKey:string;native?:Pick<NativeTerminal,'generation'>}) {
  const [rows,setRows]=useState<TerminalNotice[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const life=useRef({active:false,generation:native.generation,sequence:0});
  const request=useRef<AbortController|null>(null);
  const valid=(token:typeof life.current)=>token===life.current&&token.active&&token.generation===native.generation;
  const visible=()=>document.visibilityState!=='hidden';
  async function refresh() {
    if(!visible())return;
    const token=life.current;if(!valid(token))return;
    const sequence=++token.sequence;request.current?.abort();
    const controller=new AbortController();request.current=controller;
    setLoading(true);setError('');
    try {
      const response=await fetch('/api/stripe/terminal/notices',{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('unavailable');
      const data=await response.json();
      if(valid(token)&&sequence===token.sequence&&visible())setRows(data.notices);
    } catch {
      if(valid(token)&&sequence===token.sequence&&!controller.signal.aborted)setError('Payment updates are temporarily unavailable. Open the original job to check payment status.');
    } finally {if(valid(token)&&sequence===token.sequence)setLoading(false);}
  }
  useEffect(()=>{
    const token={active:true,generation:native.generation,sequence:0};life.current=token;
    setRows([]);setError('');setBusy(null);
    const visibility=()=>{
      if(document.visibilityState==='hidden'){token.sequence++;request.current?.abort();setRows([]);setLoading(false);}
      else void refresh();
    };
    window.addEventListener('focus',visibility);document.addEventListener('visibilitychange',visibility);
    const app=import('@capacitor/app').then(({App})=>App.addListener('appStateChange',({isActive})=>{if(token.active&&isActive)visibility();})).catch(()=>undefined);
    void refresh();
    return()=>{token.active=false;request.current?.abort();window.removeEventListener('focus',visibility);document.removeEventListener('visibilitychange',visibility);void app.then(handle=>handle?.remove());};
    // The authenticated identity owns every pending response and acknowledgment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[identityKey,native]);
  async function dismiss(id:string) {
    const token=life.current;
    if(!valid(token)||busy||document.visibilityState==='hidden'||!rows.some(row=>row.id===id))return;
    setBusy(id);setError('');
    try {
      const response=await fetch(`/api/stripe/terminal/notices/${encodeURIComponent(id)}/ack`,{method:'POST',cache:'no-store'});
      if(!response.ok)throw Error('unavailable');
      if(valid(token))setRows(current=>current.filter(row=>row.id!==id));
    } catch {if(valid(token))setError('The notice could not be dismissed. Its payment status has not changed.');}
    finally {if(valid(token))setBusy(null);}
  }
  if(!valid(life.current)||(!rows.length&&!error&&!loading))return null;
  return <section aria-label="Tap to Pay updates" className="mx-auto mb-4 w-full max-w-7xl space-y-3 px-4">
    {loading&&!rows.length&&<p role="status" className="text-sm text-fg-muted">Checking payment updates…</p>}
    {rows.map(row=><div key={row.id} className="rounded-2xl border border-line bg-card p-4 text-fg">
      <h2 className="text-base font-bold">{row.kind==='attention'?'Check payment status':row.kind==='declined'?'This tap was declined':row.kind==='canceled'?'Tap attempt canceled':row.summary.operation==='setup'?'Card setup confirmed':'Payment confirmed'}</h2>
      <p className="mt-1 text-sm text-fg-muted">{row.job_id?`Job #${row.job_id} · $${(row.summary.amount_cents/100).toFixed(2)}`:'Saved-card attempt'}{row.kind==='declined'?' · Historical tap result.':''}</p>
      {row.current_attempt_unresolved&&<p className="mt-1 text-sm text-fg-muted">The current attempt still needs checking. Do not take another payment until its status is confirmed.</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button asChild variant="outline"><a href={`${row.job_id?`/schedule/${row.job_id}`:`/customers/${row.customer_id}`}?terminalAttempt=${encodeURIComponent(row.attempt_id)}`}>{row.current_attempt_unresolved?'Check payment status':'View attempt'}</a></Button>
        <Button type="button" variant="ghost" disabled={!!busy} onClick={()=>dismiss(row.id)}>{busy===row.id?'Dismissing…':'Dismiss notice'}</Button>
      </div>
    </div>)}
    {error&&<div role="status" className="rounded-2xl border border-line bg-card p-4 text-sm text-fg-muted">{error}<Button variant="link" disabled={loading} onClick={()=>refresh()}>Retry updates</Button></div>}
  </section>;
}
