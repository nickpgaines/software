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
 * Camera.getPhoto rejects both when the user deliberately cancels AND on real
 * failures (permission denied, no camera, undecodable image). Only a cancel is
 * a silent no-op; everything else must surface so the caller can show an error
 * or a "enable access in Settings" hint. Match the cancel by its documented
 * error code and, defensively, by message text across platforms.
 */
function isCameraCancel(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = (e?.message ?? "").toLowerCase();
  // OS-PLUG-CAMR-0006 = TakePhotoCancelled; iOS rejects cancel with a
  // "User cancelled…" message.
  return code === "OS-PLUG-CAMR-0006" || msg.includes("cancel");
}

/**
 * Capture a photo with the native camera / photo picker. Native only — in the
 * browser, callers keep using the file <input>. Returns the image as a Blob
 * (callers run it through their existing compress + upload path), or null if
 * the user cancels. Throws on a real failure (permission denied, no camera,
 * decode error) so the caller can surface it — a denied state must not look
 * like a cancel.
 */
export async function captureNativePhoto(): Promise<Blob | null> {
  if (!isNativeApp()) return null;
  // getPhoto is @deprecated in @capacitor/camera v8 (slated for removal in a
  // future major); revisit takePhoto/chooseFromGallery when we upgrade.
  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );
  // Mirror the geolocation path: request up front so the OS prompt + Info.plist
  // usage strings apply and an already-denied state is detectable. source:
  // Prompt lets the user pick camera or library, so only block when BOTH are
  // denied.
  const perm = await Camera.requestPermissions();
  if (perm.camera === "denied" && perm.photos === "denied") {
    throw new Error(
      "Camera and photo access are off. Enable them in Settings to add photos."
    );
  }

  let photo;
  try {
    // DataUrl (not Uri): this is a remote-URL Capacitor app, so a Uri webPath
    // points at Capacitor's local file server — cross-origin to the hosted app
    // and unfetchable. A data: URL is fetchable from any origin.
    photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      saveToGallery: false,
    });
  } catch (err) {
    if (isCameraCancel(err)) return null; // deliberate cancel — no-op
    throw err; // real failure — let the caller surface it
  }
  if (!photo.dataUrl) return null;
  const res = await fetch(photo.dataUrl);
  return await res.blob();
}
