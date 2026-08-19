export const NATIVE_APP_COOKIE = "forge_native_app";

export function isNativeAppMarker(value: string | undefined): boolean {
  return value === "1";
}

export function canStartGoogleOAuth(value: string | undefined): boolean {
  return !isNativeAppMarker(value);
}
