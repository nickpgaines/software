"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { nativeTerminal, terminalRequestInit, type NativeTerminal, type TerminalProgress } from '@/lib/native-terminal';
import {useTerminalReadiness} from './TerminalLifecycle';

type Location = {id:string;display_name:string;address:{line1:string;line2?:string;city:string;state:string;postal_code:string}};
type Setup = {stripe_account:string;can_manage:boolean;locations:Location[];selected_location_id:string|null;has_more:boolean};
type Company = {id:number;stripe_account_id:string|null};
type Device = {supported:boolean;preparationSupported?:boolean;reason?:string};
type Native = Pick<NativeTerminal,'generation'|'capabilities'|'prepare'|'education'|'cancel'>;
type Life = {active:boolean;generation:number;lease:symbol;serial:number;operationId?:string;company?:Company};
const states = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const emptyAddress = {display_name:'',line1:'',line2:'',city:'',state:'',postal_code:''};
const meaningful = (value:string) => !!value.trim() && !/^(unspecified|unknown|n\/a|na)$/i.test(value.trim());

export default function TerminalSetup({native=nativeTerminal,accountKey}: {native?:Native;accountKey?:string|null}) {
  const readiness=useTerminalReadiness();
  const id = useId();
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [enabled,setEnabled] = useState(false);
  const [device,setDevice] = useState<Device|null>(null);
  const [setup,setSetup] = useState<Setup|null>(null);
  const [selection,setSelection] = useState('');
  const [address,setAddress] = useState(emptyAddress);
  const [representative,setRepresentative] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [progress,setProgress] = useState<number|undefined>();
  const [preparing,setPreparing] = useState(false);
  const [changed,setChanged] = useState(false);
  const [needsOnboarding,setNeedsOnboarding]=useState(false);
  const life = useRef<Life>({active:false,generation:native.generation,lease:Symbol(),serial:0});
  const lock = useRef(false);
  const valid = (token:Life,serial=token.serial) => token === life.current && token.active && token.generation === native.generation && token.serial === serial;
  async function json<T>(url:string, init?:RequestInit):Promise<T> {
    const token=life.current;const serial=token.serial;
    const options=await terminalRequestInit(native,url,init);
    if(!valid(token,serial))throw new Error('Session changed. Reopen Payments settings.');
    const response = await fetch(url,{cache:'no-store',...options});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to check Tap to Pay setup. Please try again.');
    return body;
  }
  const changedAccount = (token:Life) => {
    token.active=false;
    if(token.operationId)void native.cancel(token.operationId,token.lease);
    setChanged(true);setMessage('');setError('Account changed. Reopen Payments settings before continuing.');setBusy(false);setPreparing(false);
  };
  async function identity(token:Life,serial:number) {
    const company = await json<Company>('/api/settings/company');
    if (!valid(token,serial)) throw new Error('Session changed. Reopen Payments settings.');
    if(token.company && (company.id !== token.company.id || company.stripe_account_id !== token.company.stripe_account_id)) {
      changedAccount(token);throw new Error('Account changed.');
    }
    token.company=company;
    return company;
  }
  async function freshSetup(token:Life,serial:number) {
    const company = await identity(token,serial);
    const fresh = await json<Setup>('/api/stripe/terminal/location');
    if(!valid(token,serial))throw new Error('Session changed.');
    if(fresh.stripe_account !== company.stripe_account_id){changedAccount(token);throw new Error('Account changed.');}
    return fresh;
  }
  const applySetup = (value:Setup) => {setSetup(value);setSelection(value.selected_location_id ?? (value.locations.length ? '' : 'new'));};
  async function load(token=life.current) {
    if(lock.current || !valid(token))return;
    lock.current=true;setLoading(true);setError('');setMessage('');setRepresentative(false);setSetup(null);setNeedsOnboarding(false);
    const serial=token.serial;
    try {
      const [capability,availability] = await Promise.all([native.capabilities(),json<{enabled:boolean}>('/api/stripe/terminal/capabilities')]);
      if(!valid(token,serial))return;
      setDevice(capability);setEnabled(availability.enabled === true);
      if(availability.enabled === true) {
        const company=await identity(token,serial);
        const eligibility=await json<{eligible:boolean;stripe_account:string|null}>('/api/stripe/terminal/eligibility');
        if(!valid(token,serial))return;
        if(eligibility.stripe_account!==company.stripe_account_id){changedAccount(token);return;}
        if(!eligibility.eligible){setNeedsOnboarding(true);return;}
        applySetup(await freshSetup(token,serial));
      }
    } catch(e) {if(valid(token,serial))setError(e instanceof Error ? e.message : 'Unable to load setup. Please try again.');}
    finally {if(valid(token,serial)){lock.current=false;setLoading(false);}}
  }
  useEffect(()=>{
    const token:Life={active:true,generation:native.generation,lease:Symbol(),serial:0};
    life.current=token;lock.current=false;setChanged(false);setBusy(false);setPreparing(false);setAddress(emptyAddress);
    void load(token);
    // Returning from another app clears ephemeral readiness and refreshes account scope.
    const refresh=()=>{if(!lock.current)void load(token);else if(valid(token))void identity(token,token.serial).catch(()=>{});};
    if(typeof window !== 'undefined')window.addEventListener('focus',refresh);
    return ()=>{token.active=false;if(token.operationId)void native.cancel(token.operationId,token.lease);if(typeof window !== 'undefined')window.removeEventListener('focus',refresh);};
    // Account remapping from the parent starts a new lifecycle, not an old preparation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[native,accountKey]);

  const usable = enabled && !loading && !changed && !error && !!setup;
  const canPrepare = usable && device?.supported === true && device.preparationSupported === true && !!setup?.selected_location_id && selection === setup.selected_location_id;
  const validAddress = meaningful(address.display_name) && meaningful(address.line1) && meaningful(address.city)
    && states.includes(address.state.trim().toUpperCase()) && /^\d{5}(-\d{4})?$/.test(address.postal_code.trim()) && !address.postal_code.trim().startsWith('00000');
  const canSave = usable && setup?.can_manage && (selection === 'new' ? validAddress : setup?.locations.some(item=>item.id === selection));

  async function work(kind:'save'|'prepare'|'education') {
    const token=life.current;
    if(lock.current || !valid(token) || changed)return;
    if(kind === 'save' && !canSave || kind === 'prepare' && !canPrepare || kind === 'education' && !device?.supported)return;
    lock.current=true;setBusy(true);setError('');setMessage('');setProgress(undefined);
    const serial=++token.serial;
    try {
      if(kind === 'education'){await native.education();return;}
      const fresh=await freshSetup(token,serial);
      if(!valid(token,serial))return;
      if(kind === 'save') {
        if(!fresh.can_manage)throw new Error('An administrator must update the business location.');
        const body = selection === 'new' ? {display_name:address.display_name.trim(),address:{line1:address.line1.trim(),...(address.line2.trim()?{line2:address.line2.trim()}:{}),city:address.city.trim(),state:address.state.trim().toUpperCase(),postal_code:address.postal_code.trim(),country:'US'}} : {location_id:selection};
        const saved=await json<{stripe_account:string}>('/api/stripe/terminal/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        if(!valid(token,serial))return;
        if(saved.stripe_account !== fresh.stripe_account){changedAccount(token);return;}
        applySetup(await freshSetup(token,serial));setMessage('Business location saved. Prepare this iPhone when you’re ready.');
      } else {
        if(fresh.selected_location_id !== setup?.selected_location_id){applySetup(fresh);throw new Error('Business location changed. Review the location and try again.');}
        if(representative && !fresh.can_manage)throw new Error('Administrator permission is required to accept merchant terms.');
        const operationId=crypto.randomUUID();token.operationId=operationId;
        setPreparing(true);setMessage('Preparing this iPhone…');
        await native.prepare({operationId,stripeAccount:fresh.stripe_account,locationId:fresh.selected_location_id!,representativeConfirmed:representative && fresh.can_manage},token.lease,(event:TerminalProgress)=>{
          if(valid(token,serial) && event.operationId === operationId){setMessage(event.message);setProgress(event.progress);}
        });
        if(!valid(token,serial))return;
        const final=await freshSetup(token,serial);
        if(!valid(token,serial))return;
        applySetup(final);
        if(final.selected_location_id !== fresh.selected_location_id)throw new Error('Business location changed. Prepare this iPhone again.');
        setMessage('This iPhone is ready for Tap to Pay. No payment was taken and no card was saved.');
        setRepresentative(false);
      }
    } catch(e) {if(valid(token,serial)){setMessage('');setError(e instanceof Error?e.message:'Unable to complete setup. Please try again.');}}
    finally {if(valid(token,serial)){token.operationId=undefined;lock.current=false;setBusy(false);setPreparing(false);setProgress(undefined);void readiness?.refresh();}}
  }
  async function cancel() {
    const token=life.current;const operationId=token.operationId;
    if(!operationId || !valid(token))return;
    const serial=++token.serial;token.operationId=undefined;
    setMessage('Canceling setup…');setProgress(undefined);
    try{await native.cancel(operationId,token.lease);}
    finally{if(valid(token,serial)){lock.current=false;setBusy(false);setPreparing(false);setMessage('Setup canceled. No payment was taken.');setRepresentative(false);}}
  }

  return <Card>
    <CardHeader><CardTitle>Tap to Pay on iPhone</CardTitle><CardDescription>Accept contactless cards and digital wallets directly on a supported iPhone. Prepare your device here without taking a payment.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {!loading && enabled && device?.supported && readiness && <p role="status" className="text-sm text-fg-muted">{{
        checking:'Checking this iPhone’s reader…',preparing:'Preparing this iPhone’s reader…',ready:'This iPhone’s reader is ready.',
        setupRequired:'An authorized administrator may need to finish merchant setup. Use Prepare this iPhone below to continue.',
        unavailable:'Automatic reader preparation is unavailable. Use Prepare this iPhone, or Pay with card at checkout.',
      }[readiness.state]}</p>}
      {loading && <p role="status" className="text-sm text-fg-muted">Checking Tap to Pay setup…</p>}
      {!loading && !enabled && !error && <p className="text-sm text-fg-muted">Tap to Pay is coming soon. Use Pay with card to accept payments in the meantime.</p>}
      {!loading && enabled && !device?.supported && <p className="text-sm text-fg-muted">Open Forge on a supported iPhone to prepare this device. You can still use Pay with card.</p>}
      {!loading && enabled && device?.supported && !device.preparationSupported && <p className="text-sm text-fg-muted">Update Forge to set up Tap to Pay on this iPhone. Pay with card is still available.</p>}
      {needsOnboarding&&!loading&&<p role="status" className="text-sm text-fg-muted">Complete Stripe onboarding in Payments settings before setting up Tap to Pay. Ask an authorized administrator to review the Stripe requirements above.</p>}
      {usable&&device?.supported&&device.preparationSupported&&<Button asChild variant="outline"><a href={`#${id}-tap-setup`}>Set up Tap to Pay</a></Button>}
      {setup && !loading && <div id={`${id}-tap-setup`} tabIndex={-1} className="space-y-4">
        <div className="space-y-1"><h3 className="text-sm font-bold">Business location</h3><p className="text-sm text-fg-muted">{setup.locations.find(item=>item.id===setup.selected_location_id)?.display_name || 'An administrator needs to choose a business location.'}</p></div>
        {setup.can_manage ? <div className="space-y-3">
          <Label htmlFor={`${id}-location`}>Choose a location</Label>
          {/* Native select kept for the empty selection sentinel, per the design system. */}
          <select id={`${id}-location`} aria-label="Business location" className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm font-bold text-fg" value={selection} disabled={busy || changed} onChange={e=>{setSelection(e.target.value);setMessage('');}}>
            <option value="">Select a business location</option>
            {setup.locations.map(item=><option key={item.id} value={item.id}>{item.display_name} — {item.address.line1}, {item.address.city}</option>)}
            <option value="new">Add a business location</option>
          </select>
          {setup.has_more && <p className="text-xs text-fg-muted">More locations exist in Stripe. If yours is missing, contact Forge support before adding a duplicate.</p>}
          {selection === 'new' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([{key:'display_name',label:'Business name',max:100},{key:'line1',label:'Street address',max:200},{key:'line2',label:'Address line 2 (optional)',max:200},{key:'city',label:'City',max:200},{key:'state',label:'State',max:2},{key:'postal_code',label:'ZIP code',max:10}] as const).map(field=><div className="space-y-2" key={field.key}>
              <Label htmlFor={`${id}-${field.key}`}>{field.label}</Label><Input id={`${id}-${field.key}`} aria-label={field.label} value={address[field.key]} maxLength={field.max} disabled={busy || changed} onChange={e=>setAddress(value=>({...value,[field.key]:e.target.value}))}/>
            </div>)}<p className="text-xs text-fg-muted sm:col-span-2">United States only. Enter your actual business address; don’t use a placeholder.</p>
          </div>}
          <Button type="button" variant="outline" disabled={busy || !canSave || selection === setup.selected_location_id} onClick={()=>work('save')}>Save location</Button>
        </div> : <p className="text-sm text-fg-muted">An authorized administrator manages your business location and accepts merchant terms. You can prepare your own iPhone once the business is set up.</p>}
        {device?.supported && device.preparationSupported && <>
          {setup.can_manage && <div className="flex items-start gap-3"><Checkbox id={`${id}-representative`} checked={representative} disabled={busy || changed} onCheckedChange={value=>setRepresentative(value===true)}/><Label htmlFor={`${id}-representative`} className="leading-normal">I’m authorized to accept Tap to Pay merchant terms for this business. Show Apple’s terms if acceptance is needed.</Label></div>}
          <div className="flex flex-wrap gap-2"><Button type="button" className="h-auto min-h-10 whitespace-normal" disabled={busy || !canPrepare} onClick={()=>work('prepare')}>Prepare this iPhone</Button>{preparing && <Button type="button" variant="outline" onClick={cancel}>Cancel setup</Button>}</div>
        </>}
      </div>}
      {message && <p role="status" className="text-sm text-fg">{message}</p>}
      {preparing && progress != null && Number.isFinite(progress) && <div role="progressbar" aria-label="Preparing iPhone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1,Math.max(0,progress))*100)} className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{width:`${Math.min(1,Math.max(0,progress))*100}%`}}/></div>}
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><p className="text-sm text-fg-muted">Pay with card is still available.</p>{!changed && <Button type="button" variant="outline" disabled={busy} onClick={()=>load()}>Try again</Button>}</div>}
      <div className="space-y-2 border-t border-line pt-4"><h3 className="text-sm font-bold">How to tap</h3><p className="text-sm text-fg-muted">When the payment screen appears, ask your customer to hold their contactless card or digital wallet near the top of your iPhone until the screen confirms it.</p><Button type="button" variant="outline" disabled={busy || loading || changed || !device?.supported} onClick={()=>work('education')}>How to tap</Button>{!device?.supported && !loading && <p className="text-xs text-fg-muted">The interactive guide is available in the supported Forge iPhone app.</p>}</div>
    </CardContent>
  </Card>;
}
