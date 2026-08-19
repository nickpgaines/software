export const NATIVE_APP_COOKIE = "forge_native_app";
export const NATIVE_APP_USER_AGENT = "ForgeNative/1";

export function isNativeAppMarker(value: string | undefined): boolean {
  return value === "1";
}

export function isNativeAppUserAgent(value: string | null | undefined): boolean {
  return value?.includes(NATIVE_APP_USER_AGENT) ?? false;
}

export function canStartGoogleOAuth(
  cookieValue: string | undefined,
  userAgent?: string | null
): boolean {
  return !isNativeAppMarker(cookieValue) && !isNativeAppUserAgent(userAgent);
}
