import assert from "node:assert/strict";
import test from "node:test";
import { mountMap } from "./helpers/map-component.ts";

test("a touch-only tap on empty map dismisses the pin popup", async () => {
  const state = await mountMap();
  try {
    const popup = state.openPin();
    await state.touch("touchstart", 100, 100);
    await state.touch("touchend", 102, 101, undefined, 0);
    assert.equal(popup.removed, true);
  } finally { state.dispose(); }
});

test("a drag, cancelled gesture, multi-touch, or popup-content tap does not dismiss the popup", async () => {
  const state = await mountMap();
  try {
    const popup = state.openPin();
    await state.touch("touchstart", 100, 100);
    await state.touch("touchmove", 130, 100);
    await state.touch("touchend", 130, 100, undefined, 0);
    assert.equal(popup.removed, false);
    await state.touch("touchstart", 100, 100);
    await state.touch("touchcancel", 100, 100);
    await state.touch("touchend", 100, 100, undefined, 0);
    assert.equal(popup.removed, false);
    await state.touch("touchstart", 100, 100, undefined, 2);
    await state.touch("touchend", 100, 100, undefined, 0);
    assert.equal(popup.removed, false);
    popup.node.className = "mapboxgl-popup";
    await state.touch("touchstart", 100, 100, popup.node);
    await state.touch("touchend", 100, 100, popup.node, 0);
    assert.equal(popup.removed, false);
  } finally { state.dispose(); }
});

test("live fixes move the blue dot without repeatedly moving the map camera", async () => {
  const state = await mountMap();
  try {
    state.livePosition(33.01, -81.01);
    const centers = state.map.centers.length;
    state.livePosition(33.02, -81.02);
    const location = state.markers.find(marker => marker.getElement().title === "Your live location");
    assert.deepEqual(location?.position, [-81.02, 33.02]);
    assert.equal(state.map.centers.length, centers);
  } finally { state.dispose(); }
  assert.equal(state.stopped, 1);
});

test("a first location fix does not override keyboard browsing", async () => {
  const state = await mountMap();
  try {
    await state.map.emit("movestart", { originalEvent: new Event("keydown") });
    state.livePosition(33.01, -81.01);
    assert.equal(state.map.centers.length, 0);
  } finally { state.dispose(); }
});
