import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 24 runtime API
import { registerHooks } from "node:module";
import { Capacitor } from "@capacitor/core";
import { watchForegroundPosition } from "../src/lib/native.ts";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let fixtureId = 0;
async function setup(t: test.TestContext, options: { pendingPermission?: boolean; pendingWatch?: boolean; pendingState?: boolean } = {}) {
  const permission = deferred<{ location: string; coarseLocation: string }>();
  const watch = deferred<string>();
  const appState = deferred<{ isActive: boolean }>();
  const positions: Array<{ lat: number; lng: number }> = [];
  const callbacks: Array<(position: unknown, error?: unknown) => void> = [];
  const cleared: string[] = [];
  let stateChange!: (state: { isActive: boolean }) => void;
  let removed = 0;
  let errors = 0;
  const doc = new EventTarget() as EventTarget & { hidden: boolean };
  doc.hidden = false;
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  t.mock.method(Capacitor, "isNativePlatform", () => true);
  const key = `__mapLocationFixture${++fixtureId}`;
  const fixtures = globalThis as unknown as Record<string, unknown>;
  fixtures[key] = {
    App: {
      addListener: async (_event: string, callback: typeof stateChange) => {
        stateChange = callback;
        return { remove: async () => { removed++; } };
      },
      getState: () => options.pendingState ? appState.promise : Promise.resolve({ isActive: true }),
    },
    Geolocation: {
      requestPermissions: () => options.pendingPermission ? permission.promise : Promise.resolve({ location: "granted", coarseLocation: "granted" }),
      watchPosition: (_options: unknown, callback: (position: unknown, error?: unknown) => void) => {
        callbacks.push(callback);
        return options.pendingWatch ? watch.promise : Promise.resolve(`watch-${callbacks.length}`);
      },
      clearWatch: async ({ id }: { id: string }) => { cleared.push(id); },
    },
  };
  const hooks = registerHooks({ resolve(specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) {
    const name = specifier === "@capacitor/app" ? "App" : specifier === "@capacitor/geolocation" ? "Geolocation" : null;
    return name ? { shortCircuit: true, url: `data:text/javascript,export const ${name} = globalThis.${key}.${name}` } : next(specifier, context);
  } });
  const stop = watchForegroundPosition(position => positions.push(position), () => { errors++; });
  t.after(async () => {
    stop();
    await settle();
    hooks.deregister();
    delete fixtures[key];
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  });
  await settle();
  return { positions, callbacks, cleared, permission, watch, appState, stop,
    get removed() { return removed; }, get errors() { return errors; },
    setActive(isActive: boolean) { stateChange({ isActive }); },
    fix(index = 0) { callbacks[index]?.({ coords: { latitude: 33, longitude: -81 } }); },
  };
}

test("native background transition clears GPS even if the web document stays visible", async t => {
  const state = await setup(t);
  state.fix();
  assert.deepEqual(state.positions, [{ lat: 33, lng: -81 }]);
  state.setActive(false);
  await settle();
  assert.deepEqual(state.cleared, ["watch-1"]);
  state.fix();
  assert.equal(state.positions.length, 1);
  state.setActive(true);
  await settle();
  state.fix(1);
  assert.equal(state.positions.length, 2);
  state.stop();
  state.stop();
  await settle();
  assert.equal(state.removed, 1);
  assert.deepEqual(state.cleared, ["watch-1", "watch-2"]);
});

test("native permission resolving after backgrounding never starts a GPS watch", async t => {
  const state = await setup(t, { pendingPermission: true });
  state.setActive(false);
  state.permission.resolve({ location: "granted", coarseLocation: "granted" });
  await settle();
  assert.equal(state.callbacks.length, 0);
});

test("a late native watch ID is cleared after the map unmounts", async t => {
  const state = await setup(t, { pendingWatch: true });
  assert.equal(state.callbacks.length, 1);
  state.stop();
  state.watch.resolve("late-watch");
  await settle();
  assert.deepEqual(state.cleared, ["late-watch"]);
  state.fix();
  assert.deepEqual(state.positions, []);
});

test("an old getState response cannot restart GPS after a background event", async t => {
  const state = await setup(t, { pendingState: true });
  state.setActive(false);
  state.appState.resolve({ isActive: true });
  await settle();
  assert.equal(state.callbacks.length, 0);
});

test("native denied permission shows an error without starting GPS", async t => {
  const state = await setup(t, { pendingPermission: true });
  state.permission.resolve({ location: "denied", coarseLocation: "denied" });
  await settle();
  assert.equal(state.errors, 1);
  assert.equal(state.callbacks.length, 0);
});

test("terminal native timeouts retry with bounded backoff while foregrounded", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const state = await setup(t);
  for (const [index, delay] of [5_000, 10_000, 20_000].entries()) {
    state.callbacks[index](null, { code: "OS-PLUG-GLOC-0010" });
    t.mock.timers.tick(delay);
    await settle();
    assert.equal(state.callbacks.length, index + 2);
  }
  state.callbacks[3](null, { code: "OS-PLUG-GLOC-0010" });
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(state.callbacks.length, 4);
  assert.deepEqual(state.cleared, ["watch-1", "watch-2", "watch-3"]);
});

test("backgrounding cancels a pending native timeout retry", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const state = await setup(t);
  state.callbacks[0](null, { code: "OS-PLUG-GLOC-0010" });
  state.setActive(false);
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(state.callbacks.length, 1);
  assert.deepEqual(state.cleared, ["watch-1"]);
});

test("native position-unavailable restarts the terminated iOS stream", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const state = await setup(t);
  state.callbacks[0](null, { code: "OS-PLUG-GLOC-0002" });
  t.mock.timers.tick(5_000);
  await settle();
  assert.equal(state.callbacks.length, 2);
  state.fix(1);
  assert.deepEqual(state.positions, [{ lat: 33, lng: -81 }]);
  assert.deepEqual(state.cleared, ["watch-1"]);
});
