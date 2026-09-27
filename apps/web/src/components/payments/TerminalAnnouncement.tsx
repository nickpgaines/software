"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {nativeTerminal,terminalRequestInit,type NativeTerminal} from '@/lib/native-terminal';
import {useTerminalReadiness} from './TerminalLifecycle';
import type {TerminalAnnouncementView} from '@/lib/terminal-announcements';

export default function TerminalAnnouncement({identityKey,native=nativeTerminal}:{identityKey:string;native?:Pick<NativeTerminal,'generation'|'active'|'capabilities'>}) {
  const readiness=useTerminalReadiness();const router=useRouter();
  const [announcement,setAnnouncement]=useState<TerminalAnnouncementView|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const lock=useRef(false);const life=useRef({active:false,generation:native.generation,sequence:0});
  const valid=(token:typeof life.current)=>token===life.current&&token.active&&token.generation===native.generation;
  const visible=()=>document.visibilityState!=='hidden';
  useEffect(()=>{
    const token={active:true,generation:native.generation,sequence:0};life.current=token;
    let request:AbortController|undefined;
    setAnnouncement(null);setBusy(false);setError('');lock.current=false;
    const refresh=async()=>{
      if(!valid(token)||!visible())return;
      const sequence=++token.sequence;request?.abort();request=new AbortController();
      try {
        const capability=await native.capabilities();
        if(!valid(token)||sequence!==token.sequence||!capability.supported||!capability.preparationSupported)return;
        const init=await terminalRequestInit(native,'/api/stripe/terminal/announcement');
        if(!valid(token)||sequence!==token.sequence)return;
        const response=await fetch('/api/stripe/terminal/announcement',{...init,cache:'no-store',signal:request.signal});
        if(!response.ok)throw Error('Unavailable');const data=await response.json();
        if(valid(token)&&sequence===token.sequence&&visible())setAnnouncement(data.announcement);
      }catch{if(valid(token)&&sequence===token.sequence)setAnnouncement(null);}
    };
    const changed=()=>{if(!visible()){token.sequence++;request?.abort();setAnnouncement(null);}else void refresh();};
    document.addEventListener('visibilitychange',changed);window.addEventListener('focus',changed);void refresh();
    const app=import('@capacitor/app').then(({App})=>App.addListener('appStateChange',({isActive})=>{if(token.active&&isActive)changed();})).catch(()=>undefined);
    return()=>{token.active=false;request?.abort();document.removeEventListener('visibilitychange',changed);window.removeEventListener('focus',changed);void app.then(handle=>handle?.remove());};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[identityKey,native]);
  async function acknowledge(setup:boolean) {
    const token=life.current;
    if(!announcement||!valid(token)||!visible()||lock.current||readiness?.presentationBlocked||native.active)return;
    const version=announcement.version;lock.current=true;setBusy(true);setError('');
    try {
      const response=await fetch('/api/stripe/terminal/announcement/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version})});
      if(!response.ok)throw Error('Unavailable');
      if(!valid(token))return;
      setAnnouncement(null);if(setup)router.push('/settings?tab=payments');
    }catch{if(valid(token))setError('Your choice could not be saved. Please try again.');}
    finally{if(valid(token)){lock.current=false;setBusy(false);}}
  }
  if(!valid(life.current)||!announcement||readiness?.presentationBlocked||native.active||!visible())return null;
  return <div className="mx-auto mb-4 w-full max-w-7xl px-4"><Card aria-label="Tap to Pay announcement">
    <CardHeader><CardTitle>{announcement.title}</CardTitle></CardHeader>
    <CardContent className="space-y-4"><p className="text-sm text-fg-muted">{announcement.body}</p>
      <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>acknowledge(true)}>Set up Tap to Pay</Button><Button variant="outline" disabled={busy} onClick={()=>acknowledge(false)}>Not now</Button></div>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card></div>;
}
