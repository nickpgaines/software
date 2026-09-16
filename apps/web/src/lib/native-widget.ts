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

export const LOGOUT_FAILURE_MESSAGE =
  "Could not log out. Please check your connection and try again.";

export function scheduleNativeWidgetCredentialRetry(
  firstAttempt: Promise<boolean>,
  retry: () => Promise<boolean>,
  delayMs = 5_500
): () => void {
  let cancelled = false;
  const outcome = firstAttempt.catch(() => false);
  const timer = setTimeout(() => {
    void outcome.then((connected) => {
      if (!cancelled && !connected) void retry();
    });
  }, delayMs);
  void outcome.then((connected) => {
    if (connected) clearTimeout(timer);
  });

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

let pluginPromise: Promise<ForgeWidgetPlugin | null> | null = null;

async function nativeWidgetPlugin(): Promise<ForgeWidgetPlugin | null> {
  if (typeof window === "undefined") return null;
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/core").then(
      ({ Capacitor, registerPlugin }) => {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
          return null;
        }
        const plugin = registerPlugin<ForgeWidgetPlugin>("ForgeWidget");
        // Capacitor proxies expose a synthetic `then` method. Returning the proxy
        // from a Promise makes it a thenable and hangs setup on ForgeWidget.then().
        // Keep the proxy behind a plain facade so only real native methods run.
        return {
          getInstallation: () => plugin.getInstallation(),
          storeCredential: (credential: WidgetCredential) =>
            plugin.storeCredential(credential),
          credentialMetadata: () => plugin.credentialMetadata(),
          clearCredential: () => plugin.clearCredential(),
          refreshSnapshot: () => plugin.refreshSnapshot(),
        } satisfies ForgeWidgetPlugin;
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
  private bootstrapPromise: Promise<boolean> | null = null;
  private generation = 0;
  private loggingOut = false;
  private readonly loadPlugin: PluginLoader;
  private readonly request: Fetcher;
  private readonly requestTimeoutMs: number;

  constructor(
    loadPlugin: PluginLoader,
    request: Fetcher,
    requestTimeoutMs = 5_000
  ) {
    this.loadPlugin = loadPlugin;
    this.request = request;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  private async revoke(token: string) {
    await this.requestWithTimeout(
      "/api/widget/token",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
      () => undefined
    ).catch(() => undefined);
  }

  private async requestWithTimeout<T>(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    consume: (response: Response) => Promise<T> | T
  ): Promise<T> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("Widget credential request timed out."));
      }, this.requestTimeoutMs);
    });
    try {
      return await Promise.race([
        this.request(input, { ...init, signal: controller.signal }).then(consume),
        timedOut,
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private requestJsonWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<{ ok: boolean; data: unknown }> {
    return this.requestWithTimeout(input, init, async (response) => ({
      ok: response.ok,
      data: await response.json().catch(() => null),
    }));
  }

  private async bootstrap(generation: number): Promise<boolean> {
    const plugin = await this.loadPlugin();
    if (!plugin || this.loggingOut || generation !== this.generation) return false;

    const principalResponse = await this.requestJsonWithTimeout(
      "/api/widget/token",
      { method: "GET" }
    );
    if (!principalResponse.ok) return false;
    const principal = principalResponse.data;
    if (!validPrincipal(principal)) return false;

    let { credential } = await plugin.credentialMetadata();
    if (
      credential &&
      (credential.company_id !== principal.company_id ||
        credential.staff_id !== principal.staff_id)
    ) {
      const previousToken = credential.token;
      await plugin.clearCredential();
      void this.revoke(previousToken);
      credential = null;
    }

    if (!widgetCredentialNeedsRefresh(credential)) {
      const refreshed = await plugin.refreshSnapshot();
      if (!refreshed.reconnect) return refreshed.refreshed;
    }

    const { installation_id } = await plugin.getInstallation();
    const response = await this.requestJsonWithTimeout(
      "/api/widget/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installation_id }),
      }
    );
    if (!response.ok) return false;
    const issued = response.data;
    if (
      !validCredential(issued) ||
      issued.company_id !== principal.company_id ||
      issued.staff_id !== principal.staff_id
    ) {
      return false;
    }

    if (this.loggingOut || generation !== this.generation) {
      await this.revoke(issued.token);
      return false;
    }
    await plugin.storeCredential(issued);
    if (this.loggingOut || generation !== this.generation) {
      await plugin.clearCredential();
      await this.revoke(issued.token);
      return false;
    }
    const refreshed = await plugin.refreshSnapshot();
    return refreshed.refreshed && !refreshed.reconnect;
  }

  async ensure(): Promise<boolean> {
    if (this.loggingOut) return false;
    if (!this.bootstrapPromise) {
      const generation = this.generation;
      const promise = this.bootstrap(generation)
        .catch(() => {
          // Widget setup is best-effort and must never block the hosted app.
          return false;
        })
        .finally(() => {
          if (this.bootstrapPromise === promise) this.bootstrapPromise = null;
        });
      this.bootstrapPromise = promise;
    }
    return this.bootstrapPromise;
  }

  async clear(): Promise<void> {
    const plugin = await this.loadPlugin();
    if (!plugin) return;
    const { credential } = await plugin.credentialMetadata();
    await plugin.clearCredential();
    if (credential?.token) void this.revoke(credential.token);
  }

  async logout(): Promise<void> {
    this.loggingOut = true;
    this.generation += 1;
    try {
      const [, logoutResult] = await Promise.allSettled([
        this.clear(),
        this.request("/api/logout", { method: "POST" }),
      ]);
      if (logoutResult.status === "rejected") throw logoutResult.reason;
      if (!logoutResult.value.ok) throw new Error(LOGOUT_FAILURE_MESSAGE);
    } finally {
      this.loggingOut = false;
    }
  }
}

const lifecycle = new NativeWidgetCredentialLifecycle(
  nativeWidgetPlugin,
  (input, init) => fetch(input, init)
);

export async function ensureNativeWidgetCredential(): Promise<boolean> {
  return lifecycle.ensure();
}

export async function clearNativeWidgetCredential(): Promise<void> {
  await lifecycle.clear();
}

export async function logoutForgeSession(): Promise<void> {
  await lifecycle.logout();
}
