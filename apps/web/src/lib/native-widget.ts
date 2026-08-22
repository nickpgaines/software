type WidgetCredential = {
  token: string;
  company_id: number;
  staff_id: number;
  expires_at: string;
};

type ForgeWidgetPlugin = {
  getInstallation(): Promise<{ installation_id: string }>;
  storeCredential(credential: WidgetCredential): Promise<void>;
  credentialMetadata(): Promise<{ credential: WidgetCredential | null }>;
  clearCredential(): Promise<void>;
  refreshSnapshot(): Promise<{ refreshed: boolean; reconnect?: boolean }>;
};

let pluginPromise: Promise<ForgeWidgetPlugin | null> | null = null;
let bootstrapPromise: Promise<void> | null = null;

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

async function bootstrapNativeWidgetCredential(): Promise<void> {
  const plugin = await nativeWidgetPlugin();
  if (!plugin) return;

  const { credential } = await plugin.credentialMetadata();
  if (!widgetCredentialNeedsRefresh(credential)) {
    const refreshed = await plugin.refreshSnapshot();
    if (!refreshed.reconnect) return;
  }

  const { installation_id } = await plugin.getInstallation();
  const response = await fetch("/api/widget/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ installation_id }),
  });
  if (!response.ok) return;
  const issued = (await response.json()) as WidgetCredential;
  if (
    !issued.token ||
    !Number.isInteger(issued.company_id) ||
    !Number.isInteger(issued.staff_id) ||
    !Number.isFinite(new Date(issued.expires_at).getTime())
  ) {
    return;
  }
  await plugin.storeCredential(issued);
  await plugin.refreshSnapshot();
}

export async function ensureNativeWidgetCredential(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapNativeWidgetCredential()
      .catch(() => {
        // Widget setup is best-effort and must never block the hosted app.
      })
      .finally(() => {
        bootstrapPromise = null;
      });
  }
  await bootstrapPromise;
}

export async function clearNativeWidgetCredential(): Promise<void> {
  const plugin = await nativeWidgetPlugin();
  if (!plugin) return;
  try {
    const { credential } = await plugin.credentialMetadata();
    if (credential?.token) {
      await fetch("/api/widget/token", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${credential.token}` },
      }).catch(() => undefined);
    }
  } finally {
    await plugin.clearCredential();
  }
}

export async function logoutForgeSession(): Promise<void> {
  try {
    await clearNativeWidgetCredential();
  } catch {
    // Local cleanup is retried by the native bridge; web logout must continue.
  }
  await fetch("/api/logout", { method: "POST" });
}
