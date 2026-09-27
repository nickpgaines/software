"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Capacitor} from '@capacitor/core';
import {nativeTerminal} from '@/lib/native-terminal';
import {TerminalReadinessController,type TerminalReadiness} from '@/lib/terminal-readiness';
import {TerminalPresentationGate} from '@/lib/terminal-presentation';

type ReadinessContext={state:TerminalReadiness;refresh:()=>Promise<void>;presentationBlocked:boolean;acquirePresentationBlock:()=>()=>void};
const Context=createContext<ReadinessContext|null>(null);
export const useTerminalReadiness=()=>useContext(Context);
export function useTerminalPresentationBlock(blocked=true) {
  const acquire=useTerminalReadiness()?.acquirePresentationBlock;
  useEffect(()=>blocked?acquire?.():undefined,[blocked,acquire]);
}

export function TerminalLifecycleProvider({children,identityKey}:{children:ReactNode;identityKey:string}) {
  const controller=useMemo(()=>new TerminalReadinessController(),[identityKey]);
  const [state,setState]=useState<TerminalReadiness>('checking');
  const presentation=useMemo(()=>new TerminalPresentationGate(),[identityKey]);
  const [presentationBlocked,setPresentationBlocked]=useState(false);
  const acquirePresentationBlock=useCallback(()=>presentation.acquire(),[presentation]);
  useEffect(()=>{
    const unsubscribe=presentation.subscribe(()=>setPresentationBlocked(presentation.blocked));
    // Preserve existing fixed wrappers. Conservatively defer for legacy modals
    // in addition to explicit payment/recovery ownership below.
    const selector='[role="dialog"],[aria-modal="true"],.fixed.inset-0';
    let release:(()=>void)|undefined;
    const inspect=()=>{const blocked=!!document.querySelector(selector);if(blocked&&!release)release=presentation.acquire();else if(!blocked&&release){release();release=undefined;}};
    const relevant=(node:Node)=>node instanceof Element&&(node.matches(selector)||!!node.querySelector(selector));
    const observer=new MutationObserver(records=>{if(records.some(record=>[...Array.from(record.addedNodes),...Array.from(record.removedNodes)].some(relevant)))inspect();});
    observer.observe(document.body,{subtree:true,childList:true});inspect();setPresentationBlocked(presentation.blocked);
    return()=>{observer.disconnect();unsubscribe();release?.();};
  },[presentation]);
  useEffect(()=>{
    let active=true;
    const nativeApp=Capacitor.isNativePlatform();
    const unsubscribe=controller.subscribe(()=>{if(active)setState(controller.state);});
    const refresh=()=>{if(active&&document.visibilityState!=='hidden')void controller.resume();};
    // A native payment sheet can hide the WebView or resign activity without
    // backgrounding Forge. Only the native pause event is authoritative there.
    const visibility=()=>{if(document.visibilityState==='hidden'){if(!nativeApp)void controller.suspend();}else refresh();};
    const readiness=nativeTerminal.observeReadiness(value=>{if(active)controller.revoke(value);}).catch(()=>undefined);
    const app=nativeApp?import('@capacitor/app').then(({App})=>{
      if(!active)return [];
      return [
        App.addListener('pause',()=>{if(active)void controller.suspend();}).catch(()=>undefined),
        App.addListener('appStateChange',({isActive})=>{if(isActive)refresh();}).catch(()=>undefined),
      ];
    }).catch(()=>[]):Promise.resolve([]);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',visibility);
    refresh();
    return()=>{
      active=false;unsubscribe();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility);
      void readiness.then(handle=>handle?.remove());
      void app.then(handles=>handles.forEach(handle=>{void handle.then(value=>value?.remove()).catch(()=>{});}));
      void controller.suspend();
    };
  },[controller]);
  return <Context.Provider value={{state,refresh:()=>controller.refresh(),presentationBlocked:presentationBlocked||nativeTerminal.active,acquirePresentationBlock}}>{children}</Context.Provider>;
}
