import assert from "node:assert/strict";
import test from "node:test";

import { widgetCredentialNeedsRefresh } from "../src/lib/native-widget.ts";

test("refreshes a missing or nearly expired widget credential", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");
  assert.equal(widgetCredentialNeedsRefresh(null, now), true);
  assert.equal(
    widgetCredentialNeedsRefresh(
      { expires_at: "2026-09-20T12:00:00.000Z" },
      now
    ),
    true
  );
});

test("reuses a credential with more than thirty days remaining", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");
  assert.equal(
    widgetCredentialNeedsRefresh(
      { expires_at: "2026-09-22T12:00:01.000Z" },
      now
    ),
    false
  );
});

test("refreshes a credential with an invalid expiration", () => {
  assert.equal(widgetCredentialNeedsRefresh({ expires_at: "not-a-date" }), true);
});
