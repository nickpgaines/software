export type TerminalCollection = {
  operationId: string;
  clientSecret: string;
  stripeAccount: string;
  locationId: string;
  saveCard: boolean;
};
export type TerminalPreparation = Omit<TerminalCollection,'clientSecret'|'saveCard'> & {representativeConfirmed:boolean};
export type TerminalProgress = {operationId:string;phase:string;message:string;progress?:number};
export interface ForgeTerminalPlugin {
  getCapabilities(): Promise<{ supported: boolean; reason?: string; preparationSupported?:boolean }>;
  prepareDevice?(args:TerminalPreparation):Promise<void>;
  addListener?(event:'terminalProgress',callback:(event:TerminalProgress)=>void):Promise<{remove():Promise<void>}>;
  showEducation(): Promise<void>;
  collectPayment(args: TerminalCollection): Promise<{ intentId: string }>;
  collectSetup(args: Omit<TerminalCollection, 'saveCard'>): Promise<{ intentId: string }>;
  cancel(): Promise<void>;
  reset(): Promise<void>;
}
const fallback = 'Tap to Pay requires a supported Forge iPhone app with iOS 18 or later and merchant provisioning. Use manual card entry instead.';

export async function nativeTerminalPlugin(): Promise<ForgeTerminalPlugin | null> {
  if (typeof window === 'undefined') return null;
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return null;
  const plugin = registerPlugin<ForgeTerminalPlugin>('ForgeTerminal');
  // Never resolve a Promise with the Capacitor proxy: its synthetic `then` hangs.
  return {
    getCapabilities: () => plugin.getCapabilities(),
    prepareDevice: args => plugin.prepareDevice!(args),
    addListener: (event,callback) => plugin.addListener!(event,callback),
    showEducation: () => plugin.showEducation(),
    collectPayment: args => plugin.collectPayment(args),
    collectSetup: args => plugin.collectSetup(args),
    cancel: () => plugin.cancel(), reset: () => plugin.reset(),
  };
}

export class NativeTerminal {
  generation = 0;
  private owner: string | null = null;
  private lease: symbol | undefined;
  private resetting = false;
  private pendingCleanups = 0;
  private unavailable = false;
  private collection = 0;
  private load: () => Promise<ForgeTerminalPlugin | null>;
  private cleanupTimeout: number;
  constructor(load = nativeTerminalPlugin, cleanupTimeout = 1500) {
    this.load = load;
    this.cleanupTimeout = cleanupTimeout;
  }
  async capabilities() {
    if (this.resetting || this.unavailable) return { supported: false, reason: fallback };
    try { return (await this.load())?.getCapabilities().catch(() => ({ supported: false, reason: fallback })) ?? { supported: false, reason: fallback }; }
    catch { return { supported: false, reason: fallback }; }
  }
  async education() { await (await this.load())?.showEducation(); }
  async collect(operation: 'payment' | 'setup', args: TerminalCollection, lease?: symbol) {
    return this.run(args.operationId,lease,async plugin => {
      const { saveCard, ...setup } = args;
      return operation === 'payment' ? plugin.collectPayment(args) : plugin.collectSetup(setup);
    });
  }
  async prepare(args:TerminalPreparation,lease?:symbol,progress?:(event:TerminalProgress)=>void) {
    return this.run(args.operationId,lease,async (plugin,current) => {
      if (!(await plugin.getCapabilities()).preparationSupported || !plugin.prepareDevice) throw new Error('Update Forge to set up Tap to Pay on this iPhone.');
      if (!current()) throw new Error('Terminal session changed.');
      const subscription = progress && plugin.addListener ? await plugin.addListener('terminalProgress',event => {
        if (current() && event.operationId === args.operationId) progress(event);
      }) : undefined;
      try {
        if (!current()) throw new Error('Terminal session changed.');
        await plugin.prepareDevice(args);
      } finally { await subscription?.remove().catch(()=>{}); }
    });
  }
  private async run<T>(operationId:string,lease:symbol|undefined,work:(plugin:ForgeTerminalPlugin,current:()=>boolean)=>Promise<T>) {
    if (this.owner || this.resetting || this.unavailable) throw new Error('A Terminal operation is already active. Check its status first.');
    this.owner = operationId;
    this.lease = lease;
    const generation = this.generation;
    const collection = ++this.collection;
    try {
      const plugin = await this.load();
      if (generation !== this.generation || collection !== this.collection) throw new Error('Terminal session changed.');
      if (!plugin) throw new Error(fallback);
      const capability = await plugin.getCapabilities();
      if (!capability.supported) throw new Error(fallback);
      if (capability.preparationSupported !== true) throw new Error('Update Forge to use Tap to Pay. Pay with card is still available.');
      if (generation !== this.generation || collection !== this.collection) throw new Error('Terminal session changed.');
      const result = await work(plugin,()=>generation === this.generation && collection === this.collection);
      if (generation !== this.generation || collection !== this.collection) throw new Error('Terminal session changed.');
      return result;
    } finally {
      if (generation === this.generation && collection === this.collection && this.owner === operationId) this.owner = null;
    }
  }
  private async boundedCleanup(method: 'cancel' | 'reset') {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.load().then(plugin => plugin?.[method]()),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Terminal cleanup timed out')), this.cleanupTimeout); }),
      ]);
    } catch { this.unavailable = true; }
    finally { if (timer) clearTimeout(timer); }
  }
  private async cleanup(method: 'cancel' | 'reset') {
    this.pendingCleanups++;
    this.resetting = true;
    try { await this.boundedCleanup(method); }
    finally {
      // Logout may reset while cancellation is still in flight. No newer
      // collection may start until every cleanup has settled (or failed closed).
      this.pendingCleanups--;
      if (this.pendingCleanups === 0) {
        this.owner = null;
        this.resetting = false;
      }
    }
  }
  async cancel(operationId: string, lease?: symbol) {
    // A dismissed flow must never cancel a newer flow's global native operation.
    if (this.owner !== operationId || this.lease !== lease || this.resetting) return;
    this.collection++;
    await this.cleanup('cancel');
  }
  async reset() {
    this.generation++;
    await this.cleanup('reset');
  }
}

export const nativeTerminal = new NativeTerminal();
