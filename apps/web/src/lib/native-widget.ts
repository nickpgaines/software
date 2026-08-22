export type WidgetCredential = {
  token: string;
  company_id: number;
  staff_id: number;
  expires_at: string;
};

type WidgetPrincipal = {
  company_id: number;
  staff_id: number;
};

export type ForgeWidgetPlugin = {
  getInstallation(): Promise<{ installation_id: string }>;
  storeCredential(credential: WidgetCredential): Promise<void>;
  credentialMetadata(): Promise<{ credential: WidgetCredential | null }>;
  clearCredential(): Promise<void>;
  refreshSnapshot(): Promise<{ refreshed: boolean; reconnect?: boolean }>;
};

type PluginLoader = () => Promise<ForgeWidgetPlugin | null>;
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let pluginPromise: Promise<ForgeWidgetPlugin | null> | null = null;

async function nativeWidgetPlugin(): Promise<ForgeWidgetPlugin | null> {
  if (typeof window === "undefined") return null;
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/core").then(
      ({ Capacitor, registerPlugin }) => {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
          return null;
        }
        return registerPlugin<ForgeWidgetPlugin>("ForgeWidget");
      }
    );
  }
  return pluginPromise;
}

export function widgetCredentialNeedsRefresh(
  credential: Pick<WidgetCredential, "expires_at"> | null,
  now = new Date()
) {
  if (!credential) return true;
  const expiresAt = new Date(credential.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - now.getTime() <= 30 * 24 * 60 * 60 * 1000;
}

function validPrincipal(value: unknown): value is WidgetPrincipal {
  if (!value || typeof value !== "object") return false;
  const principal = value as WidgetPrincipal;
  return (
    Number.isInteger(principal.company_id) && Number.isInteger(principal.staff_id)
  );
}

function validCredential(value: unknown): value is WidgetCredential {
  if (!value || typeof value !== "object") return false;
  const credential = value as WidgetCredential;
  return (
    typeof credential.token === "string" &&
    credential.token.length > 0 &&
    validPrincipal(credential) &&
    Number.isFinite(new Date(credential.expires_at).getTime())
  );
}

export class NativeWidgetCredentialLifecycle {
  private bootstrapPromise: Promise<void> | null = null;
  private generation = 0;
  private loggingOut = false;
  private readonly loadPlugin: PluginLoader;
  private readonly request: Fetcher;

  constructor(loadPlugin: PluginLoader, request: Fetcher) {
    this.loadPlugin = loadPlugin;
    this.request = request;
  }

  private async revoke(token: string) {
    await this.request("/api/widget/token", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }

  private async bootstrap(generation: number) {
    const plugin = await this.loadPlugin();
    if (!plugin || this.loggingOut || generation !== this.generation) return;

    const principalResponse = await this.request("/api/widget/token", {
      method: "GET",
    });
    if (!principalResponse.ok) return;
    const principal = (await principalResponse.json().catch(() => null)) as unknown;
    if (!validPrincipal(principal)) return;

    let { credential } = await plugin.credentialMetadata();
    if (
      credential &&
      (credential.company_id !== principal.company_id ||
        credential.staff_id !== principal.staff_id)
    ) {
      await this.revoke(credential.token);
      await plugin.clearCredential();
      credential = null;
    }

    if (!widgetCredentialNeedsRefresh(credential)) {
      const refreshed = await plugin.refreshSnapshot();
      if (!refreshed.reconnect) return;
    }

    const { installation_id } = await plugin.getInstallation();
    const response = await this.request("/api/widget/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installation_id }),
    });
    if (!response.ok) return;
    const issued = (await response.json().catch(() => null)) as unknown;
    if (
      !validCredential(issued) ||
      issued.company_id !== principal.company_id ||
      issued.staff_id !== principal.staff_id
    ) {
      return;
    }

    if (this.loggingOut || generation !== this.generation) {
      await this.revoke(issued.token);
      return;
    }
    await plugin.storeCredential(issued);
    if (this.loggingOut || generation !== this.generation) {
      await plugin.clearCredential();
      await this.revoke(issued.token);
      return;
    }
    await plugin.refreshSnapshot();
  }

  async ensure(): Promise<void> {
    if (this.loggingOut) return;
    if (!this.bootstrapPromise) {
      const generation = this.generation;
      const promise = this.bootstrap(generation)
        .catch(() => {
          // Widget setup is best-effort and must never block the hosted app.
        })
        .finally(() => {
          if (this.bootstrapPromise === promise) this.bootstrapPromise = null;
        });
      this.bootstrapPromise = promise;
    }
    await this.bootstrapPromise;
  }

  async clear(): Promise<void> {
    const plugin = await this.loadPlugin();
    if (!plugin) return;
    try {
      const { credential } = await plugin.credentialMetadata();
      if (credential?.token) await this.revoke(credential.token);
    } finally {
      await plugin.clearCredential();
    }
  }

  async logout(): Promise<void> {
    this.loggingOut = true;
    this.generation += 1;
    try {
      await this.bootstrapPromise;
      await this.clear().catch(() => undefined);
      await this.request("/api/logout", { method: "POST" });
    } finally {
      const plugin = await this.loadPlugin().catch(() => null);
      await plugin?.clearCredential().catch(() => undefined);
      this.loggingOut = false;
    }
  }
}

const lifecycle = new NativeWidgetCredentialLifecycle(
  nativeWidgetPlugin,
  (input, init) => fetch(input, init)
);

export async function ensureNativeWidgetCredential(): Promise<void> {
  await lifecycle.ensure();
}

export async function clearNativeWidgetCredential(): Promise<void> {
  await lifecycle.clear();
}

export async function logoutForgeSession(): Promise<void> {
  await lifecycle.logout();
}
