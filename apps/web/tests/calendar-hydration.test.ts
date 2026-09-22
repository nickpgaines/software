import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-ignore shared harness transpiles the real TSX components.
import { hookRenderer, loadCustomerModule } from "./helpers/customer-ui.mjs";

test("calendar hydration is stable across server/browser dates and mounts in the browser timezone", async (t) => {
  const { default: Calendar } = await loadCustomerModule("components/CalendarClient.tsx");
  const OriginalDate = Date;
  const originalTZ = process.env.TZ;
  const instant = "2026-09-27T01:30:00Z"; // Sunday UTC, Saturday in Chicago.
  globalThis.Date = new Proxy(OriginalDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [instant], newTarget);
    },
    get(target, property, receiver) {
      return property === "now" ? () => OriginalDate.parse(instant) : Reflect.get(target, property, receiver);
    },
  });
  t.after(() => {
    globalThis.Date = OriginalDate;
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });
  process.env.TZ = "UTC";
  const server = renderToStaticMarkup(React.createElement(Calendar));
  process.env.TZ = "America/Chicago";
  const client = renderToStaticMarkup(React.createElement(Calendar));
  assert.equal(client, server, "initial HTML must not depend on local dates or timezone");

  const renderer = hookRenderer();
  t.after(() => renderer.dispose());
  renderer.render(Calendar);
  renderer.flushEffects();
  const mounted = renderToStaticMarkup(renderer.render(Calendar));
  assert.match(mounted, /Sep 20 – 26, 2026/, "mounted calendar uses the browser's current week");
  assert.doesNotMatch(mounted, /Loading schedule/);
});
