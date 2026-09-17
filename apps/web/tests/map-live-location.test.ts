import assert from "node:assert/strict";
import test from "node:test";
import * as native from "../src/lib/native.ts";

type Position = { lat: number; lng: number };
type StartWatch = (onPosition: (position: Position) => void, onError: () => void) => () => void;

function setup(t: test.TestContext) {
  const doc = new EventTarget() as EventTarget & { hidden: boolean };
  doc.hidden = false;
  const watches = new Map<number, { success: PositionCallback; error: PositionErrorCallback }>();
  const cleared: number[] = [];
  let nextId = 0;
  const previous = ["document", "navigator"].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let stop: (() => void) | undefined;
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation: {
    watchPosition(success: PositionCallback, error: PositionErrorCallback) {
      watches.set(++nextId, { success, error });
      return nextId;
    },
    clearWatch(id: number) { cleared.push(id); },
  } } });
  t.after(() => {
    stop?.();
    ["document", "navigator"].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  const positions: Position[] = [];
  let errors = 0;
  stop = (native as unknown as { watchForegroundPosition?: StartWatch }).watchForegroundPosition?.(
    position => positions.push(position), () => { errors++; }
  );
  return {
    watches, cleared, positions, stop,
    get errors() { return errors; },
    visibility(hidden: boolean) { doc.hidden = hidden; doc.dispatchEvent(new Event("visibilitychange")); },
    position(id: number, lat: number, lng: number) {
      watches.get(id)?.success({ coords: { latitude: lat, longitude: lng, accuracy: 5 }, timestamp: 1 } as GeolocationPosition);
    },
  };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test("map location continuously receives positions until the map is closed", async t => {
  const state = setup(t);
  await settle();
  state.position(1, 33, -81);
  state.position(1, 33.001, -81.001);
  assert.deepEqual(state.positions, [{ lat: 33, lng: -81 }, { lat: 33.001, lng: -81.001 }]);
  state.stop?.();
  await settle();
  state.position(1, 34, -82);
  assert.equal(state.positions.length, 2);
  assert.deepEqual(state.cleared, [1]);
});

test("backgrounding stops location, resuming creates one fresh watch, and stale callbacks are ignored", async t => {
  const state = setup(t);
  await settle();
  state.visibility(true);
  await settle();
  state.position(1, 10, 20);
  assert.deepEqual(state.cleared, [1]);
  assert.deepEqual(state.positions, []);
  state.visibility(false);
  state.visibility(false);
  await settle();
  assert.equal(state.watches.size, 2);
  state.position(1, 11, 21);
  state.position(2, 12, 22);
  assert.deepEqual(state.positions, [{ lat: 12, lng: 22 }]);
});

test("an immediate background/unmount clears a watch whose setup is still resolving", async t => {
  const state = setup(t);
  state.visibility(true);
  state.stop?.();
  await settle();
  assert.deepEqual(state.cleared, [1]);
  state.position(1, 1, 1);
  assert.deepEqual(state.positions, []);
});

test("location failures surface without fake coordinates and invalid fixes are ignored", async t => {
  const state = setup(t);
  await settle();
  state.watches.get(1)?.error({ code: 1, message: "Denied" } as GeolocationPositionError);
  state.position(1, NaN, 1);
  state.position(1, 91, 181);
  assert.equal(state.errors, 1);
  assert.deepEqual(state.positions, []);
});
