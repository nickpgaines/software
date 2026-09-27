"use client";

import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {nativeTerminal} from '@/lib/native-terminal';
import {TerminalReadinessController,type TerminalReadiness} from '@/lib/terminal-readiness';

type ReadinessContext={state:TerminalReadiness;refresh:()=>Promise<void>};
const Context=createContext<ReadinessContext|null>(null);
export const useTerminalReadiness=()=>useContext(Context);

export function TerminalLifecycleProvider({children,identityKey}:{children:ReactNode;identityKey:string}) {
  const controller=useMemo(()=>new TerminalReadinessController(),[identityKey]);
  const [state,setState]=useState<TerminalReadiness>('checking');
  useEffect(()=>{
    let active=true;
    const unsubscribe=controller.subscribe(()=>{if(active)setState(controller.state);});
    const refresh=()=>{if(document.visibilityState!=='hidden')void controller.resume();};
    const visibility=()=>{if(document.visibilityState==='hidden')void controller.suspend();else refresh();};
    const readiness=nativeTerminal.observeReadiness(value=>{if(active)controller.revoke(value);}).catch(()=>undefined);
    const app=import('@capacitor/app').then(({App})=>App.addListener('appStateChange',({isActive})=>{
      if(!active)return;
      if(isActive)refresh();else void controller.suspend();
    })).catch(()=>undefined);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',visibility);
    refresh();
    return()=>{
      active=false;unsubscribe();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility);
      void readiness.then(handle=>handle?.remove());void app.then(handle=>handle?.remove());
      void controller.suspend();
    };
  },[controller]);
  return <Context.Provider value={{state,refresh:()=>controller.refresh()}}>{children}</Context.Provider>;
}
