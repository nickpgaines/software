import {nativeTerminal,terminalRequestInit,type NativeTerminal} from './native-terminal';
export type TerminalReadiness = 'checking'|'setupRequired'|'preparing'|'ready'|'unavailable';
export class TerminalReadinessController {
  state:TerminalReadiness='unavailable';
  private native:NativeTerminal;
  private fetcher:typeof fetch;
  private foreground=true;
  private epoch=0;
  private pending:Promise<void>|null=null;
  private binding:string|null=null;
  private listeners=new Set<()=>void>();
  constructor(native:NativeTerminal=nativeTerminal, fetcher:typeof fetch=fetch) {this.native=native;this.fetcher=fetcher;}
  subscribe(listener:()=>void) {this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  private setState(state:TerminalReadiness){this.state=state;this.listeners.forEach(fn=>fn());}
  revoke(state:string){if(state!=='ready')this.setState(state==='warming'?'preparing':'unavailable');}
  async resume(){this.foreground=true;await this.refresh();}
  async refresh():Promise<void> {
    if(!this.foreground || this.native.active)return;
    if(this.pending)return this.pending;
    const work=this.check();this.pending=work;
    try{await work;}finally{if(this.pending===work)this.pending=null;}
  }
  private async check() {
    const hadIdle=this.state==='ready';
    const epoch=this.epoch;let generation=this.native.generation;
    const current=()=>epoch===this.epoch && this.foreground && generation===this.native.generation;
    const json=async<T>(url:string):Promise<T>=>{
      const options=await terminalRequestInit(this.native,url);
      if(!current())throw new Error('Session changed');
      const response=await this.fetcher(url,{...options,cache:'no-store'});
      if(!response.ok)throw new Error('Readiness unavailable');
      const body=await response.json();
      if(!current())throw new Error('Session changed');
      return body;
    };
    this.setState('checking');
    try{
      const capability=await this.native.capabilities();
      if(!current())return;
      if(!capability.supported || !capability.warmupSupported){this.setState('unavailable');return;}
      const availability=await json<{enabled:boolean}>('/api/stripe/terminal/capabilities');
      if(!availability.enabled){if(this.binding)await this.native.reset();this.binding=null;this.setState('unavailable');return;}
      const company=await json<{id:number;stripe_account_id:string|null}>('/api/settings/company');
      const setup=await json<{stripe_account:string;selected_location_id:string|null}>('/api/stripe/terminal/location');
      if(!setup.selected_location_id || !company.stripe_account_id || setup.stripe_account!==company.stripe_account_id){
        if(this.binding)await this.native.reset();this.binding=null;this.setState('setupRequired');return;
      }
      const binding=JSON.stringify([company.id,company.stripe_account_id,setup.selected_location_id,capability.providerMode]);
      const sameBinding=this.binding===binding;
      if(this.binding && this.binding!==binding){await this.native.reset();generation=this.native.generation;if(!current())return;}
      this.binding=binding;
      if(sameBinding && capability.readiness==='ready'){this.setState('ready');return;}
      this.setState('preparing');
      const result=await this.native.warmUp({operationId:crypto.randomUUID(),stripeAccount:setup.stripe_account,locationId:setup.selected_location_id});
      if(!current())return;
      const latest=await json<typeof company>('/api/settings/company');
      if(latest.id!==company.id || latest.stripe_account_id!==company.stripe_account_id){await this.native.reset();this.binding=null;this.setState('unavailable');return;}
      this.setState(result.state==='ready'?'ready':'unavailable');
    }catch(error){
      if(current() && hadIdle && !this.native.active){await this.native.suspend();this.binding=null;}
      if(epoch===this.epoch && this.foreground)this.setState((error as {code?:string})?.code==='setup_required'?'setupRequired':'unavailable');
    }finally{
      if(epoch===this.epoch && generation!==this.native.generation)this.setState('unavailable');
    }
  }
  async suspend():Promise<void> {
    this.foreground=false;this.epoch++;this.binding=null;this.pending=null;this.setState('unavailable');
    await this.native.suspend();
  }
}
