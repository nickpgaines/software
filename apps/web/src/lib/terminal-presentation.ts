export class TerminalPresentationGate {
  private owners=new Set<symbol>();
  private listeners=new Set<()=>void>();
  get blocked(){return this.owners.size>0;}
  subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  acquire(){
    const owner=Symbol();this.owners.add(owner);this.listeners.forEach(fn=>fn());
    return()=>{if(this.owners.delete(owner))this.listeners.forEach(fn=>fn());};
  }
}
