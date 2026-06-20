import { Capacitor } from "@capacitor/core";

/**
 * Native-capability bridge for the Capacitor shell (see CAPACITOR_PLAN.md,
 * Phase 3).
 *
 * The Forge web app is served from the same hosted URL whether it runs in a
 * normal browser or inside the iOS/Android Capacitor webview. These helpers let
 * shared client code reach native plugins when running in the app, and fall
 * back to standard web behavior otherwise. Plugin modules are imported
 * dynamically so they never load during SSR or sit in the browser bundle until
 * a native code path actually runs.
 */

/** True only inside the Capacitor native shell; false in any browser or SSR. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export type Coords = { lat: number; lng: number };

/**
 * Resolve the device's current position. Uses @capacitor/geolocation in the
 * native app (so the OS permission prompt and Info.plist usage string apply),
 * otherwise the browser Geolocation API. Resolves null when unavailable or the
 * user denies permission — callers surface their own UI for the null case.
 */
export async function getCurrentPosition(): Promise<Coords | null> {
  if (isNativeApp()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "denied" && perm.coarseLocation === "denied") {
        return null;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  });
}

/**
 * Capture a photo with the native camera / photo picker. Native only — in the
 * browser, callers keep using the file <input>. Returns the image as a Blob
 * (callers run it through their existing compress + upload path), or null if
 * the user cancels or the picker is unavailable.
 */
export async function captureNativePhoto(): Promise<Blob | null> {
  if (!isNativeApp()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );
    // DataUrl (not Uri): this is a remote-URL Capacitor app, so a Uri webPath
    // points at Capacitor's local file server — cross-origin to the hosted app
    // and unfetchable. A data: URL is fetchable from any origin.
    const photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      saveToGallery: false,
    });
    if (!photo.dataUrl) return null;
    const res = await fetch(photo.dataUrl);
    return await res.blob();
  } catch {
    // getPhoto rejects when the user cancels; treat that as a no-op.
    return null;
  }
}
