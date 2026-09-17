"use client";

import { useEffect, useRef, useState } from 'react';
import { nativeTerminal, type NativeTerminal } from '@/lib/native-terminal';
import { TERMINAL_CONSENT_VERSION, terminalConsentText } from '@/lib/terminal-consent';
import type { TerminalAttemptView } from '@/lib/terminal-attempts';

type Props = {
  operation: 'payment' | 'setup'; jobId?: number; customerId?: number;
  onSuccess: (attempt: TerminalAttemptView) => void;
  onBlockedChange?: (blocked: boolean) => void;
  native?: Pick<NativeTerminal, 'generation' | 'capabilities' | 'education' | 'collect' | 'cancel'>;
};
type Merchant = { id: number; name: string; stripe_account_id: string | null };
type Lifecycle = { active: boolean; generation: number; lease: symbol };
const recoveryMessage = 'The outcome is not confirmed. Check status before taking another payment. You can close this window and recover the attempt later.';
const closed = (a: TerminalAttemptView) => a.status === 'canceled' || (a.status === 'succeeded' && (a.operation === 'setup' || a.payment_recorded));
// An unacknowledged creation cannot be retried with a different key merely
// because a concurrent listing is empty. Keep this block across modal dismissal.
const uncertainCreations = new Set<string>();

export default function TerminalFlow({ operation, jobId, customerId, onSuccess, onBlockedChange, native = nativeTerminal }: Props) {
  const [capability, setCapability] = useState<{supported: boolean; reason?: string} | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [attempt, setAttempt] = useState<TerminalAttemptView | null>(null);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState('');
  const [save, setSave] = useState(operation === 'setup');
  const [busy, setBusy] = useState(true);
  const [uncertain, setUncertain] = useState(true);
  const [message, setMessage] = useState('Checking for unfinished attempts…');
  const life = useRef<Lifecycle>({ active: false, generation: native.generation, lease: Symbol() });
  const lock = useRef(true);
  const current = useRef<TerminalAttemptView | null>(null);
  const identity = useRef<Merchant | null>(null);
  const delivered = useRef<string | null>(null);
  const callbacks = useRef({ onSuccess, onBlockedChange });
  callbacks.current = { onSuccess, onBlockedChange };
  const query = operation === 'payment' ? `job_id=${jobId}` : `customer_id=${customerId}`;
  const recoveryKey = () => `forge-terminal:${identity.current?.id}:${identity.current?.stripe_account_id}:${query}`;
  const valid = (token = life.current) => token === life.current && token.active && token.generation === native.generation;
  const block = (value: boolean) => { if (valid()) { setUncertain(value); callbacks.current.onBlockedChange?.(value); } };

  async function json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { cache: 'no-store', ...init });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Unable to check the Terminal attempt.'), {status:response.status});
    return data as T;
  }
  async function checkIdentity(token: Lifecycle) {
    if (!valid(token)) throw new Error('Session changed. Reopen checkout.');
    const next = await json<Merchant>('/api/settings/company');
    if (!valid(token)) throw new Error('Session changed. Reopen checkout.');
    const previous = identity.current;
    if (previous && (next.id !== previous.id || next.stripe_account_id !== previous.stripe_account_id)) {
      life.current.active = false;
      if (current.current) void native.cancel(current.current.attempt_id, token.lease);
      setMessage('Account changed. Close and reopen this window to continue.');
      throw new Error('Account changed.');
    }
    identity.current = next;
    setMerchant(next);
  }
  function receive(next: TerminalAttemptView, token: Lifecycle, holdBlock = false) {
    if (!valid(token)) return;
    if (next.operation !== operation || (operation === 'payment' ? next.job_id !== jobId : next.customer_id !== customerId) || next.stripe_account !== identity.current?.stripe_account_id) throw new Error('Attempt does not match the current account and target.');
    current.current = next;
    uncertainCreations.delete(recoveryKey());
    try {
      if (closed(next)) sessionStorage.removeItem(recoveryKey());
      else sessionStorage.setItem(recoveryKey(), next.attempt_id);
    } catch { /* Server listing remains authoritative when storage is unavailable. */ }
    setAttempt(next);
    block(holdBlock || !closed(next));
    if (next.status === 'succeeded' && closed(next)) {
      setMessage(next.operation === 'payment' ? 'Payment confirmed.' : next.card_saved ? 'Card saved. No charge was made and no subscription was started.' : 'Card was not saved. No charge was made.');
      if (delivered.current !== next.attempt_id) { delivered.current = next.attempt_id; callbacks.current.onSuccess(next); }
    } else setMessage(next.status === 'canceled' ? 'Attempt canceled. You can choose another payment method.' : recoveryMessage);
  }
  async function reconcile(id: string, token: Lifecycle, action = 'reconcile', holdBlock = false) {
    await checkIdentity(token);
    const next = await json<TerminalAttemptView>(`/api/stripe/terminal/attempts/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    receive(next, token, holdBlock);
    return next;
  }
  async function recover(token: Lifecycle, checked?: TerminalAttemptView) {
    await checkIdentity(token);
    block(true);
    let remembered: string | null = current.current?.attempt_id ?? null;
    if (!remembered) {
      try { remembered = sessionStorage.getItem(recoveryKey()); } catch { /* Optional recovery hint only. */ }
    }
    if (remembered) {
      const next = checked?.attempt_id === remembered ? checked : await reconcile(remembered, token, 'reconcile', true);
      if (!closed(next)) return next;
    }
    // Another device may have canceled the remembered attempt and started a new
    // one. A terminal result for one ID cannot release the target's payment lock.
    const { attempts } = await json<{attempts: TerminalAttemptView[]}>(`/api/stripe/terminal/attempts?${query}`);
    if (!valid(token)) return;
    const matching = attempts.filter(a => a.operation === operation && a.attempt_id !== remembered);
    // Setup can have multiple unfinished saves. Resolve each before offering a new one.
    for (const a of matching) {
      receive(a, token, true);
      const next = await reconcile(a.attempt_id, token, 'reconcile', true);
      if (!closed(next)) return next;
    }
    if (!valid(token)) return;
    const unknown = uncertainCreations.has(recoveryKey());
    block(unknown);
    if (unknown) setMessage(`${recoveryMessage} If the attempt remains unavailable, have the merchant verify the payment before continuing.`);
    else if (!current.current) setMessage('');
  }
  useEffect(() => {
    const token = { active: true, generation: native.generation, lease: Symbol() };
    life.current = token;
    lock.current = true;
    current.current = null;
    identity.current = null;
    delivered.current = null;
    setAttempt(null); setBusy(true); setUncertain(true); setChecked(false); setName(''); setSave(operation === 'setup');
    callbacks.current.onBlockedChange?.(true);
    void native.capabilities().then(value => { if (life.current === token && valid()) setCapability(value); });
    void recover(token).catch(error => { if (life.current === token && valid()) setMessage(error.message); }).finally(() => {
      if (life.current === token && valid()) { lock.current = false; setBusy(false); }
    });
    return () => {
      token.active = false;
      const id = current.current?.attempt_id;
      if (id) void native.cancel(id, token.lease);
    };
    // Target changes create a fresh lifecycle; callback identity must not restart collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation, jobId, customerId, native]);

  async function run(action: 'start' | 'recover' | 'resume' | 'cancel') {
    if ((lock.current && action !== 'cancel') || !valid()) return;
    if (action === 'start' && (uncertain || !capability?.supported || (save && (!checked || !name.trim())))) return;
    lock.current = true; setBusy(true); block(true);
    const token = life.current;
    try {
      if (action === 'recover') { await recover(token); return; }
      if (action === 'cancel') {
        if (current.current) {
          await native.cancel(current.current.attempt_id, token.lease);
          const next = await reconcile(current.current.attempt_id, token, 'cancel', true);
          if (closed(next)) await recover(token, next);
        } else await recover(token);
        return;
      }
      await checkIdentity(token);
      let next = current.current;
      if (action === 'start') {
        const consent = { accepted: true, version: TERMINAL_CONSENT_VERSION, customer_name: name.trim() };
        const body = operation === 'payment' ? { operation, job_id: jobId, save_card: save, ...(save ? {consent} : {}) } : {operation, customer_id: customerId, consent};
        uncertainCreations.add(recoveryKey());
        try {
          next = await json<TerminalAttemptView>('/api/stripe/terminal/attempts', {method:'POST', headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}, body:JSON.stringify(body)});
        } catch (error) {
          if (valid(token) && [400,404,409].includes((error as {status?:number}).status || 0)) uncertainCreations.delete(recoveryKey());
          throw error;
        }
        receive(next, token);
      } else if (next) {
        next = await reconcile(next.attempt_id, token, 'reconcile', true);
        if (closed(next)) { await recover(token, next); return; }
      }
      if (!valid(token) || !next || next.status !== 'ready' || !next.client_secret) return;
      await checkIdentity(token);
      await native.collect(next.operation, {operationId:next.attempt_id,clientSecret:next.client_secret,stripeAccount:next.stripe_account,locationId:next.terminal_location_id,saveCard:next.save_card}, token.lease);
      if (valid(token)) await reconcile(next.attempt_id, token);
    } catch (error) {
      if (!valid(token)) return;
      const failure = error instanceof Error ? error.message : recoveryMessage;
      setMessage(failure);
      // Creation can have reached the server even when no response arrived.
      try {
        await recover(token);
        if (valid(token) && !current.current && !uncertainCreations.has(recoveryKey())) setMessage(failure);
      } catch { if (valid(token)) { block(true); setMessage(recoveryMessage); } }
    } finally { if (valid(token)) { lock.current = false; setBusy(false); } }
  }
  const unfinished = attempt && !closed(attempt);
  const done = attempt?.status === 'succeeded' && closed(attempt);
  return <section className="space-y-3" aria-label={operation === 'payment' ? 'Tap to Pay' : 'Save card with a tap'}>
    {!capability?.supported && capability && <p className="text-sm text-amber-400">{capability.reason || 'Tap to Pay is unavailable in this app. Use manual card entry (Pay with card).'}</p>}
    {message && <p role="status" className="text-sm text-zinc-300">{message}</p>}
    {attempt?.warning && <p role="alert" className="text-sm text-amber-400">{attempt.warning}</p>}
    {!unfinished && !done && <>
      {operation === 'payment' && <label className="flex gap-2 text-sm"><input type="checkbox" checked={save} disabled={busy || uncertain} onChange={e=>{setSave(e.target.checked);setChecked(false);}}/> Save card for separately agreed future payments (optional)</label>}
      {save && <div className="space-y-2 text-sm">
        <p>{terminalConsentText(merchant?.name || 'this merchant')}</p>
        <label className="block">Customer-entered name<input className="block w-full rounded border border-line bg-card p-2" type="text" autoComplete="name" value={name} disabled={busy || uncertain} onChange={e=>setName(e.target.value)}/></label>
        <label className="flex gap-2"><input type="checkbox" checked={checked} disabled={busy || uncertain} onChange={e=>setChecked(e.target.checked)}/> I agree to save my card under these terms.</label>
      </div>}
      <button type="button" className="w-full rounded-xl bg-primary p-3 text-primary-foreground font-bold disabled:opacity-50" disabled={busy || uncertain || !capability?.supported || (save && (!checked || !name.trim()))} onClick={()=>run('start')}>{operation === 'payment' ? 'Tap to Pay on iPhone' : 'Save card with a tap'}</button>
    </>}
    {(uncertain || unfinished) && <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={()=>run('recover')}>Check status</button>
      {attempt?.status === 'ready' && <button type="button" disabled={busy || !capability?.supported} onClick={()=>run('resume')}>Continue original attempt</button>}
      {unfinished && <button type="button" onClick={()=>run('cancel')}>Cancel attempt</button>}
    </div>}
    {capability?.supported && <button type="button" className="text-xs underline" disabled={busy} onClick={()=>native.education().catch(()=>setMessage('Merchant education is unavailable. Try again in the supported Forge iPhone app.'))}>How Tap to Pay works</button>}
  </section>;
}
