import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartGoogleOAuth,
  isNativeAppMarker,
  NATIVE_APP_USER_AGENT,
} from "../src/lib/native-auth.ts";

test("recognizes only the native-app marker value", () => {
  assert.equal(isNativeAppMarker("1"), true);
  assert.equal(isNativeAppMarker(undefined), false);
  assert.equal(isNativeAppMarker("0"), false);
  assert.equal(isNativeAppMarker("true"), false);
});

test("allows Google OAuth for ordinary browser sessions", () => {
  assert.equal(canStartGoogleOAuth(undefined), true);
  assert.equal(canStartGoogleOAuth("0"), true);
});

test("blocks Google OAuth for Capacitor-marked sessions", () => {
  assert.equal(canStartGoogleOAuth("1"), false);
});

test("blocks Google OAuth from the native user agent before a cookie exists", () => {
  assert.equal(
    canStartGoogleOAuth(undefined, `Mozilla/5.0 ${NATIVE_APP_USER_AGENT}`),
    false
  );
});
