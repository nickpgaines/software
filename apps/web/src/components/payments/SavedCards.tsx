"use client";

import { useEffect, useRef, useState } from 'react';
import type { CustomerSubscription } from '@/lib/db';
import { nativeTerminal } from '@/lib/native-terminal';
import TerminalFlow from './TerminalFlow';

export type SavedCard = {
  id: number; brand: string | null; last4: string | null;
  recurring_only?: number; requires_explicit_selection?: number;
};
export function savedCardLabel(card: SavedCard) {
  return `${card.brand || 'Card'} •••• ${card.last4 || '—'}${card.recurring_only ? ' — recurring / off-session only' : ''}`;
}

export function useSavedCards(customerId: number | null, refresh = 0) {
  const [result, setResult] = useState<{customerId: number | null; cards: SavedCard[]; error: string | null}>({customerId:null,cards:[],error:null});
  useEffect(() => {
    let active = true;
    const generation = nativeTerminal.generation;
    if (!customerId) return;
    void fetch(`/api/stripe/customers/${customerId}/payment-methods`, {cache:'no-store'})
      .then(async response => { if (!response.ok) throw new Error('Unable to load saved cards.'); return response.json(); })
      .then(data => { if (active && generation === nativeTerminal.generation) setResult({customerId,cards:data.payment_methods || [],error:null}); })
      .catch(() => { if (active && generation === nativeTerminal.generation) setResult({customerId,cards:[],error:'Unable to load saved cards.'}); });
    return () => { active = false; };
  }, [customerId, refresh]);
  return result.customerId === customerId ? result : {customerId,cards:[],error:null};
}

export function CustomerPaymentMethods({customerId,onChanged}:{customerId:number;onChanged:()=>void}) {
  const [refresh,setRefresh] = useState(0);
  const [open,setOpen] = useState(false);
  const {cards,error} = useSavedCards(customerId,refresh);
  return <div className="space-y-3">
    {error ? <p role="alert">{error}</p> : cards.length ? <ul className="space-y-2">{cards.map(card=><li key={card.id}>{savedCardLabel(card)}{card.requires_explicit_selection ? <span className="block text-xs text-zinc-400">Choose explicitly on an accepted subscription to use for recurring billing.</span> : null}</li>)}</ul> : <p className="text-zinc-500">No card on file.</p>}
    <button type="button" className="text-sm underline" onClick={()=>setOpen(!open)}>{open ? 'Close tap-to-save' : 'Save card with a tap'}</button>
    {open && <TerminalFlow key={customerId} operation="setup" customerId={customerId} onSuccess={()=>{setRefresh(n=>n+1);onChanged();}}/>}
    <p className="text-xs text-zinc-400">Saving a card does not start billing. For manual card entry, send the customer their subscription acceptance link or use Pay with card during job checkout.</p>
  </div>;
}

type SubscriptionSelection = Pick<CustomerSubscription,'id'|'customer_id'|'accepted_at'|'require_signature'|'signature_data'|'status'>;
export function SubscriptionCardAssignment({subscription,onChanged}:{subscription:SubscriptionSelection;onChanged:()=>void}) {
  const {cards,error} = useSavedCards(subscription.customer_id);
  const [selection,setSelection] = useState<{subscriptionId:number;id:string}|null>(null);
  const selected = selection?.subscriptionId === subscription.id ? selection.id : '';
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);
  const life = useRef({active:true,generation:nativeTerminal.generation});
  useEffect(()=>{const token={active:true,generation:nativeTerminal.generation};life.current=token;return()=>{token.active=false;};},[subscription.id]);
  const allowed = !!subscription.accepted_at && (!subscription.require_signature || !!subscription.signature_data) && !['canceled','declined'].includes(subscription.status);
  async function assign() {
    const token=life.current;
    if(lock.current || !allowed || !selected || !token.active || token.generation!==nativeTerminal.generation) return;
    lock.current=true;setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/customer-subscriptions/${subscription.id}/payment-method`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_method_id:Number(selected)})});
      const data=await response.json();
      if(!token.active || token!==life.current || token.generation!==nativeTerminal.generation) return;
      if(!response.ok) throw new Error(data.error || 'Unable to select card.');
      setMessage('Card selected. No immediate charge was made.');onChanged();
    } catch(error) {if(token.active && token===life.current && token.generation===nativeTerminal.generation) setMessage(error instanceof Error ? error.message : 'Unable to select card.');}
    finally {lock.current=false;if(token.active && token===life.current)setBusy(false);}
  }
  if(!allowed) return <p className="text-xs text-zinc-400">The subscription must be accepted and signed before selecting a saved card.</p>;
  return <div className="space-y-2 text-left text-xs">
    <label>Recurring billing card<select aria-label="Recurring billing card" className="block max-w-full bg-card border border-line rounded p-1" value={selected} disabled={busy} onChange={e=>setSelection({subscriptionId:subscription.id,id:e.target.value})}>
      <option value="">Choose a saved card…</option>{cards.map(card=><option key={card.id} value={card.id}>{savedCardLabel(card)}</option>)}
    </select></label>
    <button type="button" disabled={busy || !selected} className="underline disabled:opacity-50" onClick={assign}>Use selected card</button>
    <p>This changes the card for agreed recurring billing. It does not activate a plan or charge now.</p>
    {(message || error) && <p role="status">{message || error}</p>}
  </div>;
}
